import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { getBrisbaneCalendarDate } from "@/app/lib/date-time";
import { calculateLoggedMinutes, isTimesheetRoundingMode } from "@/app/timesheets/timesheet-utils";
import { serializeTimeEntry } from "@/app/api/timesheets/shared";
import {
  requireAuthenticatedTimesheetUser,
  switchOwnedTimer,
  TimerOperationError,
} from "@/app/lib/timesheet-timer-core";
import { prismaTimerStore } from "@/app/api/timesheets/timer/store";

export async function POST(req: Request) {
  const currentUser = await requireAuthenticatedTimesheetUser(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  });
  if (currentUser.error) return currentUser.error;

  const body = await req.json().catch(() => ({}));
  const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
  if (!profileId) return Response.json({ error: "profileId is required" }, { status: 400 });
  if (!isTimesheetRoundingMode(body?.roundingMode)) {
    return Response.json({ error: "roundingMode must be one of: exact, nearest-15, up-15" }, { status: 400 });
  }

  const switchTime = new Date();
  try {
    const result = await switchOwnedTimer(prismaTimerStore, {
      userId: currentUser.user.id,
      profileId,
      switchTime,
      entryDate: getBrisbaneCalendarDate(switchTime),
      roundingMode: body.roundingMode,
      calculateLoggedMinutes,
    });
    return Response.json({
      completedTimer: serializeTimeEntry(result.completedTimer),
      activeTimer: serializeTimeEntry(result.nextTimer),
    });
  } catch (error) {
    if (error instanceof TimerOperationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
