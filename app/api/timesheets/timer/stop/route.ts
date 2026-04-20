import { prisma } from "@/app/lib/prisma";
import {
  calculateLoggedMinutes,
  isTimesheetRoundingMode,
  toLocalDayStart,
} from "@/app/timesheets/timesheet-utils";
import { parseOptionalNotes, serializeTimeEntry, timeEntrySelect } from "@/app/api/timesheets/shared";

export async function POST(req: Request) {
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

  const activeTimer = await prisma.timeEntry.findFirst({
    where: {
      endTime: null,
    },
    orderBy: {
      startTime: "desc",
    },
    select: {
      id: true,
      startTime: true,
    },
  });

  if (!activeTimer) {
    return Response.json({ error: "No active timer" }, { status: 404 });
  }

  const endTime = new Date();
  const { durationMinutes, loggedMinutes } = calculateLoggedMinutes(
    activeTimer.startTime,
    endTime,
    roundingMode
  );

  const entry = await prisma.timeEntry.update({
    where: { id: activeTimer.id },
    data: {
      entryDate: toLocalDayStart(activeTimer.startTime),
      endTime,
      durationMinutes,
      loggedMinutes,
      roundingMode,
      ...(notes.value !== null ? { notes: notes.value } : {}),
    },
    select: timeEntrySelect,
  });

  return Response.json(serializeTimeEntry(entry));
}
