import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { serializeTimeEntry, timeEntrySelect } from "@/app/api/timesheets/shared";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const activeTimer = await prisma.timeEntry.findFirst({
    where: { profile: { user: { email: session.user.email } }, endTime: null },
    orderBy: { startTime: "desc" },
    select: timeEntrySelect,
  });

  return Response.json({ activeTimer: activeTimer ? serializeTimeEntry(activeTimer) : null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
