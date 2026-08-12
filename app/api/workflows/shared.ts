import { calculateWorkflowDates, type WorkflowDueRule } from "@/app/lib/workflow-dates";
import { parseDateOnly } from "@/app/lib/date-time";

export const WORKFLOW_STATUS = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;

export const WORKFLOW_DUE_RULES = new Set<WorkflowDueRule>([
  "NONE",
  "START_DATE",
  "WORKFLOW_DATE",
  "OFFSET",
]);

export type WorkflowTaskInput = {
  title: string;
  notes: string | null;
  startOffsetDays: number;
  dueRule: WorkflowDueRule;
  dueOffsetDays: number | null;
  isPriority: boolean;
};

export function parseWorkflowTaskInput(value: unknown, index: number): WorkflowTaskInput {
  if (!value || typeof value !== "object") throw new Error(`Task ${index + 1} is invalid`);
  const task = value as Record<string, unknown>;
  const title = typeof task.title === "string" ? task.title.trim() : "";
  if (!title) throw new Error(`Task ${index + 1} title is required`);

  const startOffsetDays = task.startOffsetDays === undefined ? 0 : Number(task.startOffsetDays);
  if (!Number.isInteger(startOffsetDays) || startOffsetDays < -3650 || startOffsetDays > 3650) {
    throw new Error(`Task ${index + 1} start date rule is invalid`);
  }

  const dueRule = typeof task.dueRule === "string" ? task.dueRule as WorkflowDueRule : "NONE";
  if (!WORKFLOW_DUE_RULES.has(dueRule)) throw new Error(`Task ${index + 1} due date rule is invalid`);

  const dueOffsetDays = task.dueOffsetDays === null || task.dueOffsetDays === undefined
    ? null
    : Number(task.dueOffsetDays);
  if (dueRule === "OFFSET" && (!Number.isInteger(dueOffsetDays) || (dueOffsetDays as number) < -3650 || (dueOffsetDays as number) > 3650)) {
    throw new Error(`Task ${index + 1} due date offset is invalid`);
  }

  const notes = task.notes === null || task.notes === undefined
    ? null
    : typeof task.notes === "string" ? task.notes.trim() || null : null;

  return {
    title,
    notes,
    startOffsetDays,
    dueRule,
    dueOffsetDays: dueRule === "OFFSET" ? dueOffsetDays : null,
    isPriority: task.isPriority === true,
  };
}

export function parseWorkflowDefinition(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new Error("Workflow name is required");
  const description = body.description === null || body.description === undefined
    ? null
    : typeof body.description === "string" ? body.description.trim() || null : null;
  const category = body.category === null || body.category === undefined
    ? null
    : typeof body.category === "string" ? body.category.trim() || null : null;
  if (name.length > 191) throw new Error("Workflow name is too long");
  const rawTasks = Array.isArray(body.tasks) ? body.tasks : [];
  if (rawTasks.length > 100) throw new Error("A Workflow cannot contain more than 100 tasks");
  const tasks = rawTasks.map((task, index) => parseWorkflowTaskInput(task, index));
  // Validate the stored rules against a representative date before saving.
  tasks.forEach((task, index) => {
    try {
      calculateWorkflowDates("2026-01-15", task);
    } catch {
      throw new Error(`Task ${index + 1} date rules are invalid`);
    }
  });
  return { name, description, category, tasks };
}

export function parseDateOnlyInput(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`${field} is required`);
  try {
    parseDateOnly(value);
  } catch {
    throw new Error(`${field} must be a valid date-only value`);
  }
  return value;
}
