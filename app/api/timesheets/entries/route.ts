import { prisma } from "@/app/lib/prisma";
import {
  buildCompletedTimeEntryData,
  ensureTimesheetProfile,
  parseOptionalNotes,
  parseRequiredDate,
  parseRequiredTime,
  parseRoundingMode,
  serializeTimeEntry,
  timeEntrySelect,
  validateTimeRange,
} from "@/app/api/timesheets/shared";
import { combineDateAndTime } from "@/app/timesheets/timesheet-utils";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const profileId = await ensureTimesheetProfile(body?.profileId);
  if (profileId.error) return profileId.error;

  const entryDate = parseRequiredDate(body?.date, "date");
  if (entryDate.error) return entryDate.error;

  const startTime = parseRequiredTime(body?.startTime, "startTime");
  if (startTime.error) return startTime.error;

  const endTime = parseRequiredTime(body?.endTime, "endTime");
  if (endTime.error) return endTime.error;

  const notes = parseOptionalNotes(body?.notes);
  if (notes.error) return notes.error;

  const roundingMode = parseRoundingMode(body?.roundingMode, "nearest-15");
  if (roundingMode.error) return roundingMode.error;

  const startDateTime = combineDateAndTime(entryDate.value, startTime.value);
  const endDateTime = combineDateAndTime(entryDate.value, endTime.value);
  const rangeError = validateTimeRange(startDateTime, endDateTime);
  if (rangeError) return rangeError;

  const entry = await prisma.timeEntry.create({
    data: buildCompletedTimeEntryData({
      entryDate: entryDate.value,
      startTime: startDateTime,
      endTime: endDateTime,
      notes: notes.value,
      profileId: profileId.value,
      roundingMode: roundingMode.value,
      source: "manual",
    }),
    select: timeEntrySelect,
  });

  return Response.json(serializeTimeEntry(entry), { status: 201 });
}
