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

function isRepeatPausedOnDate({ repeatPaused, repeatPauseUntil, date }) {
  if (!repeatPaused) return false;
  if (!repeatPauseUntil) return true;
  return dateValue(date) <= dateValue(repeatPauseUntil);
}

function nextDailyOccurrence(baseDate, repeatDays) {
  let nextDate = addDays(baseDate, 1);
  while ((repeatDays & (1 << (nextDate.getDay() === 0 ? 6 : nextDate.getDay() - 1))) === 0) {
    nextDate = addDays(nextDate, 1);
  }
  return nextDate;
}

function nextDailyOccurrenceAfterPause({ baseDate, repeatDays, repeatPaused, repeatPauseUntil }) {
  if (repeatPaused && !repeatPauseUntil) return null;

  let nextDate = nextDailyOccurrence(baseDate, repeatDays);
  while (isRepeatPausedOnDate({ repeatPaused, repeatPauseUntil, date: nextDate })) {
    nextDate = nextDailyOccurrence(nextDate, repeatDays);
  }
  return nextDate;
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
