import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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

  const [profiles, entries, activeTimer] = await Promise.all([
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
  ]);

  return Response.json({
    weekStart,
    profiles,
    entries: entries.map(serializeTimeEntry),
    activeTimer: activeTimer ? serializeTimeEntry(activeTimer) : null,
  });
}
