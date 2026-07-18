export const TASKMANAGER_LOCALE = "en-AU";
export const TASKMANAGER_TIME_ZONE = "Australia/Brisbane";

type DateInput = Date | string | number;

type BrisbaneTimestampOptions = Omit<
  Intl.DateTimeFormatOptions,
  "timeZone" | "hour12" | "hourCycle"
> & {
  hour12?: boolean;
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validDate(value: Date) {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError("Invalid date value");
  }
  return value;
}

/** Parse a date-only value as a calendar date, never as a UTC timestamp. */
export function parseDateOnly(value: string) {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  return date;
}

function calendarDateAtUtcNoon(value: Date | string) {
  const date = typeof value === "string" ? parseDateOnly(value) : validDate(value);
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  );
}

/** Format a calendar date independently of the runtime locale and timezone. */
export function formatAustralianDate(
  value: Date | string,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">
) {
  return new Intl.DateTimeFormat(TASKMANAGER_LOCALE, {
    ...options,
    timeZone: "UTC",
  }).format(calendarDateAtUtcNoon(value));
}

/** Format an instant in TaskManager's user-facing Brisbane timezone. */
export function formatBrisbaneTimestamp(
  value: DateInput,
  options: BrisbaneTimestampOptions
) {
  return new Intl.DateTimeFormat(TASKMANAGER_LOCALE, {
    ...options,
    timeZone: TASKMANAGER_TIME_ZONE,
    hour12: options.hour12 ?? true,
  }).format(validDate(value instanceof Date ? value : new Date(value)));
}

/** Derive Brisbane calendar and hour values from an explicitly supplied instant. */
export function getBrisbaneSnapshot(value: DateInput) {
  const parts = new Intl.DateTimeFormat(TASKMANAGER_LOCALE, {
    timeZone: TASKMANAGER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(validDate(value instanceof Date ? value : new Date(value)));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

export function getBrisbaneDate(value: DateInput) {
  return getBrisbaneSnapshot(value).date;
}

export function addDateOnlyDays(value: string, amount: number) {
  const date = parseDateOnly(value);
  date.setDate(date.getDate() + amount);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMondayWeekStart(value: string) {
  const date = parseDateOnly(value);
  const day = date.getDay();
  return addDateOnlyDays(value, day === 0 ? -6 : 1 - day);
}

/** Milliseconds from a supplied instant until the next Brisbane calendar day. */
export function millisecondsUntilNextBrisbaneDay(value: DateInput) {
  const date = validDate(value instanceof Date ? value : new Date(value));
  const nextDate = addDateOnlyDays(getBrisbaneDate(date), 1);
  const nextMidnight = new Date(`${nextDate}T00:00:00+10:00`);
  return Math.max(0, nextMidnight.getTime() - date.getTime());
}

/** Milliseconds until the greeting/date snapshot next changes in Brisbane. */
export function millisecondsUntilNextBrisbaneSnapshotBoundary(value: DateInput) {
  const date = validDate(value instanceof Date ? value : new Date(value));
  const currentDate = getBrisbaneDate(date);
  const nextDate = addDateOnlyDays(currentDate, 1);
  const boundaryInstants = [
    new Date(`${currentDate}T12:00:00+10:00`),
    new Date(`${currentDate}T18:00:00+10:00`),
    new Date(`${nextDate}T00:00:00+10:00`),
  ];
  const nextBoundary = boundaryInstants.find(
    (boundary) => boundary.getTime() > date.getTime()
  );

  return Math.max(0, (nextBoundary ?? boundaryInstants[2]).getTime() - date.getTime());
}

/** Advance a viewed/default date only when it was following the previous current day. */
export function advanceDateIfCurrent(
  value: string,
  previousCurrentDate: string,
  nextCurrentDate: string
) {
  return value === previousCurrentDate ? nextCurrentDate : value;
}

export function getGreetingForHour(hour: number) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Invalid hour: ${hour}`);
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
