import {
  addDays,
  formatHours,
  parseDateOnly,
  startOfWeek,
  toDateOnly,
} from "@/app/timesheets/timesheet-utils";
import {
  getDayInsightMetrics,
  getMonthInsightMetrics,
  getPeriodRange,
  getWeekInsightMetrics,
  type InsightTask,
} from "@/app/p/[profileId]/tracker-insights";

export type ReportPeriod = "day" | "week" | "month";

export type ReportTask = InsightTask & {
  id: string;
  title: string;
  notes: string | null;
  profileId: string;
  profileName: string;
  projectName: string | null;
  updatedAt: string;
};

export type ReportTimeEntry = {
  profileId: string;
  profileName: string;
  entryDate: string;
  loggedMinutes: number;
};

export type BreakdownItem = {
  label: string;
  count: number;
};

export type TimeBreakdownItem = {
  label: string;
  minutes: number;
};

export type TaskDetailStatusScope = "completed" | "incomplete-with-notes" | "both";

export type TaskDetailReportItem = {
  id: string;
  title: string;
  notes: string | null;
  profileName: string;
  projectName: string | null;
  category: string | null;
  status: "completed" | "incomplete";
  startDate: string;
  dueAt: string | null;
  completedOn: string | null;
  completedAt: string | null;
  activityDate: string;
};

export function normalizeSelectedDate(value: string | null | undefined) {
  if (!value) {
    return toDateOnly(new Date());
  }

  return toDateOnly(parseDateOnly(value));
}

export function getRangeDays(selectedDate: string, period: ReportPeriod) {
  const { start, end } = getPeriodRange(selectedDate, period, true);
  const days: string[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(toDateOnly(cursor));
  }

  return {
    start,
    end,
    days,
  };
}

export function getPeriodLabel(selectedDate: string, period: ReportPeriod) {
  if (period === "day") {
    return parseDateOnly(selectedDate).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  if (period === "week") {
    const weekStart = startOfWeek(parseDateOnly(selectedDate));
    const weekEnd = addDays(weekStart, 6);
    return `${weekStart.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} to ${weekEnd.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return parseDateOnly(selectedDate).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function shiftSelectedDate(selectedDate: string, period: ReportPeriod, direction: -1 | 1) {
  const date = parseDateOnly(selectedDate);

  if (period === "day") {
    return toDateOnly(addDays(date, direction));
  }

  if (period === "week") {
    return toDateOnly(addDays(date, direction * 7));
  }

  return toDateOnly(new Date(date.getFullYear(), date.getMonth() + direction, date.getDate()));
}

function getCompletedTasksInPeriod(tasks: ReportTask[], selectedDate: string, period: ReportPeriod) {
  const { startValue, endValue } = getPeriodRange(selectedDate, period, true);
  return tasks.filter(
    (task) => task.completedOn && task.completedOn >= startValue && task.completedOn <= endValue
  );
}

export function getCompletedTaskDetails(
  tasks: ReportTask[],
  selectedDate: string,
  period: ReportPeriod
) {
  return getTaskDetailReport(tasks, selectedDate, period, "completed");
}

export function getTaskDetailReport(
  tasks: ReportTask[],
  selectedDate: string,
  period: ReportPeriod,
  statusScope: TaskDetailStatusScope = "completed"
) {
  const { startValue, endValue } = getPeriodRange(selectedDate, period, true);
  const includeCompleted = statusScope === "completed" || statusScope === "both";
  const includeIncompleteWithNotes =
    statusScope === "incomplete-with-notes" || statusScope === "both";

  return tasks
    .filter((task) => {
      if (includeCompleted && task.completedOn && task.completedOn >= startValue && task.completedOn <= endValue) {
        return true;
      }

      const notes = task.notes?.trim();
      if (!includeIncompleteWithNotes || task.completedAt || task.completedOn || !notes) {
        return false;
      }

      // Task notes do not have their own timestamp, so updatedAt is the best
      // available proxy for note activity within the reporting period.
      return task.updatedAt >= startValue && task.updatedAt <= endValue;
    })
    .map(
      (task): TaskDetailReportItem => ({
        id: task.id,
        title: task.title,
        notes: task.notes?.trim() || null,
        profileName: task.profileName,
        projectName: task.projectName,
        category: task.category,
        status: task.completedOn ? "completed" : "incomplete",
        startDate: task.startDate,
        dueAt: task.dueAt,
        completedOn: task.completedOn,
        completedAt: task.completedAt,
        activityDate: task.completedAt ?? task.completedOn ?? task.updatedAt,
      })
    )
    .sort((left, right) => {
      const leftKey = left.activityDate;
      const rightKey = right.activityDate;
      return rightKey.localeCompare(leftKey) || right.title.localeCompare(left.title);
    });
}

function getTopBreakdown<T>(
  items: T[],
  getLabel: (item: T) => string,
  limit = 5
) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const label = getLabel(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

export function getProductivityReport(tasks: ReportTask[], selectedDate: string, period: ReportPeriod) {
  const range = getPeriodRange(selectedDate, period, true);
  const completedTasks = getCompletedTasksInPeriod(tasks, selectedDate, period);
  const createdCount = tasks.filter(
    (task) => task.createdAt >= range.startValue && task.createdAt <= range.endValue
  ).length;
  const openTasks = tasks.filter((task) => {
    if (task.completedAt) return false;
    return task.startDate <= range.endValue;
  }).length;
  const overdueTasks = tasks.filter((task) => {
    if (task.completedAt || !task.dueAt) return false;
    return task.dueAt < range.endValue;
  }).length;

  const daySummary = period === "day" ? getDayInsightMetrics(tasks, selectedDate) : null;
  const weekSummary =
    period === "week" ? getWeekInsightMetrics(tasks, selectedDate, true, "calendar-days") : null;
  const monthSummary =
    period === "month" ? getMonthInsightMetrics(tasks, selectedDate, true, "calendar-days") : null;

  return {
    completedCount:
      period === "day"
        ? daySummary?.completedToday ?? 0
        : period === "week"
          ? weekSummary?.completedCount ?? 0
          : monthSummary?.completedCount ?? 0,
    createdCount,
    openTasks,
    overdueTasks,
    backlogCount:
      period === "day"
        ? daySummary?.rolledOver ?? 0
        : period === "week"
          ? weekSummary?.backlogCount ?? 0
          : monthSummary?.backlogSnapshotCount ?? 0,
    averagePerDay:
      period === "day"
        ? null
        : period === "week"
          ? weekSummary?.avgPerDay ?? 0
          : monthSummary?.avgPerDay ?? 0,
    topProjects: getTopBreakdown(
      completedTasks,
      (task) => task.projectName?.trim() || "Unassigned"
    ),
    topCategories: getTopBreakdown(
      completedTasks,
      (task) => task.category?.trim() || "Uncategorized"
    ),
  };
}

export function getTimeReport(entries: ReportTimeEntry[], selectedDate: string, period: ReportPeriod) {
  const { start, end, days } = getRangeDays(selectedDate, period);
  const startValue = toDateOnly(start);
  const endValue = toDateOnly(end);
  const rangeEntries = entries.filter(
    (entry) => entry.entryDate >= startValue && entry.entryDate <= endValue
  );
  const totalMinutes = rangeEntries.reduce((sum, entry) => sum + entry.loggedMinutes, 0);
  const dayTotals = new Map<string, number>();
  for (const day of days) {
    dayTotals.set(day, 0);
  }
  for (const entry of rangeEntries) {
    dayTotals.set(entry.entryDate, (dayTotals.get(entry.entryDate) ?? 0) + entry.loggedMinutes);
  }
  const loggedDayCount = Array.from(dayTotals.values()).filter((minutes) => minutes > 0).length;
  const averagePerDay =
    period === "day" ? null : loggedDayCount === 0 ? null : totalMinutes / loggedDayCount;

  let breakdown: TimeBreakdownItem[];
  if (period === "month") {
    const byWeek = new Map<string, number>();
    for (const entry of rangeEntries) {
      const weekKey = toDateOnly(startOfWeek(parseDateOnly(entry.entryDate)));
      byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + entry.loggedMinutes);
    }
    breakdown = Array.from(byWeek.entries())
      .map(([label, minutes]) => ({ label, minutes }))
      .sort((left, right) => left.label.localeCompare(right.label));
  } else {
    breakdown = Array.from(dayTotals.entries()).map(([label, minutes]) => ({ label, minutes }));
  }

  return {
    totalMinutes,
    averagePerDay,
    loggedDayCount: period === "day" ? null : loggedDayCount,
    breakdown,
  };
}

function bestCountPeriod(items: Array<{ key: string; value: number }>) {
  return items.sort((left, right) => right.value - left.value || left.key.localeCompare(right.key))[0] ?? null;
}

export function getBestTaskPeriods(tasks: ReportTask[]) {
  const dayCounts = new Map<string, number>();
  const weekCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();

  for (const task of tasks) {
    if (!task.completedOn) continue;
    dayCounts.set(task.completedOn, (dayCounts.get(task.completedOn) ?? 0) + 1);
    const completedDate = parseDateOnly(task.completedOn);
    const weekKey = toDateOnly(startOfWeek(completedDate));
    const monthKey = `${completedDate.getFullYear()}-${`${completedDate.getMonth() + 1}`.padStart(2, "0")}`;
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
    monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
  }

  return {
    bestDay: bestCountPeriod(Array.from(dayCounts.entries()).map(([key, value]) => ({ key, value }))),
    bestWeek: bestCountPeriod(Array.from(weekCounts.entries()).map(([key, value]) => ({ key, value }))),
    bestMonth: bestCountPeriod(Array.from(monthCounts.entries()).map(([key, value]) => ({ key, value }))),
  };
}

export function getBestTimePeriods(entries: ReportTimeEntry[]) {
  const dayTotals = new Map<string, number>();
  const weekTotals = new Map<string, number>();
  const monthTotals = new Map<string, number>();

  for (const entry of entries) {
    dayTotals.set(entry.entryDate, (dayTotals.get(entry.entryDate) ?? 0) + entry.loggedMinutes);
    const date = parseDateOnly(entry.entryDate);
    const weekKey = toDateOnly(startOfWeek(date));
    const monthKey = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
    weekTotals.set(weekKey, (weekTotals.get(weekKey) ?? 0) + entry.loggedMinutes);
    monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + entry.loggedMinutes);
  }

  return {
    bestDay: bestCountPeriod(Array.from(dayTotals.entries()).map(([key, value]) => ({ key, value }))),
    bestWeek: bestCountPeriod(Array.from(weekTotals.entries()).map(([key, value]) => ({ key, value }))),
    bestMonth: bestCountPeriod(Array.from(monthTotals.entries()).map(([key, value]) => ({ key, value }))),
  };
}

function getEfficiencyPeriod<T extends { key: string; completed: number; minutes: number }>(items: T[]) {
  return items
    .filter((item) => item.completed > 0 && item.minutes > 0)
    .sort(
      (left, right) =>
        right.completed / right.minutes - left.completed / left.minutes ||
        left.key.localeCompare(right.key)
    )[0] ?? null;
}

export function getBestEfficiencyPeriods(tasks: ReportTask[], entries: ReportTimeEntry[]) {
  const dayCompleted = new Map<string, number>();
  const weekCompleted = new Map<string, number>();
  const monthCompleted = new Map<string, number>();
  const dayMinutes = new Map<string, number>();
  const weekMinutes = new Map<string, number>();
  const monthMinutes = new Map<string, number>();

  for (const task of tasks) {
    if (!task.completedOn) continue;
    dayCompleted.set(task.completedOn, (dayCompleted.get(task.completedOn) ?? 0) + 1);
    const date = parseDateOnly(task.completedOn);
    const weekKey = toDateOnly(startOfWeek(date));
    const monthKey = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
    weekCompleted.set(weekKey, (weekCompleted.get(weekKey) ?? 0) + 1);
    monthCompleted.set(monthKey, (monthCompleted.get(monthKey) ?? 0) + 1);
  }

  for (const entry of entries) {
    dayMinutes.set(entry.entryDate, (dayMinutes.get(entry.entryDate) ?? 0) + entry.loggedMinutes);
    const date = parseDateOnly(entry.entryDate);
    const weekKey = toDateOnly(startOfWeek(date));
    const monthKey = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
    weekMinutes.set(weekKey, (weekMinutes.get(weekKey) ?? 0) + entry.loggedMinutes);
    monthMinutes.set(monthKey, (monthMinutes.get(monthKey) ?? 0) + entry.loggedMinutes);
  }

  const dayItems = Array.from(new Set([...dayCompleted.keys(), ...dayMinutes.keys()])).map((key) => ({
    key,
    completed: dayCompleted.get(key) ?? 0,
    minutes: dayMinutes.get(key) ?? 0,
  }));
  const weekItems = Array.from(new Set([...weekCompleted.keys(), ...weekMinutes.keys()])).map((key) => ({
    key,
    completed: weekCompleted.get(key) ?? 0,
    minutes: weekMinutes.get(key) ?? 0,
  }));
  const monthItems = Array.from(new Set([...monthCompleted.keys(), ...monthMinutes.keys()])).map((key) => ({
    key,
    completed: monthCompleted.get(key) ?? 0,
    minutes: monthMinutes.get(key) ?? 0,
  }));

  return {
    bestDay: getEfficiencyPeriod(dayItems),
    bestWeek: getEfficiencyPeriod(weekItems),
    bestMonth: getEfficiencyPeriod(monthItems),
  };
}

export function getProfileComparisons(
  profiles: Array<{ id: string; name: string }>,
  tasks: ReportTask[],
  entries: ReportTimeEntry[],
  selectedDate: string,
  period: ReportPeriod
) {
  const range = getPeriodRange(selectedDate, period, true);
  return profiles.map((profile) => {
    const profileTasks = tasks.filter((task) => task.profileId === profile.id);
    const completed = profileTasks.filter(
      (task) => task.completedOn && task.completedOn >= range.startValue && task.completedOn <= range.endValue
    ).length;
    const minutes = entries
      .filter(
        (entry) =>
          entry.profileId === profile.id &&
          entry.entryDate >= range.startValue &&
          entry.entryDate <= range.endValue
      )
      .reduce((sum, entry) => sum + entry.loggedMinutes, 0);

    return {
      profileId: profile.id,
      label: profile.name,
      completed,
      minutes,
      tasksPerHour: minutes > 0 ? completed / (minutes / 60) : null,
    };
  });
}

export function formatBestPeriodLabel(key: string, period: ReportPeriod | "month-key") {
  if (period === "day") {
    return parseDateOnly(key).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (period === "week") {
    const start = parseDateOnly(key);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} to ${end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  if (period === "month-key") {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  return key;
}

export function formatEfficiency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(2)} tasks/hr`;
}

export function formatHoursFromMinutes(minutes: number | null) {
  if (minutes === null) {
    return "—";
  }

  return formatHours(minutes);
}
