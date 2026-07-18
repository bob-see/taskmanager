export const TIMESHEET_ROUNDING_MODES = [
  "exact",
  "nearest-15",
  "up-15",
] as const;

export type TimesheetRoundingMode = (typeof TIMESHEET_ROUNDING_MODES)[number];

export function isTimesheetRoundingMode(
  value: unknown
): value is TimesheetRoundingMode {
  return (
    typeof value === "string" &&
    TIMESHEET_ROUNDING_MODES.includes(value as TimesheetRoundingMode)
  );
}

export function diffMinutes(startTime: Date, endTime: Date) {
  return Math.max(
    0,
    Math.round((endTime.getTime() - startTime.getTime()) / 60_000)
  );
}

export function roundMinutes(
  minutes: number,
  roundingMode: TimesheetRoundingMode
) {
  if (roundingMode === "exact") return minutes;
  if (roundingMode === "nearest-15") return Math.round(minutes / 15) * 15;
  return Math.ceil(minutes / 15) * 15;
}

export function calculateLoggedMinutes(
  startTime: Date,
  endTime: Date,
  roundingMode: TimesheetRoundingMode
) {
  const durationMinutes = diffMinutes(startTime, endTime);
  return {
    durationMinutes,
    loggedMinutes: roundMinutes(durationMinutes, roundingMode),
  };
}
