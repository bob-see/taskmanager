export const TIMESHEET_ROUNDING_MODES = [
  "exact",
  "nearest-15",
  "up-15",
] as const;

export const TIMESHEET_SOURCES = ["manual", "timer"] as const;

export type TimesheetRoundingMode = (typeof TIMESHEET_ROUNDING_MODES)[number];
export type TimesheetSource = (typeof TIMESHEET_SOURCES)[number];

export function isTimesheetRoundingMode(value: unknown): value is TimesheetRoundingMode {
  return (
    typeof value === "string" &&
    TIMESHEET_ROUNDING_MODES.includes(value as TimesheetRoundingMode)
  );
}

export function isTimesheetSource(value: unknown): value is TimesheetSource {
  return typeof value === "string" && TIMESHEET_SOURCES.includes(value as TimesheetSource);
}

export function toLocalDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return toLocalDayStart(addDays(date, offset));
}

export function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 7);
}

export function toDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getWeekDays(weekStart: string) {
  const start = parseDateOnly(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: toDateOnly(date),
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      shortDate: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      date,
    };
  });
}

export function combineDateAndTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function toTimeInputValue(value: Date) {
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function diffMinutes(startTime: Date, endTime: Date) {
  return Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
}

export function roundMinutes(
  minutes: number,
  roundingMode: TimesheetRoundingMode
) {
  if (roundingMode === "exact") {
    return minutes;
  }

  if (roundingMode === "nearest-15") {
    return Math.round(minutes / 15) * 15;
  }

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

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function formatHours(minutes: number) {
  const hours = minutes / 60;
  const formatted = hours.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return `${formatted}h`;
}
