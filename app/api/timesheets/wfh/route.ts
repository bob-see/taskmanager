import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { parseRequiredDate } from "@/app/api/timesheets/shared";
import { parseDateOnly, toLocalDayStart } from "@/app/timesheets/timesheet-utils";

function parseDefaultDays(value: unknown) {
  if (!Array.isArray(value) || value.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return null;
  }

  return [...new Set(value as number[])].sort((left, right) => left - right);
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if ("defaultDays" in body) {
    const defaultDays = parseDefaultDays(body.defaultDays);
    if (!defaultDays) return Response.json({ error: "defaultDays must contain weekday numbers from 0 to 6" }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { wfhDefaultDays: defaultDays } });
    return Response.json({ defaultDays });
  }

  const date = parseRequiredDate(body?.date, "date");
  if (date.error) return date.error;
  if (typeof body?.isWfh !== "boolean") return Response.json({ error: "isWfh must be true or false" }, { status: 400 });
  const locationDay = await prisma.workLocationDay.upsert({
    where: { userId_date: { userId: user.id, date: toLocalDayStart(parseDateOnly(date.value)) } },
    create: { userId: user.id, date: toLocalDayStart(parseDateOnly(date.value)), isWfh: body.isWfh },
    update: { isWfh: body.isWfh },
    select: { date: true, isWfh: true },
  });
  return Response.json({ date: locationDay.date.toISOString().slice(0, 10), isWfh: locationDay.isWfh });
}
