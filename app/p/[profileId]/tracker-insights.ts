export type InsightViewMode = "day" | "week" | "month";
export type AverageBasis = "calendar-days" | "work-week";

export type InsightTask = {
  startDate: string;
  dueAt: string | null;
  completedAt: string | null;
  completedOn: string | null;
  createdAt: string;
  category: string | null;
  projectId: string | null;
};

type DateLike = Date | string | null | undefined;

type PeriodRange = {
  start: Date;
  end: Date;
  startValue: string;
  endValue: string;
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalDate(value: DateLike) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateOnly(value);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateValue(value: DateLike) {
  const date = toLocalDate(value);
  return date ? formatDateValue(date) : "";
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function countWeekdaysInRange(start: Date, end: Date) {
  let count = 0;

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    if (isWeekday(cursor)) {
      count += 1;
    }
  }

  return count;
}

function getAveragePerDay(completedCount: number, basisDays: number) {
  return basisDays === 0 ? 0 : completedCount / basisDays;
}

function getWeekStart(date: Date, weekStartsOnMonday: boolean) {
  if (!weekStartsOnMonday) {
    return addDays(date, -date.getDay());
  }

  const currentDay = date.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  return addDays(date, diff);
}

function isTaskCompleted(task: InsightTask) {
  return Boolean(task.completedAt);
}

function getCompletedTasksInRange(tasks: InsightTask[], start: Date, end: Date) {
  return tasks.filter(
    (task) => task.completedOn && inRangeInclusive(task.completedOn, start, end)
  );
}

function getTopBreakdown(
  tasks: InsightTask[],
  getLabel: (task: InsightTask) => string,
  limit = 5
) {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const label = getLabel(task);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

export function isSameLocalDay(a: DateLike, b: DateLike) {
  const left = toDateValue(a);
  const right = toDateValue(b);
  return left !== "" && left === right;
}

export function startOfWeekMon(date: DateLike) {
  const localDate = toLocalDate(date);
  if (!localDate) {
    throw new Error("Invalid date");
  }

  return getWeekStart(localDate, true);
}

export function endOfWeekSun(date: DateLike) {
  return addDays(startOfWeekMon(date), 6);
}

export function startOfMonth(date: DateLike) {
  const localDate = toLocalDate(date);
  if (!localDate) {
    throw new Error("Invalid date");
  }

  return new Date(localDate.getFullYear(), localDate.getMonth(), 1);
}

export function endOfMonth(date: DateLike) {
  const localDate = toLocalDate(date);
  if (!localDate) {
    throw new Error("Invalid date");
  }

  return new Date(localDate.getFullYear(), localDate.getMonth() + 1, 0);
}

export function inRangeInclusive(date: DateLike, start: DateLike, end: DateLike) {
  const dateValue = toDateValue(date);
  const startValue = toDateValue(start);
  const endValue = toDateValue(end);
  return dateValue !== "" && startValue !== "" && endValue !== ""
    ? dateValue >= startValue && dateValue <= endValue
    : false;
}

export function getPeriodRange(
  selectedDay: DateLike,
  viewMode: InsightViewMode,
  weekStartsOnMonday = true
): PeriodRange {
  const selectedDate = toLocalDate(selectedDay);
  if (!selectedDate) {
    throw new Error("Invalid selected day");
  }

  const start =
    viewMode === "month"
      ? startOfMonth(selectedDate)
      : viewMode === "week"
        ? getWeekStart(selectedDate, weekStartsOnMonday)
        : selectedDate;
  const end =
    viewMode === "month"
      ? endOfMonth(selectedDate)
      : viewMode === "week"
        ? addDays(start, 6)
        : selectedDate;

  return {
    start,
    end,
    startValue: formatDateValue(start),
    endValue: formatDateValue(end),
  };
}

export function getDayInsightMetrics(tasks: InsightTask[], selectedDay: DateLike) {
  const selectedDayValue = toDateValue(selectedDay);

  return {
    completedToday: tasks.filter((task) => isSameLocalDay(task.completedOn, selectedDay)).length,
    createdToday: tasks.filter((task) => isSameLocalDay(task.createdAt, selectedDay)).length,
    openToday: tasks.filter((task) => {
      if (isTaskCompleted(task)) return false;

      const startDateValue = toDateValue(task.startDate);
      const dueDateValue = toDateValue(task.dueAt);
      return startDateValue === selectedDayValue || dueDateValue === selectedDayValue;
    }).length,
    rolledOver: tasks.filter((task) => {
      if (isTaskCompleted(task)) return false;

      const startDateValue = toDateValue(task.startDate);
      return startDateValue !== "" && startDateValue < selectedDayValue;
    }).length,
  };
}

export function getWeekInsightMetrics(
  tasks: InsightTask[],
  selectedDay: DateLike,
  weekStartsOnMonday = true,
  averageBasis: AverageBasis = "calendar-days"
) {
  const { start, end, startValue, endValue } = getPeriodRange(
    selectedDay,
    "week",
    weekStartsOnMonday
  );
  const completedTasks = getCompletedTasksInRange(tasks, start, end);
  const dayCounts = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const count = completedTasks.filter((task) => isSameLocalDay(task.completedOn, date)).length;
    return { date, count };
  });
  const bestDay = dayCounts.reduce((best, current) =>
    current.count > best.count ? current : best
  );

  return {
    start,
    end,
    startValue,
    endValue,
    completedCount: completedTasks.length,
    basisDays: averageBasis === "work-week" ? 5 : 7,
    avgPerDay: getAveragePerDay(
      completedTasks.length,
      averageBasis === "work-week" ? 5 : 7
    ),
    bestDay,
    backlogCount: tasks.filter((task) => {
      if (isTaskCompleted(task)) return false;

      const startDateValue = toDateValue(task.startDate);
      const dueDateValue = toDateValue(task.dueAt);
      return (
        (startDateValue !== "" && startDateValue <= endValue) ||
        (dueDateValue !== "" && dueDateValue >= startValue && dueDateValue <= endValue)
      );
    }).length,
    completedTasks,
  };
}

export function getMonthInsightMetrics(
  tasks: InsightTask[],
  selectedDay: DateLike,
  weekStartsOnMonday = true,
  averageBasis: AverageBasis = "calendar-days"
) {
  const { start, end, startValue, endValue } = getPeriodRange(
    selectedDay,
    "month",
    weekStartsOnMonday
  );
  const completedTasks = getCompletedTasksInRange(tasks, start, end);
  const daysInMonth = end.getDate();
  const basisDays =
    averageBasis === "work-week" ? countWeekdaysInRange(start, end) : daysInMonth;
  const weekStarts = new Map<string, { start: Date; count: number }>();

  for (const task of completedTasks) {
    const completedDate = toLocalDate(task.completedOn);
    if (!completedDate) continue;

    const weekStart = getWeekStart(completedDate, weekStartsOnMonday);
    const key = formatDateValue(weekStart);
    const existing = weekStarts.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      weekStarts.set(key, { start: weekStart, count: 1 });
    }
  }

  const bestWeek =
    Array.from(weekStarts.values()).sort(
      (left, right) =>
        right.count - left.count || left.start.getTime() - right.start.getTime()
    )[0] ?? { start: getWeekStart(start, weekStartsOnMonday), count: 0 };

  return {
    start,
    end,
    startValue,
    endValue,
    completedCount: completedTasks.length,
    basisDays,
    avgPerDay: getAveragePerDay(completedTasks.length, basisDays),
    daysInMonth,
    bestWeek: {
      start: bestWeek.start,
      end: addDays(bestWeek.start, 6),
      count: bestWeek.count,
    },
    backlogSnapshotCount: tasks.filter((task) => {
      if (isTaskCompleted(task)) return false;

      const startDateValue = toDateValue(task.startDate);
      return startDateValue !== "" && startDateValue <= endValue;
    }).length,
    completedTasks,
  };
}

export function getCompletedBreakdowns(
  tasks: InsightTask[],
  selectedDay: DateLike,
  viewMode: Exclude<InsightViewMode, "day">,
  getProjectLabel: (task: InsightTask) => string
) {
  const { start, end } = getPeriodRange(selectedDay, viewMode, true);
  const completedTasks = getCompletedTasksInRange(tasks, start, end);

  return {
    topProjects: getTopBreakdown(completedTasks, getProjectLabel),
    topCategories: getTopBreakdown(
      completedTasks,
      (task) => task.category?.trim() || "Uncategorized"
    ),
  };
}
