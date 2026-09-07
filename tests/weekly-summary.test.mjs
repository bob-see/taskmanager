import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  buildWeeklySummary, DEFAULT_WEEKLY_SUMMARY_SETTINGS as defaults,
  getWeeklySummaryPeriod, parseWeeklySummarySettings, SUMMARY_METRICS,
  weeklyProgressCopy, weeklyWorkloadCopy,
} from "../app/lib/weekly-summary.ts";
import { weeklySummaryHandlers } from "../app/lib/weekly-summary-service.ts";

const profiles = [{ id: "work", name: "Work" }, { id: "personal", name: "Personal" }];
function task(id, overrides = {}) {
  return {
    id, title: `Task ${id}`, profileId: "work", startDate: "2026-09-07", dueAt: null,
    createdAt: "2026-09-06T01:00:00Z", completedOn: null, completedAt: null, projectArchived: false,
    recurrenceSeriesId: null, repeatEnabled: false, repeatPattern: null, repeatInterval: 1,
    repeatDays: null, repeatWeeklyDay: null, repeatMonthlyDay: null,
    repeatPaused: false, repeatPauseUntil: null, ...overrides,
  };
}
function repeat(id, overrides = {}) {
  return task(id, { recurrenceSeriesId: "daily-series", repeatEnabled: true, repeatPattern: "daily", repeatDays: 31, ...overrides });
}
function summary(tasks, today = "2026-09-11", settings = defaults) {
  return buildWeeklySummary(profiles, tasks, today, settings);
}
function fiveTasks() {
  return Array.from({ length: 5 }, (_, index) => task(`${index}`, index < 4 ? { completedOn: "2026-09-10" } : {}));
}

test("four of five completed is recognised without a percentage or an overdue score", () => {
  const result = summary(fiveTasks());
  assert.equal(result.total.atStart.length, 5);
  assert.equal(result.total.completed.length, 4);
  assert.equal(result.total.remaining.length, 1);
  assert.equal(weeklyProgressCopy(result.total, result.period), "You completed 4 tasks this week.");
  assert.match(weeklyWorkloadCopy(result.total), /4 of the 5 tasks on your starting list completed/);
});

test("adding ten tasks explains workload growth while retaining four completions", () => {
  const added = Array.from({ length: 10 }, (_, index) => task(`new-${index}`, { createdAt: "2026-09-09T01:00:00Z" }));
  const result = summary([...fiveTasks(), ...added]);
  assert.equal(result.total.atStart.length, 5);
  assert.equal(result.total.added.length, 10);
  assert.equal(result.total.completed.length, 4);
  assert.equal(result.total.remaining.length, 11);
  assert.match(weeklyWorkloadCopy(result.total), /5 on your list at the start; 10 added/);
  assert.match(weeklyWorkloadCopy(result.total), /grew while you were making progress/);
});

test("new-task completions are not attributed to the original starting list", () => {
  const tasks = [task("old"), task("new", { createdAt: "2026-09-09T01:00:00Z", completedOn: "2026-09-10" })];
  const result = summary(tasks);
  assert.equal(result.total.completed.length, 1);
  assert.equal(result.total.completedFromStart.length, 0);
  assert.doesNotMatch(weeklyWorkloadCopy(result.total), /1 of the 1/);
});

test("planning ahead is separate, but a due date this week still brings work into scope", () => {
  const createdAt = "2026-09-09T01:00:00Z";
  const result = summary([
    task("later", { startDate: "2026-09-15", createdAt }),
    task("due", { startDate: "2026-09-15", dueAt: "2026-09-11", createdAt }),
  ]);
  assert.deepEqual(result.total.plannedAhead.map((row) => row.id), ["later"]);
  assert.deepEqual(result.total.added.map((row) => row.id), ["due"]);
  assert.equal(result.total.remaining.length, 1);
});

test("overdue includes carried work, but future and completed tasks are not active", () => {
  const result = summary([
    task("carry", { startDate: "2026-08-01", dueAt: "2026-09-06" }),
    task("due-today", { dueAt: "2026-09-11" }),
    task("done", { dueAt: "2026-09-10", completedOn: "2026-09-10" }),
    task("future", { startDate: "2026-09-14" }),
  ]);
  assert.deepEqual(result.total.overdue.map((row) => row.id), ["carry"]);
  assert.equal(result.total.active.length, 2);
  assert.equal(result.total.due.length, 1);
  assert.equal(result.total.startingNext.length, 1);
});

test("archived project work is not outstanding workload, but its completed work is recognised", () => {
  const result = summary([
    task("archived", { projectArchived: true, dueAt: "2026-09-10" }),
    task("done", { projectArchived: true, completedOn: "2026-09-10" }),
    repeat("archived-repeat", { projectArchived: true }),
    repeat("done-repeat", { projectArchived: true, completedOn: "2026-09-10" }),
  ]);
  assert.equal(result.total.completed.length, 1);
  assert.equal(result.total.repeatCompleted.length, 1);
  for (const metric of ["active", "overdue", "remaining", "repeatOutstanding"]) assert.equal(result.total[metric].length, 0);
  assert.equal(result.total.repeatScheduled.length, 1);
});

test("Monday uses previous Monday through Sunday completions with Brisbane timestamp fallback", () => {
  const result = summary([
    task("sunday", { completedOn: "2026-09-06" }),
    task("monday", { completedOn: "2026-09-07" }),
    task("old", { completedOn: "2026-08-30" }),
    task("instant", { completedAt: "2026-09-06T14:01:00Z" }),
    task("created-monday", { createdAt: "2026-09-06T14:00:00Z" }),
  ], "2026-09-07");
  assert.equal(result.total.completedPrevious.length, 1);
  assert.equal(result.total.completed.length, 2);
  assert.equal(result.total.added.length, 1);
  assert.equal(result.period.phase, "start");
});

test("custom display days preserve reporting boundaries, latest briefing and dismissal identity", () => {
  const monday = getWeeklySummaryPeriod("2026-09-07", defaults);
  const thursday = getWeeklySummaryPeriod("2026-09-10", defaults);
  const friday = getWeeklySummaryPeriod("2026-09-11", defaults);
  assert.equal(monday.key, thursday.key);
  assert.notEqual(monday.key, friday.key);
  assert.equal(getWeeklySummaryPeriod("2026-09-14", defaults).key, "start:2026-09-14");
  const custom = getWeeklySummaryPeriod("2026-09-07", { ...defaults, startDay: 2, endDay: 6 });
  assert.equal(custom.key, "end:2026-09-05");
  assert.equal(custom.weekStart, "2026-08-31");
  assert.equal(custom.asOf, "2026-09-06");
  assert.equal(getWeeklySummaryPeriod("2027-01-01", defaults).weekStart, "2026-12-28");
});

test("five weekday repeat occurrences are separate from ordinary work and outstanding rows", () => {
  const result = summary([repeat("monday"), task("ordinary")], "2026-09-07");
  assert.equal(result.total.repeatScheduled.length, 5);
  assert.equal(result.total.repeatScheduled.filter((row) => row.projected).length, 4);
  assert.equal(result.total.repeatOutstanding.length, 1);
  assert.equal(result.total.active.length, 1);
  assert.equal(result.total.atStart.length, 1);
  assert.equal(result.total.added.length, 0);
});

test("saved repeat completions and the latest open occurrence never duplicate projections", () => {
  const result = summary([
    repeat("mon", { completedOn: "2026-09-07" }),
    repeat("tue", { startDate: "2026-09-08", completedOn: "2026-09-08" }),
    repeat("wed", { startDate: "2026-09-09" }),
  ]);
  assert.equal(result.total.repeatCompleted.length, 2);
  assert.equal(result.total.repeatScheduled.length, 5);
  assert.equal(result.total.repeatOutstanding.length, 1);
  assert.equal(result.total.completed.length, 0);
});

test("repeat carry-forward counts once and pauses suppress outstanding and scheduled estimates", () => {
  const carry = repeat("carry", { startDate: "2026-08-31" });
  assert.equal(summary([carry]).total.repeatOutstanding.length, 1);
  const paused = summary([{ ...carry, repeatPaused: true }]);
  assert.equal(paused.total.repeatScheduled.length, 0);
  assert.equal(paused.total.repeatOutstanding.length, 0);
  const finite = summary([repeat("pause", { repeatPaused: true, repeatPauseUntil: "2026-09-09" })], "2026-09-09");
  assert.equal(finite.total.repeatScheduled.length, 2);
  assert.equal(finite.total.repeatOutstanding.length, 0);
  assert.equal(summary([repeat("pause", { repeatPaused: true, repeatPauseUntil: "2026-09-09" })]).total.repeatOutstanding.length, 1);
});

test("monthly repeats clamp at month end and impossible daily masks terminate", () => {
  const monthly = repeat("month", { startDate: "2026-01-31", repeatPattern: "monthly", repeatMonthlyDay: 31 });
  const result = summary([monthly], "2026-02-27");
  assert.deepEqual(result.total.repeatScheduled.map((row) => row.startDate), ["2026-02-28"]);
  const impossible = repeat("mask", { repeatInterval: 7, repeatDays: 2 });
  assert.equal(summary([impossible]).total.repeatScheduled.length, 1);
});

test("weekly and fortnightly projections use the configured interval", () => {
  const weekly = repeat("weekly", { startDate: "2026-08-31", repeatPattern: "weekly", repeatWeeklyDay: 1, repeatInterval: 2 });
  assert.equal(summary([weekly]).total.repeatScheduled.length, 0);
  assert.equal(summary([weekly], "2026-09-18").total.repeatScheduled.length, 1);
});

test("totals equal profile breakdowns and foreign or orphaned tasks never enter the summary", () => {
  const result = summary([task("a"), task("b", { profileId: "personal" }), task("foreign", { profileId: "foreign" }), task("orphan", { profileId: "" })]);
  for (const key of SUMMARY_METRICS) assert.equal(result.total[key].length, result.profiles.reduce((sum, profile) => sum + profile.buckets[key].length, 0));
  assert.equal(result.total.active.length, 2);
});

test("profile results omit raw task histories supplied by the persistence adapter", () => {
  const result = buildWeeklySummary([{ ...profiles[0], tasks: [task("old")] }], [], "2026-09-11", defaults);
  assert.equal(Object.hasOwn(result.profiles[0], "tasks"), false);
});

test("a retained prior-week briefing does not attribute newly created work to that week's remaining list", () => {
  const result = summary([task("monday", { startDate: "2026-09-01", createdAt: "2026-09-07T00:00:00Z" })], "2026-09-07", { ...defaults, startDay: 2, endDay: 6 });
  assert.equal(result.total.active.length, 1);
  assert.equal(result.total.remaining.length, 0);
});

test("settings validate weekdays, values and dismissal keys", () => {
  assert.deepEqual(parseWeeklySummarySettings(defaults), defaults);
  for (const value of [null, [], { ...defaults, enabled: "yes" }, { ...defaults, startDay: 0 }, { ...defaults, endDay: 8 }, { ...defaults, endDay: 1 }, { ...defaults, startDay: 1.5 }, { ...defaults, userId: "other" }, { ...defaults, dismissedKey: "end:2026-02-30" }]) {
    assert.equal(parseWeeklySummarySettings(value), null);
  }
});

test("empty workload has neutral copy and no fabricated progress", () => {
  const result = summary([]);
  assert.equal(result.total.completed.length, 0);
  assert.doesNotMatch(weeklyProgressCopy(result.total, result.period), /completed|behind|failed/i);
});

function fixtureHandlers({ user = { id: "owner", weeklySummarySettings: null }, failRead = false } = {}) {
  const calls = [];
  const handlers = weeklySummaryHandlers({
    async currentUser() { return user; },
    async profiles(id) {
      calls.push(["read", id]);
      if (failRead) throw new Error("unavailable");
      return [{ ...profiles[0], tasks: [task("owned")] }];
    },
    async saveSettings(id, settings) { calls.push(["write", id]); user.weeklySummarySettings = settings; },
    now: () => new Date("2026-09-11T00:00:00Z"),
  });
  return { handlers, calls, user };
}
const patchRequest = (settings) => new Request("http://localhost/api/weekly-summary", { method: "PATCH", body: JSON.stringify(settings) });

test("unauthenticated summary reads and settings writes return 401 without accessing tasks", async () => {
  const { handlers, calls } = fixtureHandlers({ user: null });
  assert.equal((await handlers.GET()).status, 401);
  assert.equal((await handlers.PATCH(patchRequest(defaults))).status, 401);
  assert.deepEqual(calls, []);
});

test("settings persist in authenticated account scope, default on, and off skips task reads", async () => {
  const { handlers, calls } = fixtureHandlers();
  const response = await handlers.GET();
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal((await response.json()).settings.enabled, true);
  assert.equal((await handlers.PATCH(patchRequest({ ...defaults, userId: "victim" }))).status, 400);
  assert.equal((await handlers.PATCH(patchRequest({ ...defaults, enabled: false }))).status, 200);
  const disabled = await (await handlers.GET()).json();
  assert.equal(disabled.summary, null);
  assert.deepEqual(calls, [["read", "owner"], ["write", "owner"]]);
});

test("saved dismissal survives reload but expires at the next briefing", async () => {
  const { handlers } = fixtureHandlers();
  const settings = { ...defaults, dismissedKey: "end:2026-09-11" };
  await handlers.PATCH(patchRequest(settings));
  const result = await (await handlers.GET()).json();
  assert.equal(result.settings.dismissedKey, result.summary.period.key);
  assert.notEqual(getWeeklySummaryPeriod("2026-09-14", settings).key, settings.dismissedKey);
});

test("a data failure is not reported as zero tasks or success", async () => {
  const { handlers } = fixtureHandlers({ failRead: true });
  await assert.rejects(handlers.GET(), /unavailable/);
});

test("Prisma adapter resolves session identity and scopes profile reads and preference writes", async () => {
  const source = await readFile(new URL("../app/api/weekly-summary/route.ts", import.meta.url), "utf8");
  assert.match(source, /where: \{ email: session\.user\.email \}/);
  assert.match(source, /prisma\.profile\.findMany\(\{\s*where: \{ userId \}/);
  assert.match(source, /prisma\.user\.update\(\{ where: \{ id: userId \}/);
});
