import { prisma } from "@/app/lib/prisma";
import {
  getWeekRange,
  parseWeekStartParam,
  serializeTimeEntry,
  timeEntrySelect,
} from "@/app/api/timesheets/shared";
import { TimesheetsClient } from "@/app/timesheets/timesheets-client";

export default async function TimesheetsPage() {
  const weekStart = parseWeekStartParam(null);
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

  return (
    <TimesheetsClient
      initialWeekStart={weekStart}
      initialProfiles={profiles}
      initialEntries={entries.map(serializeTimeEntry)}
      initialActiveTimer={activeTimer ? serializeTimeEntry(activeTimer) : null}
    />
  );
}
