import assert from "node:assert/strict";
import test from "node:test";

import {
  addDateOnlyDays,
  advanceDateIfCurrent,
  formatAustralianDate,
  formatBrisbaneTimestamp,
  getBrisbaneDate,
  getBrisbaneSnapshot,
  getGreetingForHour,
  getMondayWeekStart,
  millisecondsUntilNextBrisbaneDay,
  millisecondsUntilNextBrisbaneSnapshotBoundary,
  parseDateOnly,
} from "../app/lib/date-time.ts";

test("date-only values remain calendar dates", () => {
  const date = parseDateOnly("2026-07-11");

  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 11);
  assert.throws(() => parseDateOnly("2026-02-30"), /Invalid date-only value/);
  assert.equal(addDateOnlyDays("2026-07-31", 1), "2026-08-01");
});

test("Australian long and short dates are deterministic", () => {
  assert.equal(
    formatAustralianDate("2026-07-11", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    "Sat, 11 July 2026"
  );
  assert.equal(
    formatAustralianDate("2026-07-11", { month: "short", day: "numeric" }),
    "11 July"
  );
});

test("instant timestamps are formatted in Brisbane with an explicit hour cycle", () => {
  assert.equal(
    formatBrisbaneTimestamp("2026-06-21T10:53:00.000Z", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    }),
    "21 June 2026, 8:53 pm"
  );
  assert.equal(
    formatBrisbaneTimestamp("2026-06-21T10:53:00.000Z", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    "20:53"
  );
});

test("Brisbane snapshots respect the UTC day boundary", () => {
  assert.deepEqual(getBrisbaneSnapshot("2026-07-17T13:59:59.000Z"), {
    date: "2026-07-17",
    hour: 23,
  });
  assert.deepEqual(getBrisbaneSnapshot("2026-07-17T14:00:00.000Z"), {
    date: "2026-07-18",
    hour: 0,
  });
});

test("long-lived clients can schedule and apply Brisbane midnight rollover", () => {
  assert.equal(
    millisecondsUntilNextBrisbaneDay("2026-07-17T13:59:59.000Z"),
    1_000
  );
  assert.equal(
    millisecondsUntilNextBrisbaneDay("2026-07-17T14:00:00.000Z"),
    86_400_000
  );
  assert.equal(
    advanceDateIfCurrent("2026-07-17", "2026-07-17", "2026-07-18"),
    "2026-07-18"
  );
  assert.equal(
    advanceDateIfCurrent("2026-07-10", "2026-07-17", "2026-07-18"),
    "2026-07-10"
  );
});

test("home snapshots schedule noon, evening, and midnight boundaries", () => {
  assert.equal(
    millisecondsUntilNextBrisbaneSnapshotBoundary("2026-07-18T01:59:59.000Z"),
    1_000
  );
  assert.equal(
    millisecondsUntilNextBrisbaneSnapshotBoundary("2026-07-18T02:00:00.000Z"),
    6 * 60 * 60 * 1_000
  );
  assert.equal(
    millisecondsUntilNextBrisbaneSnapshotBoundary("2026-07-18T07:59:59.000Z"),
    1_000
  );
  assert.equal(
    millisecondsUntilNextBrisbaneSnapshotBoundary("2026-07-18T08:00:00.000Z"),
    6 * 60 * 60 * 1_000
  );
  assert.equal(
    millisecondsUntilNextBrisbaneSnapshotBoundary("2026-07-18T14:00:00.000Z"),
    12 * 60 * 60 * 1_000
  );
});

test("timesheet weeks roll from Sunday to the new Monday", () => {
  const sundayWeek = getMondayWeekStart("2026-07-19");
  const mondayWeek = getMondayWeekStart("2026-07-20");

  assert.equal(sundayWeek, "2026-07-13");
  assert.equal(mondayWeek, "2026-07-20");
  assert.equal(
    advanceDateIfCurrent(sundayWeek, sundayWeek, mondayWeek),
    mondayWeek
  );
  assert.equal(
    advanceDateIfCurrent("2026-07-06", sundayWeek, mondayWeek),
    "2026-07-06"
  );
});

test("action-time Brisbane dates use the new day immediately after midnight", () => {
  assert.equal(getBrisbaneDate("2026-07-17T13:59:59.000Z"), "2026-07-17");
  assert.equal(getBrisbaneDate("2026-07-17T14:00:00.000Z"), "2026-07-18");
});

test("greeting boundaries remain noon and 6 pm", () => {
  assert.equal(getGreetingForHour(11), "Good morning");
  assert.equal(getGreetingForHour(12), "Good afternoon");
  assert.equal(getGreetingForHour(17), "Good afternoon");
  assert.equal(getGreetingForHour(18), "Good evening");
});
