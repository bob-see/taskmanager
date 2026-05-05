import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getWeekRange,
  parseWeekStartParam,
  serializeTimeEntry,
  timeEntrySelect,
} from "@/app/api/timesheets/shared";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStart = parseWeekStartParam(searchParams.get("weekStart"));
  const { weekStartDate, weekEndDate } = getWeekRange(weekStart);

  const [profiles, entries, activeTimer] = await Promise.all([
    prisma.profile.findMany({
      where: {
        user: {
          email: session.user.email,
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
            email: session.user.email,
          },
        },
        startTime: {
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
            email: session.user.email,
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

  return Response.json({
    weekStart,
    profiles,
    entries: entries.map(serializeTimeEntry),
    activeTimer: activeTimer ? serializeTimeEntry(activeTimer) : null,
  });
}
