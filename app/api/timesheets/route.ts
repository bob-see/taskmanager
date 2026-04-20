import { prisma } from "@/app/lib/prisma";
import {
  getWeekRange,
  parseWeekStartParam,
  serializeTimeEntry,
  timeEntrySelect,
} from "@/app/api/timesheets/shared";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const weekStart = parseWeekStartParam(searchParams.get("weekStart"));
  const { weekStartDate, weekEndDate } = getWeekRange(weekStart);

  const [profiles, entries, activeTimer] = await Promise.all([
    prisma.profile.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
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
