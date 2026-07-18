import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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

  const [profiles, entries, activeTimer] = await Promise.all([
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
  ]);

  return (
    <TimesheetsClient
      initialDate={initialDate}
      initialWeekStart={weekStart}
      initialProfiles={profiles}
      initialEntries={entries.map(serializeTimeEntry)}
      initialActiveTimer={activeTimer ? serializeTimeEntry(activeTimer) : null}
    />
  );
}
