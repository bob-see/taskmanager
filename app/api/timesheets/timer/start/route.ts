import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  parseOptionalNotes,
  serializeTimeEntry,
} from "@/app/api/timesheets/shared";
import { getBrisbaneCalendarDate } from "@/app/lib/date-time";
import {
  requireAuthenticatedTimesheetUser,
  startOwnedTimer,
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
  const profileId =
    typeof body?.profileId === "string" ? body.profileId.trim() : "";
  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }

  const notes = parseOptionalNotes(body?.notes);
  if (notes.error) return notes.error;

  const now = new Date();
  try {
    const entry = await startOwnedTimer(prismaTimerStore, {
      userId: currentUser.user.id,
      profileId,
      entryDate: getBrisbaneCalendarDate(now),
      startTime: now,
      notes: notes.value,
    });
    return Response.json(serializeTimeEntry(entry), { status: 201 });
  } catch (error) {
    if (error instanceof TimerOperationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
