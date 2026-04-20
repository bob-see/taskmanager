import { prisma } from "@/app/lib/prisma";
import {
  ensureTimesheetProfile,
  parseOptionalNotes,
  serializeTimeEntry,
  timeEntrySelect,
} from "@/app/api/timesheets/shared";
import { toLocalDayStart } from "@/app/timesheets/timesheet-utils";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const profileId = await ensureTimesheetProfile(body?.profileId);
  if (profileId.error) return profileId.error;

  const notes = parseOptionalNotes(body?.notes);
  if (notes.error) return notes.error;

  const activeTimer = await prisma.timeEntry.findFirst({
    where: {
      endTime: null,
    },
    select: {
      id: true,
      profile: {
        select: {
          name: true,
        },
      },
    },
  });

  if (activeTimer) {
    return Response.json(
      { error: `Timer already running for ${activeTimer.profile.name}` },
      { status: 409 }
    );
  }

  const now = new Date();
  const entry = await prisma.timeEntry.create({
    data: {
      profileId: profileId.value,
      entryDate: toLocalDayStart(now),
      startTime: now,
      endTime: null,
      durationMinutes: null,
      loggedMinutes: null,
      roundingMode: null,
      notes: notes.value,
      source: "timer",
    },
    select: timeEntrySelect,
  });

  return Response.json(serializeTimeEntry(entry), { status: 201 });
}
