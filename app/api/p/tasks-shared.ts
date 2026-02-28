import { prisma } from "@/app/lib/prisma";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const REPEAT_PATTERNS = ["daily", "weekly", "monthly"] as const;
export const ALL_REPEAT_DAYS_MASK = 0b1111111;

export type RepeatPattern = (typeof REPEAT_PATTERNS)[number];

export function parseDateInput(
  value: unknown,
  field: string
): { value?: Date | null; error?: Response } {
  if (value === undefined) {
    return {};
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json(
        { error: `${field} must be a YYYY-MM-DD string, ISO string, or null` },
        { status: 400 }
      ),
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      error: Response.json(
        { error: `${field} must not be empty` },
        { status: 400 }
      ),
    };
  }

  let parsed: Date;

  if (DATE_ONLY_RE.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    parsed = new Date(year, month - 1, day);
  } else {
    parsed = new Date(trimmed);
  }

  if (Number.isNaN(parsed.getTime())) {
    return {
      error: Response.json(
        { error: `${field} must be a valid YYYY-MM-DD string, ISO string, or null` },
        { status: 400 }
      ),
    };
  }

  return { value: parsed };
}

export function parseOptionalTextInput(
  value: unknown,
  field: string
): { value?: string | null; error?: Response } {
  if (value === undefined) {
    return {};
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json(
        { error: `${field} must be a string or null` },
        { status: 400 }
      ),
    };
  }

  const trimmed = value.trim();
  return { value: trimmed ? trimmed : null };
}

export function parseOptionalBooleanInput(
  value: unknown,
  field: string
): { value?: boolean; error?: Response } {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "boolean") {
    return {
      error: Response.json(
        { error: `${field} must be a boolean` },
        { status: 400 }
      ),
    };
  }

  return { value };
}

export function parseOptionalIntInput(
  value: unknown,
  field: string,
  min: number,
  max: number
): { value?: number | null; error?: Response } {
  if (value === undefined) {
    return {};
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return {
      error: Response.json(
        { error: `${field} must be an integer between ${min} and ${max}` },
        { status: 400 }
      ),
    };
  }

  if (value < min || value > max) {
    return {
      error: Response.json(
        { error: `${field} must be between ${min} and ${max}` },
        { status: 400 }
      ),
    };
  }

  return { value };
}

export function parseOptionalRepeatPatternInput(
  value: unknown,
  field: string
): { value?: RepeatPattern | null; error?: Response } {
  if (value === undefined) {
    return {};
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json(
        { error: `${field} must be one of: ${REPEAT_PATTERNS.join(", ")}` },
        { status: 400 }
      ),
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!REPEAT_PATTERNS.includes(normalized as RepeatPattern)) {
    return {
      error: Response.json(
        { error: `${field} must be one of: ${REPEAT_PATTERNS.join(", ")}` },
        { status: 400 }
      ),
    };
  }

  return { value: normalized as RepeatPattern };
}

export function getWeekdayNumber(date: Date) {
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

export function getRepeatDayBit(weekday: number) {
  return 1 << (weekday - 1);
}

export function getWeekdayFromRepeatDays(repeatDays: number | null | undefined) {
  if (!repeatDays) {
    return null;
  }

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    if (repeatDays & getRepeatDayBit(weekday)) {
      return weekday;
    }
  }

  return null;
}

export function matchesRepeatDays(date: Date, repeatDays: number | null | undefined) {
  const mask = repeatDays ?? ALL_REPEAT_DAYS_MASK;
  return (mask & getRepeatDayBit(getWeekdayNumber(date))) !== 0;
}

export function getDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getRecurringSeriesId(task: {
  id: string;
  recurrenceSeriesId?: string | null;
}) {
  return task.recurrenceSeriesId ?? task.id;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function normalizeRepeatSettings(input: {
  repeatEnabled: boolean;
  repeatPattern: RepeatPattern | string | null;
  repeatDays: number | null;
  repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null;
  referenceDate: Date;
}): {
  value?: {
    repeatEnabled: boolean;
    repeatPattern: RepeatPattern | null;
    repeatDays: number | null;
    repeatWeeklyDay: number | null;
    repeatMonthlyDay: number | null;
  };
  error?: Response;
} {
  if (!input.repeatEnabled) {
    return {
      value: {
        repeatEnabled: false,
        repeatPattern: null,
        repeatDays: null,
        repeatWeeklyDay: null,
        repeatMonthlyDay: null,
      },
    };
  }

  if (!input.repeatPattern || !REPEAT_PATTERNS.includes(input.repeatPattern as RepeatPattern)) {
    return {
      error: Response.json(
        { error: `repeatPattern must be one of: ${REPEAT_PATTERNS.join(", ")}` },
        { status: 400 }
      ),
    };
  }

  if (input.repeatPattern === "daily") {
    const repeatDays = input.repeatDays ?? ALL_REPEAT_DAYS_MASK;
    if (repeatDays < 1 || repeatDays > ALL_REPEAT_DAYS_MASK) {
      return {
        error: Response.json(
          { error: `repeatDays must be between 1 and ${ALL_REPEAT_DAYS_MASK}` },
          { status: 400 }
        ),
      };
    }

    return {
      value: {
        repeatEnabled: true,
        repeatPattern: "daily",
        repeatDays,
        repeatWeeklyDay: null,
        repeatMonthlyDay: null,
      },
    };
  }

  if (input.repeatPattern === "weekly") {
    const repeatWeeklyDay =
      input.repeatWeeklyDay ??
      getWeekdayFromRepeatDays(input.repeatDays) ??
      getWeekdayNumber(input.referenceDate);

    if (repeatWeeklyDay < 1 || repeatWeeklyDay > 7) {
      return {
        error: Response.json(
          { error: "repeatWeeklyDay must be between 1 and 7" },
          { status: 400 }
        ),
      };
    }

    return {
      value: {
        repeatEnabled: true,
        repeatPattern: "weekly",
        repeatDays: getRepeatDayBit(repeatWeeklyDay),
        repeatWeeklyDay,
        repeatMonthlyDay: null,
      },
    };
  }

  const repeatMonthlyDay = input.repeatMonthlyDay ?? input.referenceDate.getDate();

  if (repeatMonthlyDay < 1 || repeatMonthlyDay > 31) {
    return {
      error: Response.json(
        { error: "repeatMonthlyDay must be between 1 and 31" },
        { status: 400 }
      ),
    };
  }

  return {
    value: {
      repeatEnabled: true,
      repeatPattern: "monthly",
      repeatDays: null,
      repeatWeeklyDay: null,
      repeatMonthlyDay,
    },
  };
}

export function nextOccurrenceDate(input: {
  baseDate: Date;
  recurrenceType: RepeatPattern;
  repeatDays: number | null;
  weeklyDay: number | null;
  monthlyDay: number | null;
}) {
  const currentDate = getDateOnly(input.baseDate);
  let nextDate: Date;

  if (input.recurrenceType === "daily") {
    const repeatDays = input.repeatDays ?? ALL_REPEAT_DAYS_MASK;
    nextDate = addDays(currentDate, 1);

    while (!matchesRepeatDays(nextDate, repeatDays)) {
      nextDate = addDays(nextDate, 1);
    }
  } else if (input.recurrenceType === "weekly") {
    const targetWeekday =
      input.weeklyDay ??
      getWeekdayFromRepeatDays(input.repeatDays) ??
      getWeekdayNumber(currentDate);
    let diff = targetWeekday - getWeekdayNumber(currentDate);
    if (diff <= 0) {
      diff += 7;
    }

    nextDate = addDays(currentDate, diff);
  } else {
    const targetDay = input.monthlyDay ?? currentDate.getDate();
    const nextMonth = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear() + Math.floor(nextMonth / 12);
    const month = ((nextMonth % 12) + 12) % 12;
    const maxDay = new Date(year, month + 1, 0).getDate();

    nextDate = new Date(year, month, Math.min(targetDay, maxDay));
  }

  if (getDateOnly(nextDate) <= currentDate) {
    nextDate = addDays(currentDate, 1);
  }

  return nextDate;
}

export async function ensureProfile(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });

  return profile;
}

export async function ensureProject(profileId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, profileId },
    select: { id: true },
  });

  return project;
}
