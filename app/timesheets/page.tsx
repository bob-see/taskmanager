import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/lib/auth-options";
import {
  getWeekRange,
  serializeTimeEntry,
  timeEntrySelect,
} from "@/app/api/timesheets/shared";
import { TimesheetsClient } from "@/app/timesheets/timesheets-client";
import { getBrisbaneDate, parseDateOnly } from "@/app/lib/date-time";
import { startOfWeek, toDateOnly } from "@/app/timesheets/timesheet-utils";

export default async function TimesheetsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  const email = session.user.email;
  const initialDate = getBrisbaneDate(new Date());
  const weekStart = toDateOnly(startOfWeek(parseDateOnly(initialDate)));
  const { weekStartDate, weekEndDate } = getWeekRange(weekStart);

  const [profiles, entries, activeTimer, user, wfhDays] = await Promise.all([
    prisma.profile.findMany({
      where: {
        user: {
          email,
        },
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
          user: {
            email,
          },
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
          user: {
            email,
          },
        },
        endTime: null,
      },
      orderBy: {
        startTime: "desc",
      },
      select: timeEntrySelect,
    }),
    prisma.user.findUnique({ where: { email }, select: { id: true, wfhDefaultDays: true } }),
    prisma.workLocationDay.findMany({
      where: { user: { email }, date: { gte: weekStartDate, lt: weekEndDate } },
      select: { date: true, isWfh: true },
    }),
  ]);

  return (
    <TimesheetsClient
      initialDate={initialDate}
      initialWeekStart={weekStart}
      initialProfiles={profiles}
      initialEntries={entries.map(serializeTimeEntry)}
      initialActiveTimer={activeTimer ? serializeTimeEntry(activeTimer) : null}
      initialWfhDefaultDays={Array.isArray(user?.wfhDefaultDays) ? user.wfhDefaultDays.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6) : []}
      initialWfhDays={wfhDays.map((day) => ({ date: toDateOnly(day.date), isWfh: day.isWfh }))}
    />
  );
}
