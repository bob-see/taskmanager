const ALL_REPEAT_DAYS_MASK = 0b1111111;

export type RoutineSummaryTask = {
  id: string;
  projectId: string | null;
  startDate: Date;
  completedAt: Date | null;
  completedOn: Date | null;
  recurrenceSeriesId: string | null;
  repeatEnabled: boolean;
  repeatPattern: string | null;
  repeatDays: number | null;
  repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null;
  repeatPaused: boolean;
  repeatPauseUntil: Date | null;
};

export type RoutineSummaryProject = {
  id: string;
  name: string;
};

export type SundayCheckInSummary = {
  completedTasks: number;
  bestCompletionDay: { day: string; count: number } | null;
  routineStreaks: Array<{ projectName: string; days: number }>;
};

const ROUTINE_PROJECT_NAMES = new Set(["morning", "afternoon", "nighttime"]);

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateValue(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, amount: number) {
  const date = parseDateValue(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateValue(date);
}

function weekdayNumber(value: string) {
  const weekday = parseDateValue(value).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function repeatDayBit(weekday: number) {
  return 1 << (weekday - 1);
}

function matchesRepeatDays(value: string, repeatDays: number | null) {
  const mask = repeatDays ?? ALL_REPEAT_DAYS_MASK;
  return (mask & repeatDayBit(weekdayNumber(value))) !== 0;
}

function isRecurringTask(task: RoutineSummaryTask) {
  return Boolean(task.recurrenceSeriesId || task.repeatEnabled || task.repeatPattern);
}

function taskSeriesKey(task: RoutineSummaryTask) {
  return task.recurrenceSeriesId ? `series:${task.recurrenceSeriesId}` : `task:${task.id}`;
}

function isRepeatPausedOnDate(task: RoutineSummaryTask, value: string) {
  if (!isRecurringTask(task) || !task.repeatPaused) return false;
  const pauseUntil = task.repeatPauseUntil ? dateValue(task.repeatPauseUntil) : "";
  return pauseUntil === "" || value <= pauseUntil;
}

function isRecurringTaskDueOnDate(task: RoutineSummaryTask, value: string) {
  if (!isRecurringTask(task)) return true;
  if (isRepeatPausedOnDate(task, value)) return false;
  if (dateValue(task.startDate) > value) return false;

  if (task.repeatPattern === "daily") {
    return matchesRepeatDays(value, task.repeatDays);
  }

  if (task.repeatPattern === "weekly") {
    const repeatDays =
      task.repeatDays ??
      (task.repeatWeeklyDay ? repeatDayBit(task.repeatWeeklyDay) : null);
    return matchesRepeatDays(value, repeatDays);
  }

  if (task.repeatPattern === "monthly") {
    return (
      parseDateValue(value).getUTCDate() ===
      (task.repeatMonthlyDay ?? task.startDate.getUTCDate())
    );
  }

  return true;
}

function getRoutineStreak(
  tasks: RoutineSummaryTask[],
  projectId: string,
  today: string
) {
  const routineTasks = tasks.filter(
    (task) => task.projectId === projectId && isRecurringTask(task)
  );
  if (routineTasks.length === 0) return 0;

  const tasksBySeries = new Map<string, RoutineSummaryTask[]>();
  for (const task of routineTasks) {
    const key = taskSeriesKey(task);
    const seriesTasks = tasksBySeries.get(key) ?? [];
    seriesTasks.push(task);
    tasksBySeries.set(key, seriesTasks);
  }

  for (const seriesTasks of tasksBySeries.values()) {
    seriesTasks.sort((left, right) =>
      dateValue(left.startDate).localeCompare(dateValue(right.startDate))
    );
  }

  const earliestStart = routineTasks.reduce((earliest, task) => {
    const start = dateValue(task.startDate);
    return start < earliest ? start : earliest;
  }, dateValue(routineTasks[0].startDate));

  const completedSeriesByDate = new Map<string, Set<string>>();
  for (const task of routineTasks) {
    if (!task.completedAt || !task.completedOn) continue;
    const completionDate = dateValue(task.completedOn);
    const completedSeries = completedSeriesByDate.get(completionDate) ?? new Set();
    completedSeries.add(taskSeriesKey(task));
    completedSeriesByDate.set(completionDate, completedSeries);
  }

  function expectedSeries(value: string) {
    const expected = new Set<string>();
    for (const [seriesKey, seriesTasks] of tasksBySeries) {
      let representative: RoutineSummaryTask | undefined;
      for (let index = seriesTasks.length - 1; index >= 0; index -= 1) {
        if (dateValue(seriesTasks[index].startDate) <= value) {
          representative = seriesTasks[index];
          break;
        }
      }
      if (representative && isRecurringTaskDueOnDate(representative, value)) {
        expected.add(seriesKey);
      }
    }
    return expected;
  }

  function isComplete(value: string, expected: Set<string>) {
    const completed = completedSeriesByDate.get(value) ?? new Set<string>();
    return [...expected].every((seriesKey) => completed.has(seriesKey));
  }

  let cursor = today;
  const expectedToday = expectedSeries(today);
  if (expectedToday.size === 0 || !isComplete(today, expectedToday)) {
    cursor = addDays(today, -1);
  }

  let streak = 0;
  while (cursor >= earliestStart) {
    const expected = expectedSeries(cursor);
    if (expected.size > 0) {
      if (!isComplete(cursor, expected)) break;
      streak += 1;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function buildSundayCheckInSummary(
  tasks: RoutineSummaryTask[],
  projects: RoutineSummaryProject[],
  weekStart: string,
  today: string
): SundayCheckInSummary {
  const weekEnd = addDays(weekStart, 6);
  const weeklyCompletions = tasks.filter((task) => {
    if (!task.completedAt || !task.completedOn) return false;
    const completedOn = dateValue(task.completedOn);
    return completedOn >= weekStart && completedOn <= weekEnd;
  });

  const completionsByDay = new Map<string, number>();
  for (const task of weeklyCompletions) {
    const completedOn = dateValue(task.completedOn!);
    completionsByDay.set(completedOn, (completionsByDay.get(completedOn) ?? 0) + 1);
  }

  const bestDayEntry = [...completionsByDay.entries()].sort(
    ([leftDate, leftCount], [rightDate, rightCount]) =>
      rightCount - leftCount || leftDate.localeCompare(rightDate)
  )[0];

  return {
    completedTasks: weeklyCompletions.length,
    bestCompletionDay: bestDayEntry
      ? {
          day: parseDateValue(bestDayEntry[0]).toLocaleDateString("en-AU", {
            weekday: "long",
            timeZone: "UTC",
          }),
          count: bestDayEntry[1],
        }
      : null,
    routineStreaks: projects
      .filter((project) =>
        ROUTINE_PROJECT_NAMES.has(project.name.trim().toLocaleLowerCase())
      )
      .map((project) => ({
        projectName: project.name,
        days: getRoutineStreak(tasks, project.id, today),
      })),
  };
}
