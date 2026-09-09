import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import {
  getWeekRange,
  parseWeekStartParam,
  serializeTimeEntry,
  timeEntrySelect,
} from "@/app/api/timesheets/shared";
import { requireAuthenticatedTimesheetUser } from "@/app/lib/timesheet-timer-core";

export async function GET(req: Request) {
  const currentUser = await requireAuthenticatedTimesheetUser(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });
  });
  if (currentUser.error) return currentUser.error;

  const { searchParams } = new URL(req.url);
  const weekStart = parseWeekStartParam(searchParams.get("weekStart"));
  const { weekStartDate, weekEndDate } = getWeekRange(weekStart);

  const [profiles, entries, activeTimer, user, wfhDays] = await Promise.all([
    prisma.profile.findMany({
      where: {
        userId: currentUser.user.id,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        profile: {
          userId: currentUser.user.id,
        },
        entryDate: {
          gte: weekStartDate,
          lt: weekEndDate,
        },
        endTime: {
          not: null,
        },
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
      select: timeEntrySelect,
    }),
    prisma.timeEntry.findFirst({
      where: {
        profile: {
          userId: currentUser.user.id,
        },
        endTime: null,
      },
      orderBy: {
        startTime: "desc",
      },
      select: timeEntrySelect,
    }),
    prisma.user.findUnique({ where: { id: currentUser.user.id }, select: { wfhDefaultDays: true } }),
    prisma.workLocationDay.findMany({
      where: { userId: currentUser.user.id, date: { gte: weekStartDate, lt: weekEndDate } },
      select: { date: true, isWfh: true },
    }),
  ]);

  return Response.json({
    weekStart,
    profiles,
    entries: entries.map(serializeTimeEntry),
    activeTimer: activeTimer ? serializeTimeEntry(activeTimer) : null,
    wfhDefaultDays: Array.isArray(user?.wfhDefaultDays) ? user.wfhDefaultDays.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6) : [],
    wfhDays: wfhDays.map((day) => ({ date: day.date.toISOString().slice(0, 10), isWfh: day.isWfh })),
  });
}
