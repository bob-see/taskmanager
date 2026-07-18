import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  calculateLoggedMinutes,
  isTimesheetRoundingMode,
} from "@/app/timesheets/timesheet-utils";
import { parseOptionalNotes, serializeTimeEntry } from "@/app/api/timesheets/shared";
import { getBrisbaneCalendarDate } from "@/app/lib/date-time";
import {
  requireAuthenticatedTimesheetUser,
  stopOwnedTimer,
  TimerOperationError,
} from "@/app/lib/timesheet-timer-core";
import { prismaTimerStore } from "@/app/api/timesheets/timer/store";

export async function POST(req: Request) {
  const currentUser = await requireAuthenticatedTimesheetUser(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
  });
  if (currentUser.error) return currentUser.error;

  const body = await req.json().catch(() => ({}));
  const notes = parseOptionalNotes(body?.notes);
  if (notes.error) return notes.error;

  const roundingMode = body?.roundingMode;
  if (!isTimesheetRoundingMode(roundingMode)) {
    return Response.json(
      { error: "roundingMode must be one of: exact, nearest-15, up-15" },
      { status: 400 }
    );
  }

  const endTime = new Date();
  try {
    const entry = await stopOwnedTimer(prismaTimerStore, {
      userId: currentUser.user.id,
      endTime,
      entryDate: getBrisbaneCalendarDate(endTime),
      roundingMode,
      notes: notes.value,
      calculateLoggedMinutes,
    });
    return Response.json(serializeTimeEntry(entry));
  } catch (error) {
    if (error instanceof TimerOperationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
