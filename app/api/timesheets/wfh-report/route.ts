import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { parseDateOnly, toDateOnly, toLocalDayStart } from "@/app/timesheets/timesheet-utils";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const year = Number(new URL(req.url).searchParams.get("year"));
  const startYear = Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0);
  const start = toLocalDayStart(parseDateOnly(`${startYear}-07-01`));
  const end = toLocalDayStart(parseDateOnly(`${startYear + 1}-07-01`));
  const [entries, days] = await Promise.all([
    prisma.timeEntry.findMany({ where: { profile: { userId: user.id }, entryDate: { gte: start, lt: end }, endTime: { not: null } }, select: { profileId: true, entryDate: true, loggedMinutes: true, profile: { select: { name: true } } } }),
    prisma.workLocationDay.findMany({ where: { userId: user.id, date: { gte: start, lt: end } }, select: { date: true, isWfh: true } }),
  ]);
  // Older entries may have been stored with a different time component. A manual
  // office override must win for that calendar day even if a prior WFH row exists.
  const officeDates = new Set(days.filter((day) => !day.isWfh).map((day) => toDateOnly(day.date)));
  const wfhDates = new Set(days.filter((day) => day.isWfh).map((day) => toDateOnly(day.date)).filter((date) => !officeDates.has(date)));
  const rows = new Map<string, { profileId: string; profileName: string; wfhMinutes: number; officeMinutes: number; totalMinutes: number }>();
  for (const entry of entries) { const row = rows.get(entry.profileId) ?? { profileId: entry.profileId, profileName: entry.profile.name, wfhMinutes: 0, officeMinutes: 0, totalMinutes: 0 }; const minutes = entry.loggedMinutes ?? 0; row.totalMinutes += minutes; if (wfhDates.has(toDateOnly(entry.entryDate))) row.wfhMinutes += minutes; else row.officeMinutes += minutes; rows.set(entry.profileId, row); }
  return Response.json({ financialYear: `${startYear}–${startYear + 1}`, rows: [...rows.values()] });
}
