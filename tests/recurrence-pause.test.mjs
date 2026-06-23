import assert from "node:assert/strict";
import test from "node:test";

function dateValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getWeekdayNumber(date) {
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

function getRepeatDayBit(weekday) {
  return 1 << (weekday - 1);
}

function matchesRepeatDays(date, repeatDays) {
  const mask = repeatDays ?? 0b1111111;
  return (mask & getRepeatDayBit(getWeekdayNumber(date))) !== 0;
}

function monthDifference(left, right) {
  return (
    (left.getFullYear() - right.getFullYear()) * 12 +
    left.getMonth() -
    right.getMonth()
  );
}

function isRepeatPausedOnDate({ repeatPaused, repeatPauseUntil, date }) {
  if (!repeatPaused) return false;
  if (!repeatPauseUntil) return true;
  return dateValue(date) <= dateValue(repeatPauseUntil);
}

function nextOccurrenceDate({
  baseDate,
  recurrenceType,
  repeatInterval = 1,
  repeatDays,
  weeklyDay,
  monthlyDay,
}) {
  const interval = Math.max(1, repeatInterval ?? 1);

  if (recurrenceType === "daily") {
    let nextDate = addDays(baseDate, interval);
    while (!matchesRepeatDays(nextDate, repeatDays)) {
      nextDate = addDays(nextDate, interval);
    }
    return nextDate;
  }

  if (recurrenceType === "weekly") {
    const targetWeekday = weeklyDay ?? getWeekdayNumber(baseDate);
    let diff = targetWeekday - getWeekdayNumber(baseDate);
    if (diff <= 0) diff += 7 * interval;
    return addDays(baseDate, diff);
  }

  const targetDay = monthlyDay ?? baseDate.getDate();
  const nextMonth = baseDate.getMonth() + interval;
  const year = baseDate.getFullYear() + Math.floor(nextMonth / 12);
  const month = ((nextMonth % 12) + 12) % 12;
  const maxDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(targetDay, maxDay));
}

function nextDailyOccurrence(baseDate, repeatDays) {
  return nextOccurrenceDate({
    baseDate,
    recurrenceType: "daily",
    repeatInterval: 1,
    repeatDays,
  });
}

function nextDailyOccurrenceAfterPause({
  baseDate,
  repeatInterval = 1,
  repeatDays,
  repeatPaused,
  repeatPauseUntil,
}) {
  if (repeatPaused && !repeatPauseUntil) return null;

  let nextDate = nextOccurrenceDate({
    baseDate,
    recurrenceType: "daily",
    repeatInterval,
    repeatDays,
  });
  while (isRepeatPausedOnDate({ repeatPaused, repeatPauseUntil, date: nextDate })) {
    nextDate = nextOccurrenceDate({
      baseDate: nextDate,
      recurrenceType: "daily",
      repeatInterval,
      repeatDays,
    });
  }
  return nextDate;
}

function isRecurringTaskDueOnDate(task, value) {
  if (!isRecurringTask(task)) return true;
  if (dateValue(task.startDate) > value) return false;
  const interval = Math.max(1, task.repeatInterval ?? 1);
  const currentDate = localDate(value);
  const startDate = localDate(dateValue(task.startDate));
  const days = Math.floor((currentDate.getTime() - startDate.getTime()) / 86400000);

  if (task.repeatPattern === "daily") {
    return days % interval === 0 && matchesRepeatDays(currentDate, task.repeatDays);
  }

  if (task.repeatPattern === "weekly") {
    return (
      Math.floor(days / 7) % interval === 0 &&
      matchesRepeatDays(
        currentDate,
        task.repeatDays ?? (task.repeatWeeklyDay ? getRepeatDayBit(task.repeatWeeklyDay) : null)
      )
    );
  }

  if (task.repeatPattern === "monthly") {
    return (
      monthDifference(currentDate, startDate) % interval === 0 &&
      currentDate.getDate() === (task.repeatMonthlyDay ?? startDate.getDate())
    );
  }

  return true;
}

function isRecurringTask(task) {
  return Boolean(task.recurrenceSeriesId || task.repeatEnabled || task.repeatPattern);
}

function filterTasksForView(tasks, view, selectedDate) {
  return tasks.filter((task) => {
    const paused = isRecurringTask(task)
      ? isRepeatPausedOnDate({
          repeatPaused: task.repeatPaused,
          repeatPauseUntil: task.repeatPauseUntil,
          date: selectedDate,
        })
      : false;

    if (view === "paused") {
      return isRecurringTask(task) && !task.completed && paused;
    }

    if (["active", "today", "upcoming", "overdue"].includes(view)) {
      return !paused;
    }

    return true;
  });
}

test("finite repeat pauses suppress dates through pause-until", () => {
  const pauseUntil = localDate("2026-06-26");

  assert.equal(
    isRepeatPausedOnDate({
      repeatPaused: true,
      repeatPauseUntil: pauseUntil,
      date: localDate("2026-06-26"),
    }),
    true
  );
  assert.equal(
    isRepeatPausedOnDate({
      repeatPaused: true,
      repeatPauseUntil: pauseUntil,
      date: localDate("2026-06-27"),
    }),
    false
  );
});

test("indefinite repeat pauses do not generate a next occurrence", () => {
  assert.equal(
    nextDailyOccurrenceAfterPause({
      baseDate: localDate("2026-06-18"),
      repeatDays: 0b1111111,
      repeatPaused: true,
      repeatPauseUntil: null,
    }),
    null
  );
});

test("finite repeat pauses advance generated occurrences past pause-until", () => {
  const next = nextDailyOccurrenceAfterPause({
    baseDate: localDate("2026-06-18"),
    repeatDays: 0b1111111,
    repeatPaused: true,
    repeatPauseUntil: localDate("2026-06-26"),
  });

  assert.equal(dateValue(next), "2026-06-27");
});

test("daily repeat intervals generate every x days", () => {
  const next = nextOccurrenceDate({
    baseDate: localDate("2026-06-18"),
    recurrenceType: "daily",
    repeatInterval: 2,
    repeatDays: 0b1111111,
  });

  assert.equal(dateValue(next), "2026-06-20");
});

test("weekly repeat interval 2 generates a fortnightly task", () => {
  const next = nextOccurrenceDate({
    baseDate: localDate("2026-06-15"),
    recurrenceType: "weekly",
    repeatInterval: 2,
    repeatDays: getRepeatDayBit(1),
    weeklyDay: 1,
  });

  assert.equal(dateValue(next), "2026-06-29");
});

test("routine expectations skip off-days for every two days", () => {
  const task = {
    id: "wash-hair",
    recurrenceSeriesId: "series-wash-hair",
    repeatEnabled: true,
    repeatPattern: "daily",
    repeatInterval: 2,
    repeatDays: 0b1111111,
    startDate: localDate("2026-06-18"),
  };

  assert.equal(isRecurringTaskDueOnDate(task, "2026-06-18"), true);
  assert.equal(isRecurringTaskDueOnDate(task, "2026-06-19"), false);
  assert.equal(isRecurringTaskDueOnDate(task, "2026-06-20"), true);
});

test("existing daily repeat interval default still behaves daily", () => {
  const next = nextOccurrenceDate({
    baseDate: localDate("2026-06-18"),
    recurrenceType: "daily",
    repeatDays: 0b1111111,
  });

  assert.equal(dateValue(next), "2026-06-19");
});

test("paused recurring tasks only appear in paused task view", () => {
  const pausedTask = {
    id: "paused",
    recurrenceSeriesId: "series-1",
    repeatEnabled: true,
    repeatPattern: "daily",
    repeatPaused: true,
    repeatPauseUntil: localDate("2026-07-28"),
    completed: false,
  };
  const regularTask = {
    id: "regular",
    recurrenceSeriesId: null,
    repeatEnabled: false,
    repeatPattern: null,
    repeatPaused: false,
    repeatPauseUntil: null,
    completed: false,
  };
  const selectedDate = localDate("2026-07-20");

  assert.deepEqual(
    filterTasksForView([pausedTask, regularTask], "active", selectedDate).map(
      (task) => task.id
    ),
    ["regular"]
  );
  assert.deepEqual(
    filterTasksForView([pausedTask, regularTask], "today", selectedDate).map(
      (task) => task.id
    ),
    ["regular"]
  );
  assert.deepEqual(
    filterTasksForView([pausedTask, regularTask], "upcoming", selectedDate).map(
      (task) => task.id
    ),
    ["regular"]
  );
  assert.deepEqual(
    filterTasksForView([pausedTask, regularTask], "overdue", selectedDate).map(
      (task) => task.id
    ),
    ["regular"]
  );
  assert.deepEqual(
    filterTasksForView([pausedTask, regularTask], "paused", selectedDate).map(
      (task) => task.id
    ),
    ["paused"]
  );
});

test("expired finite pauses behave as active again", () => {
  const task = {
    id: "expired",
    recurrenceSeriesId: "series-1",
    repeatEnabled: true,
    repeatPattern: "daily",
    repeatPaused: true,
    repeatPauseUntil: localDate("2026-07-01"),
    completed: false,
  };
  const selectedDate = localDate("2026-07-02");

  assert.deepEqual(
    filterTasksForView([task], "active", selectedDate).map((item) => item.id),
    ["expired"]
  );
  assert.deepEqual(
    filterTasksForView([task], "paused", selectedDate).map((item) => item.id),
    []
  );
});
