import { addDateOnlyDays, getBrisbaneDate, getMondayWeekStart, parseDateOnly } from "./date-time.ts";

export type WeeklySummarySettings = {
  enabled: boolean;
  startDay: number;
  endDay: number;
  dismissedKey: string | null;
};

export const DEFAULT_WEEKLY_SUMMARY_SETTINGS: WeeklySummarySettings = {
  enabled: true, startDay: 1, endDay: 5, dismissedKey: null,
};

export function parseWeeklySummarySettings(value: unknown): WeeklySummarySettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !["enabled", "startDay", "endDay", "dismissedKey"].includes(key))) return null;
  if (typeof item.enabled !== "boolean") return null;
  for (const day of [item.startDay, item.endDay]) {
    if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 7) return null;
  }
  if (item.startDay === item.endDay) return null;
  if (item.dismissedKey !== null) {
    if (typeof item.dismissedKey !== "string" || !/^(start|end):\d{4}-\d{2}-\d{2}$/.test(item.dismissedKey)) return null;
    try { parseDateOnly(item.dismissedKey.split(":")[1]); } catch { return null; }
  }
  return item as WeeklySummarySettings;
}

export type WeeklySummaryPeriod = ReturnType<typeof getWeeklySummaryPeriod>;

export function getWeeklySummaryPeriod(today: string, settings: WeeklySummarySettings) {
  const weekday = parseDateOnly(today).getDay() || 7;
  const startDate = addDateOnlyDays(today, -((weekday - settings.startDay + 7) % 7));
  const endDate = addDateOnlyDays(today, -((weekday - settings.endDay + 7) % 7));
  const phase = startDate > endDate ? "start" : "end";
  const triggeredOn = phase === "start" ? startDate : endDate;
  const weekStart = getMondayWeekStart(triggeredOn);
  const weekEnd = addDateOnlyDays(weekStart, 6);
  return {
    phase, key: `${phase}:${triggeredOn}`, triggeredOn, today, weekStart, weekEnd,
    asOf: today < weekEnd ? today : weekEnd,
    previousStart: addDateOnlyDays(weekStart, -7),
    previousEnd: addDateOnlyDays(weekStart, -1),
    nextStart: addDateOnlyDays(weekStart, 7),
    nextEnd: addDateOnlyDays(weekStart, 13),
  };
}

export type WeeklySummaryTask = {
  id: string; title: string; profileId: string; startDate: string; dueAt: string | null;
  createdAt: string; completedOn: string | null; completedAt: string | null; projectArchived: boolean;
  recurrenceSeriesId: string | null; repeatEnabled: boolean; repeatPattern: string | null;
  repeatInterval: number; repeatDays: number | null; repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null; repeatPaused: boolean; repeatPauseUntil: string | null;
};

export type SummaryTaskLink = {
  id: string; title: string; profileId: string; startDate: string; dueAt: string | null;
  completedOn: string | null; projected?: boolean;
};

export const SUMMARY_METRICS = [
  "completed", "completedPrevious", "starting", "startingNext", "active", "due", "overdue",
  "atStart", "added", "plannedAhead", "remaining", "completedFromStart",
  "repeatCompleted", "repeatCompletedPrevious", "repeatScheduled", "repeatOutstanding",
] as const;
export type SummaryMetric = typeof SUMMARY_METRICS[number];
export type SummaryBuckets = Record<SummaryMetric, SummaryTaskLink[]>;
export type WeeklyProfileSummary = { id: string; name: string; buckets: SummaryBuckets };
export type WeeklySummary = {
  period: WeeklySummaryPeriod;
  total: SummaryBuckets;
  profiles: WeeklyProfileSummary[];
};

function emptyBuckets(): SummaryBuckets {
  return Object.fromEntries(SUMMARY_METRICS.map((key) => [key, [] as SummaryTaskLink[]])) as SummaryBuckets;
}

function inRange(date: string | null, start: string, end: string) {
  return Boolean(date && date >= start && date <= end);
}

function recurring(task: WeeklySummaryTask) {
  return Boolean(task.recurrenceSeriesId || task.repeatEnabled || task.repeatPattern);
}

function paused(task: WeeklySummaryTask, date: string) {
  return task.repeatPaused && (!task.repeatPauseUntil || date <= task.repeatPauseUntil);
}

// A bounded calendar projection, not task generation. Existing occurrences always
// win; only the latest open row supplies future schedule estimates for a series.
function projectedOn(task: WeeklySummaryTask, date: string) {
  if (!task.repeatEnabled || date <= task.startDate || paused(task, date)) return false;
  const interval = Math.max(1, task.repeatInterval);
  const base = parseDateOnly(task.startDate);
  const candidate = parseDateOnly(date);
  const days = Math.round((Date.UTC(candidate.getFullYear(), candidate.getMonth(), candidate.getDate()) -
    Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86400000);
  const weekday = candidate.getDay() || 7;
  if (task.repeatPattern === "daily") {
    return days % interval === 0 && Boolean((task.repeatDays ?? 127) & (1 << (weekday - 1)));
  }
  if (task.repeatPattern === "weekly") {
    const targetDay = task.repeatWeeklyDay ??
      ([1, 2, 3, 4, 5, 6, 7].find((day) => (task.repeatDays ?? 0) & (1 << (day - 1)))) ??
      (base.getDay() || 7);
    let firstOffset = targetDay - (base.getDay() || 7);
    if (firstOffset <= 0) firstOffset += 7 * interval;
    return days >= firstOffset && (days - firstOffset) % (7 * interval) === 0;
  }
  if (task.repeatPattern === "monthly") {
    const months = (candidate.getFullYear() - base.getFullYear()) * 12 + candidate.getMonth() - base.getMonth();
    const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    return months > 0 && months % interval === 0 &&
      candidate.getDate() === Math.min(task.repeatMonthlyDay ?? base.getDate(), lastDay);
  }
  return false;
}

export function buildWeeklySummary(
  profiles: { id: string; name: string }[], tasks: WeeklySummaryTask[],
  today: string, settings: WeeklySummarySettings,
): WeeklySummary {
  const period = getWeeklySummaryPeriod(today, settings);
  const { weekStart, weekEnd, asOf, previousStart, previousEnd, nextStart, nextEnd } = period;
  const results = profiles.map((profile) => ({ id: profile.id, name: profile.name, buckets: emptyBuckets() }));
  const byProfile = new Map(results.map((profile) => [profile.id, profile.buckets]));
  const series = new Map<string, WeeklySummaryTask[]>();
  for (const task of tasks) {
    const buckets = byProfile.get(task.profileId);
    if (!buckets) continue;
    const completion = task.completedOn ?? (task.completedAt ? getBrisbaneDate(task.completedAt) : null);
    const link: SummaryTaskLink = {
      id: task.id, title: task.title, profileId: task.profileId,
      startDate: task.startDate, dueAt: task.dueAt, completedOn: completion,
    };
    const completed = inRange(completion, weekStart, asOf);
    const completedPrevious = inRange(completion, previousStart, previousEnd);
    const open = !completion;
    if (recurring(task)) {
      if (completed) buckets.repeatCompleted.push(link);
      if (completedPrevious) buckets.repeatCompletedPrevious.push(link);
      if (open && !task.projectArchived && task.startDate <= today && !paused(task, today)) buckets.repeatOutstanding.push(link);
      if (inRange(task.startDate, weekStart, weekEnd) && (completion || (!task.projectArchived && !paused(task, task.startDate)))) {
        buckets.repeatScheduled.push(link);
      }
      if (task.projectArchived) continue;
      const key = `${task.profileId}:${task.recurrenceSeriesId ?? task.id}`;
      const rows = series.get(key) ?? [];
      rows.push(task);
      series.set(key, rows);
      continue;
    }
    if (completed) buckets.completed.push(link);
    if (completedPrevious) buckets.completedPrevious.push(link);
    if (open && task.projectArchived) continue;
    if (inRange(task.startDate, weekStart, weekEnd)) buckets.starting.push(link);
    if (open && inRange(task.startDate, nextStart, nextEnd)) buckets.startingNext.push(link);
    if (open && task.startDate <= today) buckets.active.push(link);
    if (open && inRange(task.dueAt, weekStart, weekEnd)) buckets.due.push(link);
    if (open && task.dueAt && task.dueAt < today) buckets.overdue.push(link);

    const createdDate = getBrisbaneDate(task.createdAt);
    const thisWeekWork = task.startDate <= weekEnd || Boolean(task.dueAt && task.dueAt <= weekEnd);
    const atStart = createdDate < weekStart && (!completion || completion >= weekStart) && thisWeekWork;
    if (atStart) buckets.atStart.push(link);
    if (atStart && completed) buckets.completedFromStart.push(link);
    if (inRange(createdDate, weekStart, asOf)) {
      buckets[thisWeekWork ? "added" : "plannedAhead"].push(link);
    }
    if (open && thisWeekWork && createdDate <= asOf) buckets.remaining.push(link);
  }

  for (const rows of series.values()) {
    const latest = [...rows].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt))[0];
    if (latest.completedOn || latest.completedAt) continue;
    const existingDates = new Set(rows.map((task) => task.startDate));
    const buckets = byProfile.get(latest.profileId)!;
    for (let date = weekStart; date <= weekEnd; date = addDateOnlyDays(date, 1)) {
      if (!existingDates.has(date) && projectedOn(latest, date)) {
        buckets.repeatScheduled.push({
          id: latest.id, title: latest.title, profileId: latest.profileId,
          startDate: date, dueAt: null, completedOn: null, projected: true,
        });
      }
    }
  }
  const total = emptyBuckets();
  for (const profile of results) {
    for (const key of SUMMARY_METRICS) total[key].push(...profile.buckets[key]);
  }
  return { period, total, profiles: results };
}

export function weeklyProgressCopy(buckets: SummaryBuckets, period: WeeklySummaryPeriod) {
  const count = period.phase === "start" ? buckets.completedPrevious.length : buckets.completed.length;
  const when = period.phase === "start"
    ? period.today > period.weekEnd ? "in the preceding week" : "last week"
    : period.today > period.weekEnd ? "that week" : "this week";
  return count > 0
    ? `You completed ${count} ${count === 1 ? "task" : "tasks"} ${when}.`
    : period.phase === "start" ? "A little space to plan your week." : "A moment to see how your week is taking shape.";
}

export function weeklyWorkloadCopy(buckets: SummaryBuckets, period?: WeeklySummaryPeriod) {
  const baseline = buckets.atStart.length;
  const added = buckets.added.length;
  const completed = buckets.completed.length;
  const when = period && period.today > period.weekEnd ? "that week" : "this week";
  if (added > 0) {
    return `${baseline} on your list at the start; ${added} added for ${when}.${
      added > completed && completed > 0 ? " The list grew while you were making progress." : ""
    }`;
  }
  if (baseline > 0 && buckets.completedFromStart.length > 0) {
    return `${buckets.completedFromStart.length} of the ${baseline} tasks on your starting list completed. ${
      buckets.remaining.length === 0 ? "That leaves room to pause or plan ahead." : `${buckets.remaining.length} still on your list for ${when}.`
    }`;
  }
  return "A view of your workload, with room for plans to change.";
}
