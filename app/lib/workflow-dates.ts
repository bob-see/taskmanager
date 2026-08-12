import { addDateOnlyDays, dateOnlyToUtcDate, parseDateOnly } from "./date-time.ts";

export type WorkflowDueRule = "NONE" | "START_DATE" | "WORKFLOW_DATE" | "OFFSET";

export type WorkflowDateDefinition = {
  startOffsetDays: number;
  dueRule: WorkflowDueRule;
  dueOffsetDays?: number | null;
};

export type CalculatedWorkflowDates = {
  startDate: string;
  dueDate: string | null;
  startDateValue: Date;
  dueDateValue: Date | null;
};

function assertInteger(value: number, label: string) {
  if (!Number.isInteger(value)) throw new RangeError(`${label} must be an integer`);
}

export function calculateWorkflowDates(
  workflowDate: string,
  definition: WorkflowDateDefinition,
): CalculatedWorkflowDates {
  parseDateOnly(workflowDate);
  assertInteger(definition.startOffsetDays, "Start date offset");

  if (!["NONE", "START_DATE", "WORKFLOW_DATE", "OFFSET"].includes(definition.dueRule)) {
    throw new RangeError(`Unsupported due date rule: ${definition.dueRule}`);
  }

  const startDate = addDateOnlyDays(workflowDate, definition.startOffsetDays);
  let dueDate: string | null = null;

  if (definition.dueRule === "START_DATE") dueDate = startDate;
  if (definition.dueRule === "WORKFLOW_DATE") dueDate = workflowDate;
  if (definition.dueRule === "OFFSET") {
    const dueOffsetDays = definition.dueOffsetDays;
    if (typeof dueOffsetDays !== "number" || !Number.isInteger(dueOffsetDays)) {
      throw new RangeError("Due date offset is required for the OFFSET rule");
    }
    dueDate = addDateOnlyDays(workflowDate, dueOffsetDays);
  }

  if (dueDate && dueDate < startDate) {
    throw new RangeError("Due date cannot be before the calculated start date");
  }

  return {
    startDate,
    dueDate,
    startDateValue: dateOnlyToUtcDate(startDate),
    dueDateValue: dueDate ? dateOnlyToUtcDate(dueDate) : null,
  };
}

export function formatWorkflowDateRule(
  offsetDays: number,
  kind: "start" | "due",
  dueRule?: WorkflowDueRule,
) {
  if (kind === "due" && dueRule === "NONE") return "No due date";
  if (kind === "due" && dueRule === "START_DATE") return "Same day as Start";
  if (kind === "due" && dueRule === "WORKFLOW_DATE") return "On Workflow Date";
  if (offsetDays === 0) return "On Workflow Date";
  return `${Math.abs(offsetDays)} day${Math.abs(offsetDays) === 1 ? "" : "s"} ${offsetDays < 0 ? "before" : "after"}`;
}
