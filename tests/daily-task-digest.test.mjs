import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildDailyTaskDigest,
  formatDailyTaskDigestBody,
  getDailyTaskDigestSnapshot,
  isDailyTaskDigestScheduledToday,
  normaliseDailyTaskDigestSettings,
} from "../app/lib/daily-task-digest.ts";

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

test("daily digest includes owned eligible tasks once and excludes delegated or completed work", () => {
  const digest = buildDailyTaskDigest([
    { id: "both", title: "Prepare appraisal", startDate: date("2026-09-10"), dueAt: date("2026-09-10"), completedOn: null },
    { id: "start-2", title: "Call tenant", startDate: date("2026-09-10"), dueAt: null, completedOn: null },
    { id: "due", title: "Send contract", startDate: date("2026-09-01"), dueAt: date("2026-09-10"), completedOn: null },
    { id: "overdue", title: "Call vendor", startDate: date("2026-09-01"), dueAt: date("2026-09-09"), completedOn: null },
    { id: "delegated", title: "Someone else's task", startDate: date("2026-09-10"), dueAt: null, completedOn: null, delegatedTask: { id: "delegate" } },
    { id: "done", title: "Already done", startDate: date("2026-09-10"), dueAt: null, completedOn: date("2026-09-10") },
  ], "2026-09-10");

  assert.deepEqual(digest.groups.map((group) => [group.label, group.tasks.map((task) => task.id)]), [
    ["Starting today", ["both", "start-2"]],
    ["Due today", ["due"]],
    ["Overdue", ["overdue"]],
  ]);
  assert.equal(digest.tasks.length, 4);
  assert.deepEqual(digest.tasks.find((task) => task.id === "both")?.states, ["Starting today", "Due today"]);
  assert.match(
    formatDailyTaskDigestBody(digest),
    /^Starting today: 2 tasks\nDue today: 1 task\nOverdue: 1 task$/
  );
});

test("weekday scheduling uses the shared Brisbane 6:30 am schedule", () => {
  const settings = normaliseDailyTaskDigestSettings({
    daysOfWeek: [1, 2, 3, 4, 5],
  });
  const mondayAtTime = new Date("2026-09-13T20:30:00.000Z"); // Monday 6:30 am AEST
  const sundayAtTime = new Date("2026-09-12T20:30:00.000Z");

  assert.deepEqual(getDailyTaskDigestSnapshot(mondayAtTime), {
    date: "2026-09-14",
    minuteOfDay: 6 * 60 + 30,
    dayOfWeek: 1,
  });
  assert.equal(isDailyTaskDigestScheduledToday(mondayAtTime, settings), true);
  assert.equal(isDailyTaskDigestScheduledToday(sundayAtTime, settings), false);
});

test("Vercel invokes the digest at 6:30 am Brisbane time", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8")
  );
  assert.deepEqual(config.crons, [
    { path: "/api/cron/daily-task-digest", schedule: "30 20 * * *" },
  ]);
});

test("digest dates follow Brisbane rather than the server calendar", () => {
  const now = new Date("2026-09-10T00:30:00.000Z");
  assert.equal(getDailyTaskDigestSnapshot(now).date, "2026-09-10");
});
