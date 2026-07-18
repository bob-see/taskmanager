import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isTaskOccurrenceInTodayBucket,
  isTaskOccurrenceRelevantToRange,
  isTaskOccurrenceVisibleOnDate,
} from "../app/lib/recurrence-visibility.ts";

function recurringOccurrence(overrides = {}) {
  return {
    id: "occurrence-friday-24",
    profileId: "profile-owner",
    startDate: "2026-07-24",
    dueAt: null,
    completedOn: null,
    recurring: true,
    pausedOnDate: false,
    recurrenceSeriesId: "series-friday",
    repeatEnabled: true,
    repeatPattern: "weekly",
    ...overrides,
  };
}

test("a recurring occurrence appears on its scheduled start date", () => {
  assert.equal(
    isTaskOccurrenceVisibleOnDate(recurringOccurrence(), "2026-07-24"),
    true
  );
});

test("an incomplete recurring occurrence carries into following days", () => {
  const occurrence = recurringOccurrence();

  assert.equal(isTaskOccurrenceVisibleOnDate(occurrence, "2026-07-25"), true);
  assert.equal(isTaskOccurrenceVisibleOnDate(occurrence, "2026-07-26"), true);
  assert.equal(isTaskOccurrenceVisibleOnDate(occurrence, "2026-07-30"), true);
  assert.equal(isTaskOccurrenceInTodayBucket(occurrence, "2026-07-30"), true);
});

test("carry-forward includes an occurrence in later week and month ranges", () => {
  const occurrence = recurringOccurrence();

  assert.equal(
    isTaskOccurrenceRelevantToRange(
      occurrence,
      "2026-07-27",
      "2026-08-02"
    ),
    true
  );
  assert.equal(
    isTaskOccurrenceRelevantToRange(
      occurrence,
      "2026-08-01",
      "2026-08-31"
    ),
    true
  );
});

test("completing a carried occurrence removes it from later active days", () => {
  const completed = recurringOccurrence({ completedOn: "2026-07-26" });

  assert.equal(isTaskOccurrenceVisibleOnDate(completed, "2026-07-26"), true);
  assert.equal(isTaskOccurrenceVisibleOnDate(completed, "2026-07-27"), false);
  assert.equal(isTaskOccurrenceInTodayBucket(completed, "2026-07-27"), false);
});

test("completed historical occurrences do not reappear on later schedule dates", () => {
  const completed = recurringOccurrence({ completedOn: "2026-07-25" });

  assert.equal(isTaskOccurrenceVisibleOnDate(completed, "2026-07-31"), false);
  assert.equal(isTaskOccurrenceVisibleOnDate(completed, "2026-08-07"), false);
});

test("the next occurrence remains distinct and visible without duplicating carry-forward", () => {
  const completed = recurringOccurrence({ completedOn: "2026-07-25" });
  const nextOccurrence = recurringOccurrence({
    id: "occurrence-friday-31",
    startDate: "2026-07-31",
  });
  const visible = [completed, nextOccurrence].filter((task) =>
    isTaskOccurrenceVisibleOnDate(task, "2026-07-31")
  );

  assert.deepEqual(
    visible.map((task) => task.id),
    ["occurrence-friday-31"]
  );
  assert.equal(new Set(visible.map((task) => task.id)).size, visible.length);
});

test("visibility does not mutate or disable the recurrence rule", () => {
  const occurrence = Object.freeze(recurringOccurrence());

  assert.equal(isTaskOccurrenceVisibleOnDate(occurrence, "2026-07-28"), true);
  assert.equal(occurrence.repeatEnabled, true);
  assert.equal(occurrence.recurrenceSeriesId, "series-friday");
  assert.equal(occurrence.repeatPattern, "weekly");
});

test("paused and future occurrences remain hidden", () => {
  assert.equal(
    isTaskOccurrenceVisibleOnDate(
      recurringOccurrence({ pausedOnDate: true }),
      "2026-07-25"
    ),
    false
  );
  assert.equal(
    isTaskOccurrenceVisibleOnDate(recurringOccurrence(), "2026-07-23"),
    false
  );
});

test("completion generation and ownership remain guarded by production persistence", async () => {
  const [routeSource, schemaSource] = await Promise.all([
    readFile(
      new URL("../app/api/p/[profileId]/tasks/[id]/route.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  ]);

  assert.match(routeSource, /user:\s*\{\s*email:\s*session\.user\.email/);
  assert.match(routeSource, /where:\s*\{ id, profileId \}/);
  assert.match(routeSource, /where:\s*\{ id, profileId, completedOn: null \}/);
  assert.match(routeSource, /nextOccurrenceAfterPause\(/);
  assert.match(routeSource, /error\.code === "P2002"/);
  assert.match(
    schemaSource,
    /@@unique\(\[profileId, recurrenceSeriesId, startDate\]\)/
  );
});
