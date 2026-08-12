import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateWorkflowDates,
  formatWorkflowDateRule,
} from "../app/lib/workflow-dates.ts";

test("Workflow dates calculate calendar days without timezone shifting", () => {
  const result = calculateWorkflowDates("2026-08-12", {
    startOffsetDays: -2,
    dueRule: "OFFSET",
    dueOffsetDays: 1,
  });

  assert.equal(result.startDate, "2026-08-10");
  assert.equal(result.dueDate, "2026-08-13");
  assert.equal(result.startDateValue.toISOString(), "2026-08-10T00:00:00.000Z");
  assert.equal(result.dueDateValue?.toISOString(), "2026-08-13T00:00:00.000Z");
});

test("Workflow due rules support no due date, start date, and Workflow Date", () => {
  assert.equal(calculateWorkflowDates("2026-08-12", { startOffsetDays: 1, dueRule: "NONE" }).dueDate, null);
  assert.equal(calculateWorkflowDates("2026-08-12", { startOffsetDays: 1, dueRule: "START_DATE" }).dueDate, "2026-08-13");
  assert.equal(calculateWorkflowDates("2026-08-12", { startOffsetDays: 0, dueRule: "WORKFLOW_DATE" }).dueDate, "2026-08-12");
});

test("Workflow dates reject a due date before the calculated start", () => {
  assert.throws(
    () => calculateWorkflowDates("2026-08-12", { startOffsetDays: 2, dueRule: "WORKFLOW_DATE" }),
    /Due date cannot be before/,
  );
});

test("Workflow date rules are user-facing plain language", () => {
  assert.equal(formatWorkflowDateRule(-1, "start"), "1 day before");
  assert.equal(formatWorkflowDateRule(0, "start"), "On Workflow Date");
  assert.equal(formatWorkflowDateRule(2, "due", "OFFSET"), "2 days after");
  assert.equal(formatWorkflowDateRule(0, "due", "NONE"), "No due date");
});
