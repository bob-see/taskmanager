import { prisma } from "@/app/lib/prisma";
import {
  TIMESHEET_ROUNDING_MODES,
  TIMESHEET_SOURCES,
  type TimesheetRoundingMode,
  addDays,
  calculateLoggedMinutes,
  isTimesheetRoundingMode,
  isTimesheetSource,
  parseDateOnly,
  startOfWeek,
  toDateOnly,
  toLocalDayStart,
} from "@/app/timesheets/timesheet-utils";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_RE = /^\d{2}:\d{2}$/;

export const timeEntrySelect = {
  id: true,
  profileId: true,
  entryDate: true,
  startTime: true,
  endTime: true,
  durationMinutes: true,
  loggedMinutes: true,
  roundingMode: true,
  notes: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      name: true,
    },
  },
} as const;

export function parseWeekStartParam(value: string | null) {
  if (!value || !DATE_ONLY_RE.test(value)) {
    return toDateOnly(startOfWeek(new Date()));
  }

  return toDateOnly(startOfWeek(parseDateOnly(value)));
}

export function parseRequiredDate(value: unknown, field: string) {
  if (typeof value !== "string" || !DATE_ONLY_RE.test(value)) {
    return {
      error: Response.json({ error: `${field} must be a YYYY-MM-DD string` }, { status: 400 }),
    };
  }

  return { value };
}

export function parseRequiredTime(value: unknown, field: string) {
  if (typeof value !== "string" || !TIME_ONLY_RE.test(value)) {
    return {
      error: Response.json({ error: `${field} must be an HH:MM string` }, { status: 400 }),
    };
  }

  return { value };
}

export function parseOptionalNotes(value: unknown) {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json({ error: "notes must be a string or null" }, { status: 400 }),
    };
  }

  const trimmed = value.trim();
  return { value: trimmed || null };
}

export function parseRoundingMode(value: unknown, fallback: TimesheetRoundingMode) {
  if (value === undefined || value === null || value === "") {
    return { value: fallback };
  }

  if (!isTimesheetRoundingMode(value)) {
    return {
      error: Response.json(
        { error: `roundingMode must be one of: ${TIMESHEET_ROUNDING_MODES.join(", ")}` },
        { status: 400 }
      ),
    };
  }

  return { value };
}

export function parseSource(value: unknown) {
  if (!isTimesheetSource(value)) {
    return {
      error: Response.json(
        { error: `source must be one of: ${TIMESHEET_SOURCES.join(", ")}` },
        { status: 400 }
      ),
    };
  }

  return { value };
}

export async function ensureTimesheetProfile(profileId: unknown) {
  if (typeof profileId !== "string" || !profileId.trim()) {
    return {
      error: Response.json({ error: "profileId is required" }, { status: 400 }),
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });

  if (!profile) {
    return {
      error: Response.json({ error: "Profile not found" }, { status: 404 }),
    };
  }

  return { value: profile.id };
}

export function validateTimeRange(startTime: Date, endTime: Date) {
  if (endTime <= startTime) {
    return Response.json(
      { error: "endTime must be later than startTime" },
      { status: 400 }
    );
  }

  return null;
}

export function getWeekRange(weekStart: string) {
  const start = parseDateOnly(weekStart);
  return {
    weekStartDate: toLocalDayStart(start),
    weekEndDate: addDays(toLocalDayStart(start), 7),
  };
}

export function serializeTimeEntry(
  entry: {
    id: string;
    profileId: string;
    entryDate: Date;
    startTime: Date;
    endTime: Date | null;
    durationMinutes: number | null;
    loggedMinutes: number | null;
    roundingMode: string | null;
    notes: string | null;
    source: string;
    createdAt: Date;
    updatedAt: Date;
    profile?: { name: string } | null;
  }
) {
  return {
    id: entry.id,
    profileId: entry.profileId,
    profileName: entry.profile?.name ?? "",
    entryDate: toDateOnly(entry.entryDate),
    startTime: entry.startTime.toISOString(),
    endTime: entry.endTime?.toISOString() ?? null,
    durationMinutes: entry.durationMinutes,
    loggedMinutes: entry.loggedMinutes,
    roundingMode: entry.roundingMode,
    notes: entry.notes,
    source: entry.source,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function buildCompletedTimeEntryData(input: {
  entryDate: string;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  profileId: string;
  roundingMode: TimesheetRoundingMode;
  source: "manual" | "timer";
}) {
  const { durationMinutes, loggedMinutes } = calculateLoggedMinutes(
    input.startTime,
    input.endTime,
    input.roundingMode
  );

  return {
    profileId: input.profileId,
    entryDate: toLocalDayStart(parseDateOnly(input.entryDate)),
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes,
    loggedMinutes,
    roundingMode: input.roundingMode,
    notes: input.notes,
    source: input.source,
  };
}
