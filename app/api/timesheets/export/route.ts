import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { getBrisbaneDate, parseDateOnly } from "@/app/lib/date-time";
import { toLocalDayStart } from "@/app/timesheets/timesheet-utils";
import { buildTimesheetExportRows, createTimesheetCsv } from "@/app/timesheets/csv-export";

const FIRST_EXPORT_FINANCIAL_YEAR = 2025;

function currentFinancialYearStart() {
  const [year, month] = getBrisbaneDate(new Date()).split("-").map(Number);
  return month < 7 ? year - 1 : year;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const requestedYear = Number(new URL(req.url).searchParams.get("year"));
  const currentYear = currentFinancialYearStart();
  if (!Number.isInteger(requestedYear) || requestedYear < FIRST_EXPORT_FINANCIAL_YEAR || requestedYear > currentYear) {
    return Response.json({ error: "Choose an available Australian financial year" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, wfhDefaultDays: true },
  });
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const start = toLocalDayStart(parseDateOnly(`${requestedYear}-07-01`));
  const end = toLocalDayStart(parseDateOnly(`${requestedYear + 1}-07-01`));
  const [entries, workLocationDays] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { profile: { userId: user.id }, entryDate: { gte: start, lt: end }, endTime: { not: null } },
      orderBy: [{ entryDate: "asc" }, { profile: { name: "asc" } }],
      select: { profileId: true, entryDate: true, loggedMinutes: true, profile: { select: { name: true } } },
    }),
    prisma.workLocationDay.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      select: { date: true, isWfh: true },
    }),
  ]);

  const defaultWfhDays = Array.isArray(user.wfhDefaultDays)
    ? user.wfhDefaultDays.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const csv = createTimesheetCsv(buildTimesheetExportRows(
    entries.map((entry) => ({ ...entry, profileName: entry.profile.name })),
    workLocationDays,
    defaultWfhDays
  ));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timesheet-${requestedYear}-${requestedYear + 1}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
