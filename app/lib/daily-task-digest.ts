export const DEFAULT_DAILY_TASK_DIGEST_TIME = "08:30";
export const DEFAULT_DAILY_TASK_DIGEST_DAYS = [1, 2, 3, 4, 5] as const;

export type DailyTaskDigestSettings = {
  time: string;
  timeZone: string;
  daysOfWeek: number[];
};

export type DigestTask = {
  id: string;
  title: string;
  startDate: Date;
  dueAt: Date | null;
  completedOn: Date | null;
  delegatedTask?: unknown | null;
};

export type DailyTaskDigest = {
  tasks: Array<{
    id: string;
    title: string;
    states: Array<"Starting today" | "Due today" | "Overdue">;
  }>;
  groups: Array<{
    label: "Starting today" | "Due today" | "Overdue";
    tasks: Array<{
      id: string;
      title: string;
      states: Array<"Starting today" | "Due today" | "Overdue">;
    }>;
  }>;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const weekdayByName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function normaliseDailyTaskDigestSettings(
  value: unknown,
  fallbackTimeZone = "Australia/Brisbane"
): DailyTaskDigestSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const time = typeof input.time === "string" && TIME_RE.test(input.time)
    ? input.time
    : DEFAULT_DAILY_TASK_DIGEST_TIME;
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : fallbackTimeZone;
  const daysOfWeek = Array.isArray(input.daysOfWeek)
    ? [...new Set(input.daysOfWeek.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : [...DEFAULT_DAILY_TASK_DIGEST_DAYS];
  return { time, timeZone, daysOfWeek };
}

export function parseDailyTaskDigestSettings(value: unknown): DailyTaskDigestSettings | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.time !== "string" ||
    !TIME_RE.test(input.time) ||
    !isValidTimeZone(input.timeZone) ||
    !Array.isArray(input.daysOfWeek) ||
    input.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) return null;
  return normaliseDailyTaskDigestSettings(input, input.timeZone);
}

export function getLocalDigestSnapshot(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
    dayOfWeek: weekdayByName[values.weekday] ?? -1,
  };
}

export function isDailyTaskDigestDue(
  now: Date,
  settings: DailyTaskDigestSettings,
  graceMinutes = 5
) {
  const snapshot = getLocalDigestSnapshot(now, settings.timeZone);
  const [hour, minute] = settings.time.split(":").map(Number);
  const scheduledMinute = hour * 60 + minute;
  return (
    settings.daysOfWeek.includes(snapshot.dayOfWeek) &&
    snapshot.minuteOfDay >= scheduledMinute &&
    snapshot.minuteOfDay < scheduledMinute + graceMinutes
  );
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function buildDailyTaskDigest(tasks: DigestTask[], today: string): DailyTaskDigest {
  const included = new Map<string, {
    id: string;
    title: string;
    states: Array<"Starting today" | "Due today" | "Overdue">;
  }>();
  const groups = new Map<"Starting today" | "Due today" | "Overdue", DailyTaskDigest["tasks"]>([
    ["Starting today", []],
    ["Due today", []],
    ["Overdue", []],
  ]);

  for (const task of tasks) {
    if (task.completedOn || task.delegatedTask) continue;
    const startsToday = dateKey(task.startDate) === today;
    const dueToday = Boolean(task.dueAt && dateKey(task.dueAt) === today);
    const overdue = Boolean(task.dueAt && dateKey(task.dueAt) < today);
    if (!startsToday && !dueToday && !overdue) continue;

    const states: Array<"Starting today" | "Due today" | "Overdue"> = [];
    if (startsToday) states.push("Starting today");
    if (dueToday) states.push("Due today");
    if (overdue) states.push("Overdue");
    const entry = { id: task.id, title: task.title, states };
    included.set(task.id, entry);
    groups.get(states[0])?.push(entry);
  }

  return {
    tasks: [...included.values()],
    groups: (["Starting today", "Due today", "Overdue"] as const)
      .map((label) => ({ label, tasks: groups.get(label) ?? [] }))
      .filter((group) => group.tasks.length > 0),
  };
}

export function formatDailyTaskDigestBody(digest: DailyTaskDigest) {
  return digest.groups.map((group) => {
    const names = group.tasks.slice(0, 3).map((task) =>
      `${task.title}${task.states.length > 1 ? ` (${task.states.join(" + ")})` : ""}`
    ).join(", ");
    const remainder = group.tasks.length - 3;
    return `${group.label} (${group.tasks.length}): ${names}${remainder > 0 ? ` and ${remainder} more` : ""}`;
  }).join("\n");
}
