import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyTaskDigest,
  formatDailyTaskDigestBody,
  getLocalDigestSnapshot,
  isDailyTaskDigestDue,
  normaliseDailyTaskDigestSettings,
} from "../app/lib/daily-task-digest.ts";

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

test("daily digest includes owned eligible tasks once and excludes delegated or completed work", () => {
  const digest = buildDailyTaskDigest([
    { id: "both", title: "Prepare appraisal", startDate: date("2026-09-10"), dueAt: date("2026-09-10"), completedOn: null },
    { id: "due", title: "Send contract", startDate: date("2026-09-01"), dueAt: date("2026-09-10"), completedOn: null },
    { id: "overdue", title: "Call vendor", startDate: date("2026-09-01"), dueAt: date("2026-09-09"), completedOn: null },
    { id: "delegated", title: "Someone else's task", startDate: date("2026-09-10"), dueAt: null, completedOn: null, delegatedTask: { id: "delegate" } },
    { id: "done", title: "Already done", startDate: date("2026-09-10"), dueAt: null, completedOn: date("2026-09-10") },
  ], "2026-09-10");

  assert.deepEqual(digest.groups.map((group) => [group.label, group.tasks.map((task) => task.id)]), [
    ["Starting today", ["both"]],
    ["Due today", ["due"]],
    ["Overdue", ["overdue"]],
  ]);
  assert.equal(digest.tasks.length, 3);
  assert.deepEqual(digest.tasks.find((task) => task.id === "both")?.states, ["Starting today", "Due today"]);
  assert.match(
    formatDailyTaskDigestBody(digest),
    /Starting today \(1\): Prepare appraisal \(Starting today \+ Due today\)/
  );
});

test("weekday scheduling honours the configured local timezone and five-minute scheduler window", () => {
  const settings = normaliseDailyTaskDigestSettings({
    time: "08:30",
    timeZone: "America/Los_Angeles",
    daysOfWeek: [1, 2, 3, 4, 5],
  });
  const mondayAtTime = new Date("2026-09-14T15:32:00.000Z"); // Monday 8:32 am PDT
  const sundayAtTime = new Date("2026-09-13T15:32:00.000Z");

  assert.deepEqual(getLocalDigestSnapshot(mondayAtTime, settings.timeZone), {
    date: "2026-09-14",
    minuteOfDay: 8 * 60 + 32,
    dayOfWeek: 1,
  });
  assert.equal(isDailyTaskDigestDue(mondayAtTime, settings), true);
  assert.equal(isDailyTaskDigestDue(new Date("2026-09-14T15:35:00.000Z"), settings), false);
  assert.equal(isDailyTaskDigestDue(sundayAtTime, settings), false);
});

test("date selection follows the user's timezone rather than the server calendar", () => {
  const now = new Date("2026-09-10T00:30:00.000Z");
  assert.equal(getLocalDigestSnapshot(now, "Australia/Brisbane").date, "2026-09-10");
  assert.equal(getLocalDigestSnapshot(now, "America/Los_Angeles").date, "2026-09-09");
});
