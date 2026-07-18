"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  DelegatedSenderBadge,
  DelegatedTaskStatusPill,
} from "@/app/delegated/delegated-task-indicators";
import type { DelegatedTaskStatus } from "@/app/delegated/delegated-status-badge";
import {
  AddTaskModal,
  ProjectEditorModal,
  TaskEditorModal,
  createRepeatDefaults,
  createEditTaskForm,
  createTaskPayload,
  createProjectForm,
  type EditTaskFormState,
  type ProjectFormState,
  type RepeatPattern,
  type TaskCreateFormState,
  type TaskNoteHistoryEntry,
} from "@/app/components/editors";
import { TaskDeleteConfirmationModal } from "@/app/components/task-delete-confirmation-modal";
import { DoneTaskButton } from "@/app/components/done-task-button";
import { DelegateTaskModal } from "@/app/delegated/delegate-task-modal";
import {
  formatAustralianDate,
  formatBrisbaneTimestamp,
  getBrisbaneDate,
} from "@/app/lib/date-time";
import {
  isTaskOccurrenceInTodayBucket,
  isTaskOccurrenceVisibleOnDate,
} from "@/app/lib/recurrence-visibility";
import { useBrisbaneBoundaryRefresh } from "@/app/lib/use-brisbane-boundary-refresh";

type SnoozePreset = "tomorrow" | "next-business-day" | "next-week";
type RepeatPausePreset = "tomorrow" | "next-week" | "custom" | "indefinite";

type OverviewProject = {
  id: string;
  name: string;
  startDate: string;
  dueAt: string | null;
  category: string | null;
  archived: boolean;
  collapsed: boolean;
  isPriority: boolean;
  orderIndex: number | null;
  createdAt: string;
};

type OverviewTask = {
  id: string;
  title: string;
  notes: string | null;
  delegatedTask: {
    id: string;
    status: DelegatedTaskStatus;
    assignedByUser: {
      name: string | null;
      email: string | null;
    } | null;
  } | null;
  noteHistory: TaskNoteHistoryEntry[];
  projectId: string | null;
  projectName: string | null;
  category: string | null;
  isPriority: boolean;
  startDate: string;
  dueAt: string;
  completedOn: string | null;
  createdAt: string;
  orderIndex: number | null;
  recurrenceSeriesId: string | null;
  repeatEnabled: boolean;
  repeatPattern: RepeatPattern | null;
  repeatInterval: number;
  repeatDays: number | null;
  repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null;
  repeatPaused: boolean;
  repeatPauseUntil: string | null;
  repeatPauseNote: string | null;
};

type ProfileCounts = {
  open: number;
  done: number;
  overdue: number;
};

export type OverviewProfileData = {
  id: string;
  name: string;
  counts: ProfileCounts;
  categorySuggestions: string[];
  projects: OverviewProject[];
  openTasks: OverviewTask[];
  initialTaskLimit: number;
};

type OverviewClientProps = {
  profiles: OverviewProfileData[];
  userPreferenceKey: string;
  initialDate: string;
};

type TaskPendingAction = "complete" | "update" | "delete";
const MIN_TASK_PENDING_MS = 500;

type ReorderResponseProfile = {
  id: string;
};

type TaskDraftState = TaskCreateFormState & {
  title: string;
  category: string;
  projectId: string;
  startDate: string;
  dueAt: string;
};

type ProjectDraftState = ProjectFormState;

type TaskGroup = {
  key: string;
  label: string;
  projectId: string | null;
  isRecurring: boolean;
  isUnassigned: boolean;
  isPriority: boolean;
  taskCount: number;
  tasks: OverviewTask[];
};

type ContextMenuState =
  | {
      x: number;
      y: number;
      type: "task";
      task: OverviewTask;
    }
  | {
      x: number;
      y: number;
      type: "project";
      group: TaskGroup;
    };

type DeleteMode = "this" | "future" | "series";
type OverviewTaskFilter = "all-open" | "today" | "overdue" | "upcoming";
type OverviewGroupingMode = "project" | "category";
type OverviewSortMode = "manual" | "start-date" | "due-date";

const cardClass = "tm-card min-w-0 rounded-[12px] border p-4 shadow-sm md:p-5";
const inputClass =
  "tm-input h-9 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button-primary inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50";
const ORDER_GAP = 10;
const modalChoiceClass = "tm-choice flex cursor-pointer items-start gap-3 rounded-lg border p-3";
const segmentedTabSetClass = "tm-tabset inline-flex rounded-full border p-1 text-sm";
const segmentedTabClass = "tm-tab rounded-full px-3 py-1.5";
const segmentedActiveTabClass = "tm-tab-active rounded-full px-3 py-1.5";
const priorityChipClass =
  "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-800";
const overdueChipClass =
  "rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700";
const taskActionMenuItemClass =
  "flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm transition-colors hover:bg-white/60 disabled:opacity-50";
const overviewCounterChipClass =
  "tm-chip inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-tight";
const REPEAT_PAUSE_PRESET_OPTIONS: Array<{
  value: RepeatPausePreset;
  label: string;
}> = [
  { value: "tomorrow", label: "Pause until tomorrow" },
  { value: "next-week", label: "Pause until next week" },
  { value: "custom", label: "Custom date" },
  { value: "indefinite", label: "Pause indefinitely" },
];
const OVERVIEW_OPTIONS_STORAGE_KEY_PREFIX = "tm-overview-options-v1";
const DEFAULT_OVERVIEW_OPTIONS = {
  selectedFilter: "all-open" as OverviewTaskFilter,
  sortMode: "manual" as OverviewSortMode,
  groupingMode: "project" as OverviewGroupingMode,
};

type OverviewOptionsPreference = typeof DEFAULT_OVERVIEW_OPTIONS;

function isOverviewTaskFilter(value: unknown): value is OverviewTaskFilter {
  return (
    value === "all-open" ||
    value === "today" ||
    value === "overdue" ||
    value === "upcoming"
  );
}

function isOverviewSortMode(value: unknown): value is OverviewSortMode {
  return value === "manual" || value === "start-date" || value === "due-date";
}

function isOverviewGroupingMode(value: unknown): value is OverviewGroupingMode {
  return value === "project" || value === "category";
}

function getOverviewOptionsStorageKey(userPreferenceKey: string) {
  return `${OVERVIEW_OPTIONS_STORAGE_KEY_PREFIX}:${encodeURIComponent(
    userPreferenceKey
  )}`;
}

function parseOverviewOptionsPreference(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<
      Record<keyof OverviewOptionsPreference, unknown>
    >;
    return {
      selectedFilter: isOverviewTaskFilter(parsed.selectedFilter)
        ? parsed.selectedFilter
        : DEFAULT_OVERVIEW_OPTIONS.selectedFilter,
      sortMode: isOverviewSortMode(parsed.sortMode)
        ? parsed.sortMode
        : DEFAULT_OVERVIEW_OPTIONS.sortMode,
      groupingMode: isOverviewGroupingMode(parsed.groupingMode)
        ? parsed.groupingMode
        : DEFAULT_OVERVIEW_OPTIONS.groupingMode,
    };
  } catch {
    return null;
  }
}

function DiscardChangesModal({
  open,
  onKeepEditing,
  onDiscardChanges,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscardChanges: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 py-6">
      <div className="tm-card w-full max-w-sm rounded-[16px] border p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Discard unsaved changes?</h2>
        <p className="mt-2 text-sm text-[color:var(--tm-muted)]">
          You have unsaved changes. If you leave now, they will be lost.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
            type="button"
            onClick={onKeepEditing}
          >
            Keep Editing
          </button>
          <button className={buttonClass} type="button" onClick={onDiscardChanges}>
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewUtilityModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="tm-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className={`${cardClass} max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            aria-label={`Close ${title}`}
            className="tm-button inline-flex h-9 w-9 items-center justify-center rounded-[10px] border text-lg leading-none"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getNextBusinessDay(value: string) {
  let next = addDays(parseDateOnly(value), 1);

  while (next.getDay() === 0 || next.getDay() === 6) {
    next = addDays(next, 1);
  }

  return dateInputValue(next);
}

function getSnoozeDateValue(baseDateValue: string, preset: SnoozePreset) {
  if (preset === "tomorrow") {
    return dateInputValue(addDays(parseDateOnly(baseDateValue), 1));
  }

  if (preset === "next-business-day") {
    return getNextBusinessDay(baseDateValue);
  }

  return dateInputValue(addDays(parseDateOnly(baseDateValue), 7));
}

function getRepeatPauseUntilForPreset(
  baseDateValue: string,
  preset: Exclude<RepeatPausePreset, "custom" | "indefinite">
) {
  if (preset === "tomorrow") {
    return dateInputValue(addDays(parseDateOnly(baseDateValue), 1));
  }

  return dateInputValue(addDays(parseDateOnly(baseDateValue), 7));
}

function createTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForMinimumPendingTime(startedAt: number) {
  const remaining = MIN_TASK_PENDING_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await wait(remaining);
  }
}

function toDateOnly(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatMobileTaskDate(value: string | null) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return "—";

  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;

  return formatAustralianDate(dateOnly, {
    day: "numeric",
    month: "short",
  });
}

function formatNoteTimestamp(value: string | Date) {
  return formatBrisbaneTimestamp(value, {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

function getTaskNotesText(task: Pick<OverviewTask, "noteHistory">) {
  return task.noteHistory
    .map((note) =>
      [note.content, note.waitingOn ? `Waiting on: ${note.waitingOn}` : ""]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function hasTaskNotes(task: Pick<OverviewTask, "noteHistory">) {
  return getTaskNotesText(task).trim().length > 0;
}

function formatTaskNotesPreview(task: Pick<OverviewTask, "noteHistory">) {
  return task.noteHistory
    .map((note) => {
      const author = note.user?.name || "Unknown";
      return [
        `${author} · ${formatNoteTimestamp(note.createdAt)}`,
        note.content,
        note.waitingOn ? `Waiting on: ${note.waitingOn}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function normalizeOverviewTask(task: OverviewTask): OverviewTask {
  return {
    ...task,
    delegatedTask: task.delegatedTask ?? null,
    noteHistory: task.noteHistory ?? [],
    repeatInterval: task.repeatInterval ?? 1,
    repeatPaused: task.repeatPaused ?? false,
    repeatPauseUntil: task.repeatPauseUntil ?? null,
    repeatPauseNote: task.repeatPauseNote ?? null,
  };
}

function compareTasksByCreatedAt(
  left: { createdAt: string; id: string },
  right: { createdAt: string; id: string }
) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function compareTasksForStartDateSort(
  left: { startDate: string; createdAt: string; id: string },
  right: { startDate: string; createdAt: string; id: string }
) {
  if (left.startDate !== right.startDate) {
    return left.startDate.localeCompare(right.startDate);
  }

  return compareTasksByCreatedAt(left, right);
}

function compareTasksForManualSort(
  left: {
    orderIndex: number | null;
    startDate: string;
    createdAt: string;
    id: string;
  },
  right: {
    orderIndex: number | null;
    startDate: string;
    createdAt: string;
    id: string;
  }
) {
  const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return compareTasksForStartDateSort(left, right);
}

function compareTasksForDueDateSort(
  left: { dueAt: string; startDate: string; createdAt: string; id: string },
  right: { dueAt: string; startDate: string; createdAt: string; id: string }
) {
  if (left.dueAt !== right.dueAt) {
    if (!left.dueAt) return 1;
    if (!right.dueAt) return -1;
    return left.dueAt.localeCompare(right.dueAt);
  }

  return compareTasksForStartDateSort(left, right);
}

function sortOverviewTasks(tasks: OverviewTask[], sortMode: OverviewSortMode) {
  return [...tasks].sort((left, right) => {
    if (sortMode === "start-date") return compareTasksForStartDateSort(left, right);
    if (sortMode === "due-date") return compareTasksForDueDateSort(left, right);
    return compareTasksForManualSort(left, right);
  });
}

function compareProjectsForManualSort(
  left: { orderIndex: number | null; createdAt: string; id: string },
  right: { orderIndex: number | null; createdAt: string; id: string }
) {
  const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function createEmptyTaskDraftState(currentDateValue: string): TaskDraftState {
  const startDate = currentDateValue;

  return {
    title: "",
    category: "",
    notes: "",
    waitingOn: "",
    projectId: "",
    startDate,
    dueAt: "",
    ...createRepeatDefaults(startDate),
  };
}

function createEmptyProjectDraftState(currentDateValue: string): ProjectDraftState {
  return {
    name: "",
    startDate: currentDateValue,
    dueAt: "",
    category: "",
  };
}

function isTaskDraftDirty(draft: TaskDraftState, currentDateValue: string) {
  return (
    JSON.stringify(draft) !==
    JSON.stringify(createEmptyTaskDraftState(currentDateValue))
  );
}

function isEditTaskFormDirty(form: EditTaskFormState, baseline: EditTaskFormState) {
  const { noteHistory: _formHistory, ...formValues } = form;
  const { noteHistory: _baselineHistory, ...baselineValues } = baseline;
  return JSON.stringify(formValues) !== JSON.stringify(baselineValues);
}

function isTaskOverdue(dueAt: string, currentDateValue: string) {
  if (!dueAt) return false;
  return dueAt < currentDateValue;
}

function TaskNotesIndicator({ notes }: { notes: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    placement: "above" | "below";
    width: number;
  } | null>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, rect.left),
      Math.max(16, window.innerWidth - width - 16)
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement = spaceBelow < 220 && rect.top > 220 ? "above" : "below";
    const top = placement === "above" ? rect.top - 8 : rect.bottom + 8;

    setPosition({ left, top, placement, width });
  }

  function showPreview() {
    updatePosition();
    setOpen(true);
  }

  function togglePreview() {
    if (open) {
      setOpen(false);
      return;
    }

    showPreview();
  }

  useEffect(() => {
    if (!open) return;

    function handleReposition() {
      updatePosition();
    }

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        className="tm-chip inline-flex h-5 w-5 items-center justify-center rounded-full border text-[color:var(--tm-muted)] transition-colors hover:bg-white/80 hover:text-[color:var(--tm-text)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[color:var(--tm-card)]"
        aria-label="Show task notes"
        aria-expanded={open}
        onMouseEnter={showPreview}
        onMouseLeave={() => setOpen(false)}
        onFocus={showPreview}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          togglePreview();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="M4 3.5h8v9H4zM6 6h4M6 8.25h4M6 10.5h2.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      {open && position && (
        <div
          className="pointer-events-none fixed z-[70] max-h-48 overflow-auto whitespace-pre-wrap rounded-[12px] border border-[color:var(--tm-border)] bg-[color:var(--tm-card)] px-3 py-2 text-xs font-normal leading-5 text-[color:var(--tm-text)] shadow-xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            transform:
              position.placement === "above" ? "translateY(-100%)" : undefined,
          }}
        >
          {notes}
        </div>
      )}
    </span>
  );
}

function ProfileCardActionsMenu({
  collapsed,
  onAddTask,
  onAddProject,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onAddTask: () => void;
  onAddProject: () => void;
  onToggleCollapsed: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="tm-button flex h-8 cursor-pointer items-center rounded-[10px] border px-3 text-xs md:h-9 md:text-sm"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((prev) => !prev)}
      >
        Actions
      </button>
      {open && (
      <div
        ref={menuRef}
        className="tm-menu absolute right-0 top-full z-40 mt-2 min-w-40 overflow-hidden rounded-lg border py-1 shadow-2xl"
        role="menu"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={taskActionMenuItemClass}
          role="menuitem"
          onClick={() => runAction(onAddTask)}
        >
          Add Task
        </button>
        <button
          type="button"
          className={taskActionMenuItemClass}
          role="menuitem"
          onClick={() => runAction(onAddProject)}
        >
          Add Project
        </button>
        <button
          type="button"
          className={taskActionMenuItemClass}
          role="menuitem"
          onClick={() => runAction(onToggleCollapsed)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      )}
    </div>
  );
}

function OverviewOptionsMenu({
  selectedFilter,
  sortMode,
  groupingMode,
  filterOptions,
  sortOptions,
  groupingOptions,
  onFilterChange,
  onSortChange,
  onGroupingChange,
}: {
  selectedFilter: OverviewTaskFilter;
  sortMode: OverviewSortMode;
  groupingMode: OverviewGroupingMode;
  filterOptions: Array<{ value: OverviewTaskFilter; label: string }>;
  sortOptions: Array<{ value: OverviewSortMode; label: string }>;
  groupingOptions: Array<{ value: OverviewGroupingMode; label: string }>;
  onFilterChange: (value: OverviewTaskFilter) => void;
  onSortChange: (value: OverviewSortMode) => void;
  onGroupingChange: (value: OverviewGroupingMode) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const menuItemClass =
    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-white/70";
  const selectedClass =
    "bg-white/80 font-semibold shadow-[inset_3px_0_0_rgba(31,41,55,0.18)]";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="tm-button flex h-9 cursor-pointer items-center rounded-[10px] border px-3 text-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        Overview Options
      </button>
      {open && (
      <div
        ref={menuRef}
        className="tm-menu absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border py-2 shadow-2xl"
        role="menu"
      >
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
          Applies to entire Overview
        </div>

        <div className="border-t border-[color:var(--tm-border)] pt-1">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tm-muted)]">
            Filter
          </div>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${menuItemClass} ${
                selectedFilter === option.value ? selectedClass : ""
              }`}
              onClick={() => onFilterChange(option.value)}
            >
              <span>{option.label}</span>
              <span className="w-4 text-right">
                {selectedFilter === option.value ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-[color:var(--tm-border)] pt-1">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tm-muted)]">
            Sort
          </div>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${menuItemClass} ${sortMode === option.value ? selectedClass : ""}`}
              onClick={() => onSortChange(option.value)}
            >
              <span>{option.label}</span>
              <span className="w-4 text-right">{sortMode === option.value ? "✓" : ""}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-[color:var(--tm-border)] pt-1">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tm-muted)]">
            Group By
          </div>
          {groupingOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${menuItemClass} ${
                groupingMode === option.value ? selectedClass : ""
              }`}
              onClick={() => onGroupingChange(option.value)}
            >
              <span>{option.label}</span>
              <span className="w-4 text-right">
                {groupingMode === option.value ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

function matchesOverviewTaskFilter(
  task: OverviewTask,
  filter: OverviewTaskFilter,
  today: string
) {
  if (!isOverviewTaskVisibleOnDate(task, today)) {
    return filter === "upcoming" && task.startDate > today;
  }

  const startsToday = task.startDate === today;
  const dueToday = task.dueAt === today;
  const overdue = Boolean(task.dueAt) && task.dueAt < today;
  const startsInFuture = task.startDate > today;
  const dueInFuture = Boolean(task.dueAt) && task.dueAt > today;
  const activeOpen = !startsInFuture;
  const upcoming = startsInFuture || (dueInFuture && !activeOpen);

  if (filter === "today") {
    return isTaskOccurrenceInTodayBucket(
      {
        startDate: task.startDate,
        dueAt: task.dueAt,
        completedOn: task.completedOn,
        recurring: isRecurringOverviewTask(task),
      },
      today
    );
  }

  if (filter === "overdue") {
    return overdue;
  }

  if (filter === "upcoming") {
    return !startsToday && !dueToday && !overdue && upcoming;
  }

  return activeOpen;
}

function isRecurringOverviewTask(task: OverviewTask) {
  return Boolean(task.recurrenceSeriesId || task.repeatEnabled || task.repeatPattern);
}

function isOverviewRepeatPausedOnDate(task: OverviewTask, dateValue: string) {
  if (!isRecurringOverviewTask(task) || !task.repeatPaused) return false;
  return !task.repeatPauseUntil || dateValue <= task.repeatPauseUntil;
}

function isOverviewTaskVisibleOnDate(task: OverviewTask, dateValue: string) {
  const recurring = isRecurringOverviewTask(task);

  return isTaskOccurrenceVisibleOnDate(
    {
      startDate: task.startDate,
      completedOn: task.completedOn,
      recurring,
      pausedOnDate: recurring && isOverviewRepeatPausedOnDate(task, dateValue),
    },
    dateValue
  );
}

function getTaskCategoryLabel(task: OverviewTask) {
  return task.category?.trim() || "Unassigned";
}

function getOverviewTaskGroupKey(
  task: OverviewTask,
  groupingMode: OverviewGroupingMode
) {
  if (groupingMode === "category") {
    const normalizedCategory = getTaskCategoryLabel(task).toLocaleLowerCase();

    if (normalizedCategory !== "unassigned") {
      return `category:${normalizedCategory}`;
    }

    return isRecurringOverviewTask(task) ? "recurring" : "category:unassigned";
  }

  if (task.projectId) {
    return `project:${task.projectId}`;
  }

  return isRecurringOverviewTask(task) ? "recurring" : "unassigned";
}

function moveProfileToIndex<T extends { id: string }>(
  list: T[],
  draggedId: string,
  targetIndex: number
) {
  const sourceIndex = list.findIndex((profile) => profile.id === draggedId);
  if (sourceIndex === -1) return list;

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, list.length));
  const next = [...list];
  const [draggedProfile] = next.splice(sourceIndex, 1);
  const insertionIndex =
    sourceIndex < boundedTargetIndex ? boundedTargetIndex - 1 : boundedTargetIndex;

  next.splice(insertionIndex, 0, draggedProfile);
  return next;
}

function reorderIds(
  orderedIds: string[],
  draggedId: string,
  targetId: string,
  position: "before" | "after"
) {
  if (draggedId === targetId) {
    return orderedIds;
  }

  const nextIds = orderedIds.filter((id) => id !== draggedId);
  const targetIndex = nextIds.indexOf(targetId);

  if (targetIndex === -1) {
    return orderedIds;
  }

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  nextIds.splice(insertIndex, 0, draggedId);
  return nextIds;
}

function reorderFilteredProfiles(
  allProfiles: OverviewProfileData[],
  visibleProfiles: OverviewProfileData[],
  draggedId: string,
  targetIndex: number
) {
  const nextVisibleProfiles = moveProfileToIndex(visibleProfiles, draggedId, targetIndex);
  if (nextVisibleProfiles === visibleProfiles) {
    return allProfiles;
  }

  const visibleIds = new Set(visibleProfiles.map((profile) => profile.id));
  const replacementProfiles = [...nextVisibleProfiles];

  return allProfiles.map((profile) =>
    visibleIds.has(profile.id) ? replacementProfiles.shift() ?? profile : profile
  );
}

function reorderProfilesByIds(
  profiles: OverviewProfileData[],
  orderedIds: string[]
) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return orderedIds
    .map((id) => profileById.get(id))
    .filter((profile): profile is OverviewProfileData => Boolean(profile));
}

function applyOrderIndex<T extends { id: string; orderIndex: number | null }>(
  items: T[],
  orderedIds: string[]
) {
  const orderById = new Map(orderedIds.map((id, index) => [id, (index + 1) * ORDER_GAP]));

  return items.map((item) =>
    orderById.has(item.id)
      ? { ...item, orderIndex: orderById.get(item.id) ?? item.orderIndex }
      : item
  );
}

type ProfileCardProps = {
  profile: OverviewProfileData;
  currentDateValue: string;
  selectedFilter: OverviewTaskFilter;
  sortMode: OverviewSortMode;
  groupingMode: OverviewGroupingMode;
  draggable?: boolean;
  dragActive?: boolean;
  dragOverPosition?: "before" | "after" | null;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLElement>) => void;
};

function ProfileCard({
  profile,
  currentDateValue,
  selectedFilter,
  sortMode,
  groupingMode,
  draggable = false,
  dragActive = false,
  dragOverPosition = null,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ProfileCardProps) {
  const router = useRouter();
  const [openTasks, setOpenTasks] = useState(() =>
    profile.openTasks.map(normalizeOverviewTask)
  );
  const [projects, setProjects] = useState(profile.projects);
  const [counts, setCounts] = useState(profile.counts);
  const [taskDraft, setTaskDraft] = useState<TaskDraftState>(() =>
    createEmptyTaskDraftState(currentDateValue)
  );
  const [projectDraft, setProjectDraft] = useState<ProjectDraftState>(() =>
    createEmptyProjectDraftState(currentDateValue)
  );
  const [saving, setSaving] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<EditTaskFormState | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [delegateTask, setDelegateTask] = useState<OverviewTask | null>(null);
  const [singleSnoozeTask, setSingleSnoozeTask] = useState<OverviewTask | null>(null);
  const [singleSnoozeDateValue, setSingleSnoozeDateValue] = useState("");
  const [singleSnoozeSaving, setSingleSnoozeSaving] = useState(false);
  const [repeatPauseTask, setRepeatPauseTask] = useState<OverviewTask | null>(null);
  const [repeatPausePreset, setRepeatPausePreset] = useState<RepeatPausePreset>("tomorrow");
  const [repeatPauseUntilValue, setRepeatPauseUntilValue] = useState("");
  const [repeatPauseNoteValue, setRepeatPauseNoteValue] = useState("");
  const [repeatPauseSaving, setRepeatPauseSaving] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editProjectForm, setEditProjectForm] = useState<ProjectFormState | null>(null);
  const [editProjectSaving, setEditProjectSaving] = useState(false);
  const [taskReordering, setTaskReordering] = useState(false);
  const [projectReordering, setProjectReordering] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [pendingTaskActions, setPendingTaskActions] = useState<Record<string, TaskPendingAction>>({});
  const pendingTaskActionIdsRef = useRef<Set<string>>(new Set());
  const [deleteTaskSaving, setDeleteTaskSaving] = useState(false);
  const [deleteTaskModalTask, setDeleteTaskModalTask] = useState<OverviewTask | null>(null);
  const [deleteTaskMode, setDeleteTaskMode] = useState<DeleteMode>("this");
  const [discardTarget, setDiscardTarget] = useState<"new-task" | "edit-task" | null>(
    null
  );
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const mobileGroupsInitializedRef = useRef(false);
  const [categorySuggestions, setCategorySuggestions] = useState(profile.categorySuggestions);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedTaskGroupKey, setDraggedTaskGroupKey] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverTaskGroupKey, setDragOverTaskGroupKey] = useState<string | null>(null);
  const [dragOverTaskPosition, setDragOverTaskPosition] = useState<"before" | "after" | null>(
    null
  );
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [dragOverProjectPosition, setDragOverProjectPosition] = useState<"before" | "after" | null>(
    null
  );
  const taskSnapshotRef = useRef<OverviewTask[] | null>(null);
  const projectSnapshotRef = useRef<OverviewProject[] | null>(null);
  const previousCurrentDateRef = useRef(currentDateValue);
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  );
  const projectOptions = useMemo(
    () =>
      [...projects]
        .sort(compareProjectsForManualSort)
        .map((project) => ({
          id: project.id,
          name: project.name,
          archived: project.archived,
        })),
    [projects]
  );

  useEffect(() => {
    setOpenTasks(profile.openTasks);
    setProjects(profile.projects);
    setCounts(profile.counts);
    setCategorySuggestions(profile.categorySuggestions);
  }, [profile]);

  useEffect(() => {
    const previousDate = previousCurrentDateRef.current;
    if (previousDate === currentDateValue) return;

    previousCurrentDateRef.current = currentDateValue;
    setTaskDraft((draft) =>
      isTaskDraftDirty(draft, previousDate)
        ? draft
        : createEmptyTaskDraftState(currentDateValue)
    );
    setProjectDraft((draft) =>
      JSON.stringify(draft) ===
      JSON.stringify(createEmptyProjectDraftState(previousDate))
        ? createEmptyProjectDraftState(currentDateValue)
        : draft
    );
  }, [currentDateValue]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function closeMenu() {
      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const orderedProjects = useMemo(
    () => [...projects].sort(compareProjectsForManualSort),
    [projects]
  );
  const today = currentDateValue;
  const overviewTaskPreviewLimit = Math.min(profile.initialTaskLimit, 3);
  const filteredOpenTasks = useMemo(
    () => openTasks.filter((task) => matchesOverviewTaskFilter(task, selectedFilter, today)),
    [openTasks, selectedFilter, today]
  );
  const waitingOnSuggestions = useMemo(
    () =>
      Array.from(
        new Map(
          openTasks
            .flatMap((task) =>
              task.noteHistory.map((note) => note.waitingOn?.trim() ?? "")
            )
            .filter(Boolean)
            .map((waitingOn) => [waitingOn.toLocaleLowerCase(), waitingOn])
        ).values()
      ).sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" })
      ),
    [openTasks]
  );
  const displayCounts = useMemo(
    () => ({
      openNow: openTasks.filter((task) =>
        matchesOverviewTaskFilter(task, "all-open", today)
      ).length,
      upcoming: openTasks.filter((task) =>
        matchesOverviewTaskFilter(task, "upcoming", today)
      ).length,
      overdue: openTasks.filter((task) =>
        matchesOverviewTaskFilter(task, "overdue", today)
      ).length,
    }),
    [openTasks, today]
  );

  const taskCountByGroupKey = useMemo(() => {
    const countsByGroup = new Map<string, number>();

    for (const task of filteredOpenTasks) {
      const groupKey = getOverviewTaskGroupKey(task, groupingMode);
      countsByGroup.set(groupKey, (countsByGroup.get(groupKey) ?? 0) + 1);
    }

    return countsByGroup;
  }, [filteredOpenTasks, groupingMode]);

  const tasksByGroupKey = useMemo(() => {
    const groups = new Map<string, OverviewTask[]>();

    for (const task of sortOverviewTasks(filteredOpenTasks, sortMode)) {
      const groupKey = getOverviewTaskGroupKey(task, groupingMode);
      const existing = groups.get(groupKey);

      if (existing) {
        existing.push(task);
      } else {
        groups.set(groupKey, [task]);
      }
    }

    return groups;
  }, [filteredOpenTasks, groupingMode, sortMode]);

  const orderedTaskGroups = useMemo(() => {
    const groups: TaskGroup[] = [];
    const recurringTasks = tasksByGroupKey.get("recurring") ?? [];

    if (recurringTasks.length > 0) {
      groups.push({
        key: "recurring",
        label: "Recurring",
        projectId: null,
        isRecurring: true,
        isUnassigned: false,
        isPriority: false,
        taskCount: taskCountByGroupKey.get("recurring") ?? 0,
        tasks: recurringTasks,
      });
    }

    if (groupingMode === "category") {
      const categoryGroups = [...tasksByGroupKey.entries()]
        .filter(([groupKey]) => groupKey !== "recurring")
        .map(([groupKey, groupTasks]) => ({
          key: groupKey,
          label: groupTasks[0] ? getTaskCategoryLabel(groupTasks[0]) : "Unassigned",
          projectId: null,
          isRecurring: false,
          isUnassigned: groupKey === "category:unassigned",
          isPriority: false,
          taskCount: taskCountByGroupKey.get(groupKey) ?? 0,
          tasks: groupTasks,
        }))
        .sort((left, right) => {
          if (left.isUnassigned !== right.isUnassigned) {
            return left.isUnassigned ? -1 : 1;
          }

          return left.label.localeCompare(right.label, undefined, {
            sensitivity: "base",
          });
        });

      groups.push(...categoryGroups);
      return groups;
    }

    const unassignedTasks = tasksByGroupKey.get("unassigned") ?? [];

    if (unassignedTasks.length > 0) {
      groups.push({
        key: "unassigned",
        label: "Unassigned",
        projectId: null,
        isRecurring: false,
        isUnassigned: true,
        isPriority: false,
        taskCount: taskCountByGroupKey.get("unassigned") ?? 0,
        tasks: unassignedTasks,
      });
    }

    const seenProjectIds = new Set<string>();

    for (const project of orderedProjects) {
      const groupKey = `project:${project.id}`;
      const projectTasks = tasksByGroupKey.get(groupKey);

      seenProjectIds.add(project.id);

      if (!projectTasks || projectTasks.length === 0) {
        continue;
      }

      groups.push({
        key: groupKey,
        label: project.name,
        projectId: project.id,
        isRecurring: false,
        isUnassigned: false,
        isPriority: project.isPriority,
        taskCount: taskCountByGroupKey.get(groupKey) ?? 0,
        tasks: projectTasks,
      });
    }

    for (const [groupKey, groupTasks] of tasksByGroupKey.entries()) {
      if (groupKey === "unassigned" || groupKey === "recurring") {
        continue;
      }

      const projectId = groupKey.replace("project:", "");
      if (seenProjectIds.has(projectId)) {
        continue;
      }

      groups.push({
        key: groupKey,
        label: groupTasks[0]?.projectName ?? projectNameById.get(projectId) ?? "Unknown project",
        projectId,
        isRecurring: false,
        isUnassigned: false,
        isPriority: false,
        taskCount: taskCountByGroupKey.get(groupKey) ?? 0,
        tasks: groupTasks,
      });
    }

    return groups;
  }, [groupingMode, orderedProjects, projectNameById, taskCountByGroupKey, tasksByGroupKey]);

  const groupedVisibleTasks = useMemo(() => {
    const orderedTaskIds = orderedTaskGroups.flatMap((group) => group.tasks.map((task) => task.id));
    const visibleTaskIds = new Set(
      (showAll ? orderedTaskIds : orderedTaskIds.slice(0, overviewTaskPreviewLimit)).map((id) => id)
    );

    return orderedTaskGroups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => visibleTaskIds.has(task.id)),
      }))
      .filter((group) => group.tasks.length > 0);
  }, [orderedTaskGroups, overviewTaskPreviewLimit, showAll]);

  useEffect(() => {
    if (mobileGroupsInitializedRef.current || typeof window === "undefined") {
      return;
    }

    if (!window.matchMedia("(max-width: 767px)").matches || groupedVisibleTasks.length === 0) {
      return;
    }

    mobileGroupsInitializedRef.current = true;
    setCollapsedGroups(
      Object.fromEntries(groupedVisibleTasks.map((group) => [group.key, true]))
    );
  }, [groupedVisibleTasks]);

  function closeDialog() {
    if (saving) return;

    if (isTaskDraftDirty(taskDraft, currentDateValue)) {
      setDiscardTarget("new-task");
      return;
    }

    setDialogOpen(false);
    setTaskDraft(createEmptyTaskDraftState(currentDateValue));
  }

  function closeProjectDialog() {
    if (projectSaving) return;
    setProjectDialogOpen(false);
    setProjectDraft(createEmptyProjectDraftState(currentDateValue));
  }

  function closeTaskEditor() {
    if (editTaskSaving) return;
    const editTask = editTaskId
      ? openTasks.find((task) => task.id === editTaskId) ?? null
      : null;

    if (
      editTaskForm &&
      editTask &&
      isEditTaskFormDirty(editTaskForm, createEditTaskForm(editTask))
    ) {
      setDiscardTarget("edit-task");
      return;
    }

    setEditTaskId(null);
    setEditTaskForm(null);
  }

  function discardUnsavedChanges() {
    if (discardTarget === "new-task") {
      setDialogOpen(false);
      setTaskDraft(createEmptyTaskDraftState(currentDateValue));
    }

    if (discardTarget === "edit-task") {
      setEditTaskId(null);
      setEditTaskForm(null);
    }

    setDiscardTarget(null);
  }

  function closeProjectEditor() {
    if (editProjectSaving) return;
    setEditProjectId(null);
    setEditProjectForm(null);
  }

  function openTaskDialog() {
    setTaskDraft(createEmptyTaskDraftState(getBrisbaneDate(new Date())));
    setDialogOpen(true);
  }

  function openProjectDialog() {
    setProjectDraft(createEmptyProjectDraftState(getBrisbaneDate(new Date())));
    setProjectDialogOpen(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = taskDraft.title.trim();
    if (!title || saving) return;

    const actionDate = getBrisbaneDate(new Date());
    setSaving(true);

    try {
      const res = await fetch(`/api/p/${profile.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTaskPayload({
            ...taskDraft,
            title,
            startDate: taskDraft.startDate || actionDate,
          })
        ),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create task");
      }

      const createdTask = (await res.json()) as {
        id: string;
        title: string;
        notes?: string | null;
        noteHistory?: TaskNoteHistoryEntry[];
        startDate: string;
        dueAt: string | null;
        category: string | null;
        createdAt: string;
        orderIndex: number | null;
        recurrenceSeriesId: string | null;
        projectId: string | null;
        repeatEnabled: boolean;
        repeatPattern: RepeatPattern | null;
        repeatInterval: number;
        repeatDays: number | null;
        repeatWeeklyDay: number | null;
        repeatMonthlyDay: number | null;
        repeatPaused?: boolean;
        repeatPauseUntil?: string | null;
        repeatPauseNote?: string | null;
        delegatedTask?: OverviewTask["delegatedTask"];
        noteSaveError?: boolean;
        noteSaveErrorMessage?: string;
      };
      const submittedNote = taskDraft.notes.trim();
      const submittedWaitingOn = taskDraft.waitingOn.trim();

      const projectName = createdTask.projectId
        ? projects.find((projectOption) => projectOption.id === createdTask.projectId)
            ?.name ?? null
        : null;

      const nextTask: OverviewTask = {
        id: createdTask.id,
        title: createdTask.title,
        notes: createdTask.notes ?? null,
        delegatedTask: createdTask.delegatedTask ?? null,
        noteHistory: createdTask.noteHistory ?? [],
        projectId: createdTask.projectId,
        projectName,
        category: createdTask.category,
        isPriority: false,
        startDate: toDateOnly(createdTask.startDate),
        dueAt: toDateOnly(createdTask.dueAt),
        completedOn: null,
        createdAt: createdTask.createdAt,
        orderIndex: createdTask.orderIndex,
        recurrenceSeriesId: createdTask.recurrenceSeriesId,
        repeatEnabled: createdTask.repeatEnabled,
        repeatPattern: createdTask.repeatPattern,
        repeatInterval: createdTask.repeatInterval ?? 1,
        repeatDays: createdTask.repeatDays,
        repeatWeeklyDay: createdTask.repeatWeeklyDay,
        repeatMonthlyDay: createdTask.repeatMonthlyDay,
        repeatPaused: createdTask.repeatPaused ?? false,
        repeatPauseUntil: createdTask.repeatPauseUntil ?? null,
        repeatPauseNote: createdTask.repeatPauseNote ?? null,
      };

      setOpenTasks((prev) => [...prev, nextTask].sort(compareTasksForManualSort));
      setCounts((prev) => ({
        ...prev,
        open: prev.open + 1,
        overdue:
          prev.overdue + (isTaskOverdue(nextTask.dueAt, actionDate) ? 1 : 0),
      }));

      const newCategory = nextTask.category?.trim();
      if (newCategory) {
        setCategorySuggestions((prev) => {
          const exists = prev.some(
            (item) => item.toLocaleLowerCase() === newCategory.toLocaleLowerCase()
          );
          if (exists) return prev;

          return [...prev, newCategory].sort((left, right) =>
            left.localeCompare(right, undefined, { sensitivity: "base" })
          );
        });
      }

      setDialogOpen(false);
      setTaskDraft(createEmptyTaskDraftState(actionDate));
      if (createdTask.noteSaveError) {
        setEditTaskId(nextTask.id);
        setEditTaskForm({
          ...createEditTaskForm(nextTask),
          notes: submittedNote,
          waitingOn: submittedWaitingOn,
        });
        alert(
          createdTask.noteSaveErrorMessage ??
            "Task was created, but the note could not be saved. Please add the note again from task details."
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  }

  async function onProjectSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = projectDraft.name.trim();
    if (!name || projectSaving) return;

    const actionDate = getBrisbaneDate(new Date());
    setProjectSaving(true);

    try {
      const res = await fetch(`/api/p/${profile.id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate: projectDraft.startDate || actionDate,
          dueAt: projectDraft.dueAt || null,
          category: projectDraft.category.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create project");
      }

      const createdProject = (await res.json()) as OverviewProject;
      setProjects((prev) =>
        [...prev, createdProject].sort(compareProjectsForManualSort)
      );
      setProjectDialogOpen(false);
      setProjectDraft(createEmptyProjectDraftState(actionDate));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setProjectSaving(false);
    }
  }

  function finishTaskDrag() {
    setDraggedTaskId(null);
    setDraggedTaskGroupKey(null);
    setDragOverTaskId(null);
    setDragOverTaskGroupKey(null);
    setDragOverTaskPosition(null);
  }

  function finishProjectDrag() {
    setDraggedProjectId(null);
    setDragOverProjectId(null);
    setDragOverProjectPosition(null);
  }

  function applyTaskOrder(orderedIds: string[]) {
    setOpenTasks((prev) => applyOrderIndex(prev, orderedIds));
  }

  function applyProjectOrder(orderedIds: string[]) {
    setProjects((prev) => applyOrderIndex(prev, orderedIds));
  }

  function getDropPosition(event: React.DragEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.top + bounds.height / 2;
    return event.clientY < midpoint ? "before" : "after";
  }

  async function persistTaskOrder(orderedIds: string[]) {
    const res = await fetch(`/api/p/${profile.id}/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not reorder tasks");
    }
  }

  async function persistProjectOrder(orderedIds: string[]) {
    const res = await fetch(`/api/p/${profile.id}/projects/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not reorder projects");
    }
  }

  function handleTaskDragStart(
    event: React.DragEvent<HTMLTableRowElement>,
    taskId: string,
    groupKey: string
  ) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
    setDraggedTaskGroupKey(groupKey);
  }

  function handleTaskDragOver(
    event: React.DragEvent<HTMLTableRowElement>,
    taskId: string,
    groupKey: string
  ) {
    if (!draggedTaskId || draggedTaskGroupKey !== groupKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOverTaskId(taskId);
    setDragOverTaskGroupKey(groupKey);
    setDragOverTaskPosition(getDropPosition(event));
  }

  async function handleTaskDrop(
    event: React.DragEvent<HTMLTableRowElement>,
    targetTaskId: string,
    groupKey: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedTaskId || !draggedTaskGroupKey || draggedTaskGroupKey !== groupKey) {
      finishTaskDrag();
      return;
    }

    const position = dragOverTaskPosition ?? "after";
    const group = orderedTaskGroups.find((item) => item.key === groupKey);
    const orderedIds = group?.tasks.map((task) => task.id) ?? [];
    const nextOrderedIds = reorderIds(orderedIds, draggedTaskId, targetTaskId, position);

    if (nextOrderedIds.every((id, index) => id === orderedIds[index])) {
      finishTaskDrag();
      return;
    }

    taskSnapshotRef.current = openTasks;
    applyTaskOrder(nextOrderedIds);
    finishTaskDrag();
    setTaskReordering(true);

    try {
      await persistTaskOrder(nextOrderedIds);
      taskSnapshotRef.current = null;
    } catch (error) {
      if (taskSnapshotRef.current) {
        setOpenTasks(taskSnapshotRef.current);
        taskSnapshotRef.current = null;
      }
      alert(error instanceof Error ? error.message : "Could not reorder tasks");
    } finally {
      setTaskReordering(false);
    }
  }

  function handleProjectDragStart(
    event: React.DragEvent<HTMLTableRowElement>,
    projectId: string
  ) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", projectId);
    setDraggedProjectId(projectId);
  }

  function handleProjectDragOver(
    event: React.DragEvent<HTMLTableRowElement>,
    projectId: string
  ) {
    if (!draggedProjectId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOverProjectId(projectId);
    setDragOverProjectPosition(getDropPosition(event));
  }

  async function handleProjectDrop(
    event: React.DragEvent<HTMLTableRowElement>,
    targetProjectId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedProjectId) {
      finishProjectDrag();
      return;
    }

    const visibleProjectIds = orderedTaskGroups
      .filter((group) => !group.isUnassigned && group.projectId)
      .map((group) => group.projectId as string);
    const nextVisibleProjectIds = reorderIds(
      visibleProjectIds,
      draggedProjectId,
      targetProjectId,
      dragOverProjectPosition ?? "after"
    );

    if (nextVisibleProjectIds.every((id, index) => id === visibleProjectIds[index])) {
      finishProjectDrag();
      return;
    }

    const visibleProjectIdSet = new Set(visibleProjectIds);
    const replacementIds = [...nextVisibleProjectIds];
    const nextOrderedIds = orderedProjects.map((project) =>
      visibleProjectIdSet.has(project.id) ? replacementIds.shift() ?? project.id : project.id
    );

    projectSnapshotRef.current = projects;
    applyProjectOrder(nextOrderedIds);
    finishProjectDrag();
    setProjectReordering(true);

    try {
      await persistProjectOrder(nextOrderedIds);
      projectSnapshotRef.current = null;
      router.refresh();
    } catch (error) {
      if (projectSnapshotRef.current) {
        setProjects(projectSnapshotRef.current);
        projectSnapshotRef.current = null;
      }
      alert(error instanceof Error ? error.message : "Could not reorder projects");
    } finally {
      setProjectReordering(false);
    }
  }

  function openTaskContextMenu(event: React.MouseEvent, task: OverviewTask) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: "task",
      task,
    });
  }

  function openProjectContextMenu(event: React.MouseEvent, group: TaskGroup) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: "project",
      group,
    });
  }

  function openTaskEditor(task: OverviewTask) {
    setContextMenu(null);
    setEditTaskId(task.id);
    setEditTaskForm(createEditTaskForm(task));
  }

  function openDelegateTask(task: OverviewTask) {
    setContextMenu(null);
    if (task.delegatedTask) {
      alert("This task has already been delegated.");
      return;
    }

    setDelegateTask(task);
  }

  function markTaskDelegated(delegation?: { id: string; status: DelegatedTaskStatus }) {
    if (!delegateTask) return;

    const delegatedTask = {
      id: delegation?.id ?? delegateTask.id,
      status: delegation?.status ?? "PENDING",
      assignedByUser: null,
    };

    setOpenTasks((prev) =>
      prev.map((task) =>
        task.id === delegateTask.id ? { ...task, delegatedTask } : task
      )
    );
    setDelegateTask(null);
    router.refresh();
  }

  function openProjectEditor(group: TaskGroup) {
    if (!group.projectId) {
      return;
    }

    const project = projects.find((item) => item.id === group.projectId);
    if (!project) {
      return;
    }

    setContextMenu(null);
    setEditProjectId(project.id);
    setEditProjectForm(createProjectForm(project));
  }

  async function patchTask(taskId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/p/${profile.id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not update task");
    }

    return (await res.json()) as {
      task?: OverviewTask;
      createdTask?: OverviewTask | null;
    };
  }

  async function deleteTask(taskId: string, mode: DeleteMode = "this") {
    const res = await fetch(`/api/p/${profile.id}/tasks/${taskId}?mode=${mode}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not delete task");
    }
  }

  function startTaskPendingAction(taskId: string, action: TaskPendingAction) {
    if (pendingTaskActionIdsRef.current.has(taskId)) {
      return false;
    }

    pendingTaskActionIdsRef.current.add(taskId);
    flushSync(() => {
      setPendingTaskActions((prev) => ({ ...prev, [taskId]: action }));
    });
    return true;
  }

  function finishTaskPendingAction(taskId: string) {
    pendingTaskActionIdsRef.current.delete(taskId);
    setPendingTaskActions((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  function removeTaskFromCard(task: OverviewTask) {
    const actionDate = getBrisbaneDate(new Date());
    setOpenTasks((prev) => prev.filter((item) => item.id !== task.id));
    setCounts((prev) => ({
      ...prev,
      open: Math.max(0, prev.open - 1),
      overdue: Math.max(
        0,
        prev.overdue - (isTaskOverdue(task.dueAt, actionDate) ? 1 : 0)
      ),
    }));
  }

  function requestDeleteTask(task: OverviewTask) {
    setContextMenu(null);
    setDeleteTaskModalTask(task);
    setDeleteTaskMode("this");
  }

  async function patchProject(projectId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/p/${profile.id}/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not update project");
    }

    return (await res.json()) as OverviewProject;
  }

  async function submitTaskEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTaskId || !editTaskForm) return;

    const pendingNoteText = editTaskForm.notes.trim();
    const pendingWaitingOn = editTaskForm.waitingOn.trim();
    const pendingNote: TaskNoteHistoryEntry | null =
      pendingNoteText || pendingWaitingOn
        ? {
          id: createTempId("task-note"),
          content: pendingNoteText,
          waitingOn: pendingWaitingOn || null,
          createdAt: new Date().toISOString(),
          user: {
            id: "current-user",
            name: profile.name,
            email: "",
          },
          isPending: true,
        }
      : null;

    setEditTaskSaving(true);
    if (pendingNote) {
      setEditTaskForm((prev) =>
        prev ? { ...prev, noteHistory: [pendingNote, ...prev.noteHistory] } : prev
      );
      setOpenTasks((prev) =>
        prev.map((task) =>
          task.id === editTaskId
            ? { ...task, noteHistory: [pendingNote, ...task.noteHistory] }
            : task
        )
      );
    }

    try {
      const response = await patchTask(editTaskId, {
        title: editTaskForm.title.trim(),
        startDate: editTaskForm.startDate,
        dueAt: editTaskForm.dueAt || null,
        category: editTaskForm.category || null,
        notes: editTaskForm.notes || null,
        waitingOn: editTaskForm.waitingOn || null,
        projectId: editTaskForm.projectId || null,
        repeatEnabled: editTaskForm.repeatEnabled,
        repeatPattern: editTaskForm.repeatEnabled ? editTaskForm.repeatPattern : null,
        repeatInterval: editTaskForm.repeatEnabled ? editTaskForm.repeatInterval : 1,
        repeatDays:
          editTaskForm.repeatEnabled &&
          (editTaskForm.repeatPattern === "daily" ||
            editTaskForm.repeatPattern === "weekly")
            ? editTaskForm.repeatDays
            : null,
        repeatWeeklyDay:
          editTaskForm.repeatEnabled && editTaskForm.repeatPattern === "weekly"
            ? editTaskForm.repeatWeeklyDay
            : null,
        repeatMonthlyDay:
          editTaskForm.repeatEnabled && editTaskForm.repeatPattern === "monthly"
            ? editTaskForm.repeatMonthlyDay
            : null,
        repeatPaused: editTaskForm.repeatEnabled ? editTaskForm.repeatPaused : false,
        repeatPauseUntil:
          editTaskForm.repeatEnabled && editTaskForm.repeatPaused
            ? editTaskForm.repeatPauseUntil || null
            : null,
        repeatPauseNote:
          editTaskForm.repeatEnabled && editTaskForm.repeatPaused
            ? editTaskForm.repeatPauseNote.trim() || null
            : null,
      });
      const savedTask = response.task;

      if (savedTask) {
        const previousTask = openTasks.find((item) => item.id === editTaskId);
        const nextDueAt = toDateOnly(savedTask.dueAt);

        setOpenTasks((prev) =>
          prev.map((item) =>
            item.id === editTaskId
              ? {
                  ...item,
                  title: savedTask.title,
                  notes: savedTask.notes,
                  noteHistory: savedTask.noteHistory ?? item.noteHistory,
                  category: savedTask.category,
                  startDate: toDateOnly(savedTask.startDate),
                  dueAt: nextDueAt,
                  orderIndex: savedTask.orderIndex,
                  projectId: savedTask.projectId,
                  projectName: savedTask.projectId
                    ? projectNameById.get(savedTask.projectId) ?? item.projectName
                    : null,
                  recurrenceSeriesId: savedTask.recurrenceSeriesId,
                  repeatEnabled: savedTask.repeatEnabled,
                  repeatPattern: savedTask.repeatPattern,
                  repeatInterval: savedTask.repeatInterval ?? 1,
                  repeatDays: savedTask.repeatDays,
                  repeatWeeklyDay: savedTask.repeatWeeklyDay,
                  repeatMonthlyDay: savedTask.repeatMonthlyDay,
                  repeatPaused: savedTask.repeatPaused,
                  repeatPauseUntil: toDateOnly(savedTask.repeatPauseUntil),
                  repeatPauseNote: savedTask.repeatPauseNote,
                  isPriority: savedTask.isPriority,
                  completedOn: toDateOnly(savedTask.completedOn),
                }
              : item
          )
        );

        if (previousTask) {
          const actionDate = getBrisbaneDate(new Date());
          const previousOverdue = isTaskOverdue(previousTask.dueAt, actionDate);
          const nextOverdue = isTaskOverdue(nextDueAt, actionDate);

          if (previousOverdue !== nextOverdue) {
            setCounts((prev) => ({
              ...prev,
              overdue: Math.max(0, prev.overdue + (nextOverdue ? 1 : -1)),
            }));
          }
        }

        const newCategory = savedTask.category?.trim();
        if (newCategory) {
          setCategorySuggestions((prev) => {
            const exists = prev.some(
              (item) => item.toLocaleLowerCase() === newCategory.toLocaleLowerCase()
            );
            if (exists) return prev;

            return [...prev, newCategory].sort((left, right) =>
              left.localeCompare(right, undefined, { sensitivity: "base" })
            );
          });
        }
      }

      setEditTaskId(null);
      setEditTaskForm(null);
    } catch (error) {
      if (pendingNote) {
        setEditTaskForm((prev) =>
          prev
            ? {
                ...prev,
                notes: pendingNoteText,
                waitingOn: pendingWaitingOn,
                noteHistory: prev.noteHistory.filter((note) => note.id !== pendingNote.id),
              }
            : prev
        );
        setOpenTasks((prev) =>
          prev.map((task) =>
            task.id === editTaskId
              ? {
                  ...task,
                  noteHistory: task.noteHistory.filter(
                    (note) => note.id !== pendingNote.id
                  ),
                }
              : task
          )
        );
      }
      alert(
        pendingNote
          ? error instanceof Error
            ? `Could not save task note. ${error.message}`
            : "Could not save task note. Your note text is still in the editor."
          : error instanceof Error
            ? error.message
            : "Could not update task"
      );
    } finally {
      setEditTaskSaving(false);
    }
  }

  async function handleToggleTask(task: OverviewTask, completed: boolean) {
    setContextMenu(null);
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(task.id, completed ? "complete" : "update")) return;
    setBusyAction(true);

    const actionDate = getBrisbaneDate(new Date());

    try {
      const response = await patchTask(task.id, {
        completed,
        completedOn: completed ? actionDate : null,
      });

      await waitForMinimumPendingTime(pendingStartedAt);
      if (completed) {
        const createdTask = response.createdTask
          ? normalizeOverviewTask({
              ...response.createdTask,
              startDate: toDateOnly(response.createdTask.startDate),
              dueAt: toDateOnly(response.createdTask.dueAt),
              completedOn: toDateOnly(response.createdTask.completedOn),
              projectName: response.createdTask.projectId
                ? projectNameById.get(response.createdTask.projectId) ?? null
                : null,
            })
          : null;

        setOpenTasks((prev) => {
          const withoutCompleted = prev.filter((item) => item.id !== task.id);
          if (!createdTask) return withoutCompleted;
          return [
            createdTask,
            ...withoutCompleted.filter((item) => item.id !== createdTask.id),
          ];
        });
        setCounts((prev) => ({
          ...prev,
          open: createdTask ? prev.open : Math.max(0, prev.open - 1),
          done: prev.done + 1,
          overdue: Math.max(
            0,
            prev.overdue - (isTaskOverdue(task.dueAt, actionDate) ? 1 : 0)
          ),
        }));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update task");
    } finally {
      setBusyAction(false);
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(task.id);
    }
  }

  async function handleDeleteTask(task: OverviewTask) {
    setContextMenu(null);
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(task.id, "delete")) return;
    setDeleteTaskSaving(true);
    setBusyAction(true);

    try {
      await deleteTask(task.id);
      await waitForMinimumPendingTime(pendingStartedAt);
      removeTaskFromCard(task);
      setDeleteTaskModalTask(null);
      setDeleteTaskMode("this");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete task");
    } finally {
      setDeleteTaskSaving(false);
      setBusyAction(false);
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(task.id);
    }
  }

  async function handleDeleteRecurringTask(task: OverviewTask, mode: DeleteMode) {
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(task.id, "delete")) return;
    setDeleteTaskSaving(true);

    try {
      await deleteTask(task.id, mode);
      await waitForMinimumPendingTime(pendingStartedAt);
      if (mode === "this") {
        removeTaskFromCard(task);
      } else {
        router.refresh();
      }
      setDeleteTaskModalTask(null);
      setDeleteTaskMode("this");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete task");
    } finally {
      setDeleteTaskSaving(false);
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(task.id);
    }
  }

  async function submitProjectEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editProjectId || !editProjectForm) return;

    setEditProjectSaving(true);

    try {
      const project = await patchProject(editProjectId, {
        name: editProjectForm.name.trim(),
        startDate: editProjectForm.startDate,
        dueAt: editProjectForm.dueAt || null,
        category: editProjectForm.category || null,
      });
      setProjects((prev) => prev.map((item) => (item.id === editProjectId ? project : item)));
      setOpenTasks((prev) =>
        prev.map((task) =>
          task.projectId === editProjectId ? { ...task, projectName: project.name } : task
        )
      );
      closeProjectEditor();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update project");
    } finally {
      setEditProjectSaving(false);
    }
  }

  async function handleArchiveProject(group: TaskGroup) {
    if (!group.projectId) {
      return;
    }

    setContextMenu(null);
    setBusyAction(true);

    try {
      await patchProject(group.projectId, { archived: true });
      setProjects((prev) =>
        prev.map((project) =>
          project.id === group.projectId ? { ...project, archived: true } : project
        )
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not archive project");
    } finally {
      setBusyAction(false);
    }
  }

  function getTaskSnoozeBaseDateValue(task: OverviewTask, actionDate: string) {
    return task.startDate > actionDate ? task.startDate : actionDate;
  }

  function openSingleTaskSnoozeDate(task: OverviewTask) {
    const actionDate = getBrisbaneDate(new Date());
    setContextMenu(null);
    setSingleSnoozeTask(task);
    setSingleSnoozeDateValue(
      getSnoozeDateValue(getTaskSnoozeBaseDateValue(task, actionDate), "tomorrow")
    );
  }

  function closeSingleTaskSnoozeModal() {
    if (singleSnoozeSaving) return;
    setSingleSnoozeTask(null);
    setSingleSnoozeDateValue("");
  }

  async function submitSingleTaskSnooze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!singleSnoozeTask) return;

    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(singleSnoozeTask.id, "update")) return;
    setSingleSnoozeSaving(true);

    try {
      await patchTask(singleSnoozeTask.id, { startDate: singleSnoozeDateValue });
      await waitForMinimumPendingTime(pendingStartedAt);
      setOpenTasks((prev) =>
        prev.map((task) =>
          task.id === singleSnoozeTask.id
            ? { ...task, startDate: singleSnoozeDateValue }
            : task
        )
      );
      setSingleSnoozeTask(null);
      setSingleSnoozeDateValue("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not snooze task");
    } finally {
      setSingleSnoozeSaving(false);
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(singleSnoozeTask.id);
    }
  }

  function closeRepeatPauseModal() {
    if (repeatPauseSaving) return;
    setRepeatPauseTask(null);
    setRepeatPausePreset("tomorrow");
    setRepeatPauseUntilValue("");
    setRepeatPauseNoteValue("");
  }

  function requestToggleRepeatPause(task: OverviewTask) {
    setContextMenu(null);
    if (!isRecurringOverviewTask(task)) return;
    const actionDate = getBrisbaneDate(new Date());

    if (isOverviewRepeatPausedOnDate(task, actionDate)) {
      const pendingStartedAt = Date.now();
      if (!startTaskPendingAction(task.id, "update")) return;
      void patchTask(task.id, {
        repeatPaused: false,
        repeatPauseUntil: null,
        repeatPauseNote: null,
      })
        .then(async () => {
          await waitForMinimumPendingTime(pendingStartedAt);
          setOpenTasks((prev) =>
            prev.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    repeatPaused: false,
                    repeatPauseUntil: null,
                    repeatPauseNote: null,
                  }
                : item
            )
          );
        })
        .catch((error: unknown) => {
          alert(error instanceof Error ? error.message : "Could not resume repeat");
        })
        .finally(async () => {
          await waitForMinimumPendingTime(pendingStartedAt);
          finishTaskPendingAction(task.id);
        });
      return;
    }

    setRepeatPauseTask(task);
    setRepeatPausePreset("tomorrow");
    setRepeatPauseUntilValue(
      getRepeatPauseUntilForPreset(actionDate, "tomorrow")
    );
    setRepeatPauseNoteValue(task.repeatPauseNote ?? "");
  }

  async function pauseRepeatTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repeatPauseTask) return;

    const repeatPauseUntil =
      repeatPausePreset === "tomorrow" || repeatPausePreset === "next-week"
        ? getRepeatPauseUntilForPreset(
            getBrisbaneDate(new Date()),
            repeatPausePreset
          )
        : repeatPausePreset === "indefinite"
          ? null
          : repeatPauseUntilValue || null;
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(repeatPauseTask.id, "update")) return;
    setRepeatPauseSaving(true);

    try {
      await patchTask(repeatPauseTask.id, {
        repeatPaused: true,
        repeatPauseUntil,
        repeatPauseNote: repeatPauseNoteValue.trim() || null,
      });
      await waitForMinimumPendingTime(pendingStartedAt);
      setOpenTasks((prev) =>
        prev.map((task) =>
          task.id === repeatPauseTask.id
            ? {
                ...task,
                repeatPaused: true,
                repeatPauseUntil,
                repeatPauseNote: repeatPauseNoteValue.trim() || null,
              }
            : task
        )
      );
      setRepeatPauseTask(null);
      setRepeatPausePreset("tomorrow");
      setRepeatPauseUntilValue("");
      setRepeatPauseNoteValue("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not pause repeat");
    } finally {
      setRepeatPauseSaving(false);
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(repeatPauseTask.id);
    }
  }

  async function handleToggleTaskPriority(task: OverviewTask) {
    setContextMenu(null);
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(task.id, "update")) return;
    setBusyAction(true);

    try {
      await patchTask(task.id, { isPriority: !task.isPriority });
      await waitForMinimumPendingTime(pendingStartedAt);
      setOpenTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, isPriority: !item.isPriority } : item
        )
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update task");
    } finally {
      setBusyAction(false);
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(task.id);
    }
  }

  async function handleToggleProjectPriority(group: TaskGroup) {
    if (!group.projectId) {
      return;
    }

    setContextMenu(null);
    setBusyAction(true);

    try {
      const project = await patchProject(group.projectId, { isPriority: !group.isPriority });
      setProjects((prev) => prev.map((item) => (item.id === project.id ? project : item)));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update project");
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <article
      className={`${cardClass} ${collapsed ? "" : "h-full"} max-w-full transition ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragActive ? "opacity-60" : ""} ${
        dragOverPosition === "before"
          ? "ring-2 ring-inset ring-[color:var(--tm-text)]"
          : dragOverPosition === "after"
            ? "ring-2 ring-[color:var(--tm-text)] ring-offset-2 ring-offset-[color:var(--tm-bg)]"
            : ""
      }`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", profile.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">{profile.name}</h2>
          </div>
          <ProfileCardActionsMenu
            collapsed={collapsed}
            onAddTask={openTaskDialog}
            onAddProject={openProjectDialog}
            onToggleCollapsed={() => setCollapsed((prev) => !prev)}
          />
        </div>
        <div className="min-w-0">
          <div className="mt-2 flex flex-wrap gap-1.5 text-[color:var(--tm-muted)]">
            <span className={overviewCounterChipClass}>
              <span>Open</span>
              <span className="font-semibold text-[color:var(--tm-text)]">{displayCounts.openNow}</span>
            </span>
            <span className={overviewCounterChipClass}>
              <span>Upcoming</span>
              <span className="font-semibold text-[color:var(--tm-text)]">{displayCounts.upcoming}</span>
            </span>
            <span className={overviewCounterChipClass}>
              <span>Done</span>
              <span className="font-semibold text-[color:var(--tm-text)]">{counts.done}</span>
            </span>
            <span className={overviewCounterChipClass}>
              <span>OD</span>
              <span className="font-semibold text-[color:var(--tm-text)]">{displayCounts.overdue}</span>
            </span>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="mt-4 space-y-2 md:hidden">
            {groupedVisibleTasks.length === 0 ? (
              <div className="text-sm text-[color:var(--tm-muted)]">
                {selectedFilter === "all-open" ? "No open tasks." : "No matching tasks"}
              </div>
            ) : (
              groupedVisibleTasks.map((group) => {
                const isGroupCollapsed = collapsedGroups[group.key] ?? false;

                return (
                  <section
                    key={group.key}
                    className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/30"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium"
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [group.key]: !(prev[group.key] ?? false),
                        }))
                      }
                    >
                      <span className="min-w-0 truncate">
                        {isGroupCollapsed ? "▸" : "▾"} {group.label}
                      </span>
                      <span className="shrink-0 text-xs text-[color:var(--tm-muted)]">
                        {group.taskCount}
                      </span>
                    </button>
                    {!isGroupCollapsed && (
                      <div className="space-y-2 border-t border-[color:var(--tm-border)] p-2">
                        {group.tasks.map((task) => {
                          const pendingAction = pendingTaskActions[task.id] ?? null;
                          const pendingLabel =
                            pendingAction === "complete"
                              ? "Completing..."
                              : pendingAction === "delete"
                                ? "Deleting..."
                                : pendingAction
                                  ? "Updating..."
                                  : null;
                          const pendingToneClass =
                            pendingAction === "complete"
                              ? "border-emerald-300 bg-emerald-50/90 text-emerald-800"
                              : pendingAction === "delete"
                                ? "border-red-300 bg-red-50/90 text-red-800"
                                : "border-slate-300 bg-slate-100/90 text-slate-800";
                          const taskOverdue = isTaskOverdue(task.dueAt, currentDateValue);

                          return (
                          <article
                            key={task.id}
                            className={`group/task rounded-[10px] border border-[color:var(--tm-border)] bg-white/55 p-3 ${
                              taskOverdue ? "bg-[#fff1e7]" : ""
                            } ${
                              task.isPriority
                                ? "shadow-[inset_4px_0_0_0_rgba(183,122,116,0.78)]"
                                : ""
                            } ${
                              task.delegatedTask ? "border-l-4 border-l-sky-200/70" : ""
                            } ${
                              pendingAction === "complete"
                                ? "bg-emerald-50/90 opacity-75 ring-2 ring-emerald-200"
                                : pendingAction === "delete"
                                  ? "bg-red-50/80 opacity-75 ring-2 ring-red-200"
                                  : pendingAction
                                    ? "bg-slate-100/90 opacity-75 ring-2 ring-slate-200"
                                    : ""
                            }`}
                            onContextMenu={(event) => openTaskContextMenu(event, task)}
                          >
                            <div className="relative min-w-0 overflow-hidden pr-16">
                              <DoneTaskButton
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/task:opacity-100 group-focus-within/task:opacity-100 focus:opacity-100"
                                disabled={busyAction || Boolean(pendingAction)}
                                label={`Mark ${task.title} done`}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => void handleToggleTask(task, true)}
                              />
                              <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden font-medium leading-snug">
                                {task.delegatedTask ? (
                                  <span className="shrink-0">
                                    <DelegatedSenderBadge
                                      sender={task.delegatedTask.assignedByUser}
                                    />
                                  </span>
                                ) : null}
                                <span
                                  className={`min-w-0 flex-1 truncate ${
                                    pendingAction === "complete" ? "line-through opacity-70" : ""
                                  }`}
                                  title={task.title}
                                >
                                  {task.title}
                                </span>
                                {pendingAction === "complete" && (
                                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">
                                    ✓
                                  </span>
                                )}
                                {pendingLabel ? (
                                  <span
                                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass}`}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    {pendingLabel}
                                  </span>
                                ) : null}
                                {hasTaskNotes(task) && (
                                  <span className="shrink-0">
                                    <TaskNotesIndicator notes={formatTaskNotesPreview(task)} />
                                  </span>
                                )}
                                {taskOverdue && (
                                  <span className={`${overdueChipClass} shrink-0`}>OD</span>
                                )}
                              </div>
                            </div>
                            {task.delegatedTask ? (
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[color:var(--tm-muted)]">
                                {task.delegatedTask ? (
                                <DelegatedTaskStatusPill status={task.delegatedTask.status} />
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>

          <div className="mt-4 hidden max-w-full overflow-hidden md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                  <th className="px-2 py-2">Title</th>
                </tr>
              </thead>
              <tbody>
                {groupedVisibleTasks.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-sm text-[color:var(--tm-muted)]">
                      {selectedFilter === "all-open" ? "No open tasks." : "No matching tasks"}
                    </td>
                  </tr>
                ) : (
                  groupedVisibleTasks.map((group) => {
                    const isGroupCollapsed = collapsedGroups[group.key] ?? false;
                    const isProjectGroup =
                      groupingMode === "project" && !group.isUnassigned && Boolean(group.projectId);
                    const groupDragPosition =
                      dragOverProjectId === group.projectId ? dragOverProjectPosition : null;

                    return (
                      <Fragment key={group.key}>
                        <tr
                          className={`border-b border-[color:var(--tm-border)] bg-white/30 ${
                            group.isPriority
                              ? "bg-[rgba(243,225,220,0.9)] shadow-[inset_4px_0_0_0_rgba(183,122,116,0.8)]"
                              : ""
                          } ${
                            isProjectGroup ? "cursor-grab active:cursor-grabbing" : ""
                          } ${
                            groupDragPosition === "before"
                              ? "shadow-[inset_0_2px_0_0_var(--tm-text)]"
                              : groupDragPosition === "after"
                                ? "shadow-[inset_0_-2px_0_0_var(--tm-text)]"
                                : ""
                          } ${draggedProjectId === group.projectId ? "opacity-60" : ""}`}
                          draggable={isProjectGroup && !projectReordering}
                          onDragStart={
                            isProjectGroup && group.projectId
                              ? (event) => handleProjectDragStart(event, group.projectId as string)
                              : undefined
                          }
                          onDragEnd={isProjectGroup ? finishProjectDrag : undefined}
                          onDragOver={
                            isProjectGroup && group.projectId
                              ? (event) => handleProjectDragOver(event, group.projectId as string)
                              : undefined
                          }
                          onDrop={
                            isProjectGroup && group.projectId
                              ? (event) => handleProjectDrop(event, group.projectId as string)
                              : undefined
                          }
                          onContextMenu={
                            isProjectGroup
                              ? (event) => openProjectContextMenu(event, group)
                              : undefined
                          }
                        >
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 text-sm font-medium"
                              onClick={() =>
                                setCollapsedGroups((prev) => ({
                                  ...prev,
                                  [group.key]: !(prev[group.key] ?? false),
                                }))
                              }
                            >
                              <span>{isGroupCollapsed ? "▸" : "▾"}</span>
                              <span>{group.label}</span>
                              {isProjectGroup && group.isPriority ? (
                                <span className={priorityChipClass}>Priority</span>
                              ) : null}
                              <span className="text-[color:var(--tm-muted)]">({group.taskCount})</span>
                            </button>
                          </td>
                        </tr>
                        {!isGroupCollapsed &&
                          group.tasks.map((task) => {
                            const pendingAction = pendingTaskActions[task.id] ?? null;
                            const pendingLabel =
                              pendingAction === "complete"
                                ? "Completing..."
                                : pendingAction === "delete"
                                  ? "Deleting..."
                                  : pendingAction
                                    ? "Updating..."
                                    : null;
                            const pendingToneClass =
                              pendingAction === "complete"
                                ? "border-emerald-300 bg-emerald-50/90 text-emerald-800"
                                : pendingAction === "delete"
                                  ? "border-red-300 bg-red-50/90 text-red-800"
                                  : "border-slate-300 bg-slate-100/90 text-slate-800";
                            const taskOverdue = isTaskOverdue(task.dueAt, currentDateValue);

                            return (
                            <tr
                              key={task.id}
                              className={`group/task tm-table-row border-b border-l-4 border-l-transparent border-[color:var(--tm-border)] align-top ${
                                taskOverdue ? "bg-[#fff1e7]" : ""
                              } ${
                                task.isPriority
                                  ? `${taskOverdue ? "" : "bg-[rgba(243,225,220,0.82)]"} shadow-[inset_4px_0_0_0_rgba(183,122,116,0.78)]`
                                  : ""
                              } ${
                                task.delegatedTask ? "border-l-sky-200/70" : ""
                              } ${
                                taskReordering ? "cursor-grabbing" : "cursor-grab"
                              } ${
                                draggedTaskId === task.id ? "opacity-60" : ""
                              } ${
                                pendingAction === "complete"
                                  ? "bg-emerald-50/90 opacity-75 ring-2 ring-inset ring-emerald-200"
                                  : pendingAction === "delete"
                                    ? "bg-red-50/80 opacity-75 ring-2 ring-inset ring-red-200"
                                    : pendingAction
                                      ? "bg-slate-100/90 opacity-75 ring-2 ring-inset ring-slate-200"
                                      : ""
                              } ${
                                dragOverTaskId === task.id &&
                                dragOverTaskGroupKey === group.key &&
                                dragOverTaskPosition === "before"
                                  ? "shadow-[inset_0_2px_0_0_var(--tm-text)]"
                                  : dragOverTaskId === task.id &&
                                      dragOverTaskGroupKey === group.key &&
                                      dragOverTaskPosition === "after"
                                    ? "shadow-[inset_0_-2px_0_0_var(--tm-text)]"
                                    : ""
                              }`}
                              draggable={!taskReordering}
                              onDragStart={(event) => handleTaskDragStart(event, task.id, group.key)}
                              onDragEnd={finishTaskDrag}
                              onDragOver={(event) => handleTaskDragOver(event, task.id, group.key)}
                              onDrop={(event) => handleTaskDrop(event, task.id, group.key)}
                              onContextMenu={(event) => openTaskContextMenu(event, task)}
                            >
                              <td className="px-2 py-2.5 font-medium">
                                <div className="relative min-w-0 overflow-hidden pr-16">
                                  <DoneTaskButton
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/task:opacity-100 group-focus-within/task:opacity-100 focus:opacity-100"
                                    disabled={busyAction || Boolean(pendingAction)}
                                    label={`Mark ${task.title} done`}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => void handleToggleTask(task, true)}
                                  />
                                  <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
                                    {task.delegatedTask ? (
                                      <span className="shrink-0">
                                        <DelegatedSenderBadge
                                          sender={task.delegatedTask.assignedByUser}
                                        />
                                      </span>
                                    ) : null}
                                    <span
                                      className={`min-w-0 flex-1 truncate ${
                                        pendingAction === "complete"
                                          ? "line-through opacity-70"
                                          : ""
                                      }`}
                                      title={task.title}
                                    >
                                      {task.title}
                                    </span>
                                    {pendingAction === "complete" ? (
                                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">
                                        ✓
                                      </span>
                                    ) : null}
                                    {pendingLabel ? (
                                      <span
                                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass}`}
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                        {pendingLabel}
                                      </span>
                                    ) : null}
                                    {hasTaskNotes(task) && (
                                      <span className="shrink-0">
                                        <TaskNotesIndicator notes={formatTaskNotesPreview(task)} />
                                      </span>
                                    )}
                                    {taskOverdue && (
                                      <span className={`${overdueChipClass} shrink-0`}>OD</span>
                                    )}
                                    {task.delegatedTask ? (
                                      <span className="shrink-0">
                                        <DelegatedTaskStatusPill status={task.delegatedTask.status} />
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {hasTaskNotes(task) && (
                                  <span className="sr-only">Has notes</span>
                                )}
                              </td>
                            </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredOpenTasks.length > overviewTaskPreviewLimit && (
            <div className="mt-3">
              <button
                type="button"
                className="tm-button inline-flex h-8 items-center justify-center rounded-[10px] border px-3 text-sm"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll
                  ? "Show less"
                  : `Show more (${filteredOpenTasks.length - overviewTaskPreviewLimit})`}
              </button>
            </div>
          )}
        </>
      )}

      <AddTaskModal
        open={dialogOpen}
        form={taskDraft}
        saving={saving}
        categorySuggestions={categorySuggestions}
        waitingOnSuggestions={waitingOnSuggestions}
        projectOptions={orderedProjects}
        submitLabel={saving ? "Saving..." : "Save & Close"}
        submitDisabled={!taskDraft.title.trim()}
        onClose={closeDialog}
        onSubmit={onSubmit}
        onFormChange={(updater) => setTaskDraft((prev) => updater(prev))}
      />

      <ProjectEditorModal
        open={projectDialogOpen}
        form={projectDraft}
        saving={projectSaving}
        title="Add Project"
        submitLabel={projectSaving ? "Creating…" : "Create Project"}
        onClose={closeProjectDialog}
        onSubmit={onProjectSubmit}
        onFormChange={(updater) => setProjectDraft((prev) => updater(prev))}
      />

      <OverviewUtilityModal
        open={Boolean(singleSnoozeTask)}
        title="Snooze task"
        onClose={closeSingleTaskSnoozeModal}
      >
        {singleSnoozeTask && (
          <form className="space-y-4" onSubmit={submitSingleTaskSnooze}>
            <input
              autoFocus
              className={`${inputClass} w-full`}
              required
              type="date"
              value={singleSnoozeDateValue}
              onChange={(event) => setSingleSnoozeDateValue(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                disabled={singleSnoozeSaving}
                type="button"
                onClick={closeSingleTaskSnoozeModal}
              >
                Cancel
              </button>
              <button className={buttonClass} disabled={singleSnoozeSaving} type="submit">
                Apply
              </button>
            </div>
          </form>
        )}
      </OverviewUtilityModal>

      <OverviewUtilityModal
        open={Boolean(repeatPauseTask)}
        title="Pause Repeat"
        onClose={closeRepeatPauseModal}
      >
        {repeatPauseTask && (
          <form className="space-y-4" onSubmit={pauseRepeatTask}>
            <div className="space-y-2">
              {REPEAT_PAUSE_PRESET_OPTIONS.map((option) => (
                <label key={option.value} className={modalChoiceClass}>
                  <input
                    checked={repeatPausePreset === option.value}
                    name={`overview-repeat-pause-preset-${profile.id}`}
                    type="radio"
                    value={option.value}
                    onChange={() => {
                      setRepeatPausePreset(option.value);
                      if (option.value === "tomorrow" || option.value === "next-week") {
                        setRepeatPauseUntilValue(
                          getRepeatPauseUntilForPreset(
                            getBrisbaneDate(new Date()),
                            option.value
                          )
                        );
                      }
                      if (option.value === "indefinite") {
                        setRepeatPauseUntilValue("");
                      }
                    }}
                  />
                  <div className="font-medium">{option.label}</div>
                </label>
              ))}
            </div>
            {repeatPausePreset === "custom" && (
              <label className="space-y-1 text-sm">
                <div className="tm-muted">Pause until</div>
                <input
                  autoFocus
                  className={`${inputClass} w-full`}
                  required
                  type="date"
                  value={repeatPauseUntilValue}
                  onChange={(event) => setRepeatPauseUntilValue(event.target.value)}
                />
              </label>
            )}
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Note</div>
              <input
                className={`${inputClass} w-full`}
                placeholder="Optional reason"
                value={repeatPauseNoteValue}
                onChange={(event) => setRepeatPauseNoteValue(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                disabled={repeatPauseSaving}
                type="button"
                onClick={closeRepeatPauseModal}
              >
                Cancel
              </button>
              <button className={buttonClass} disabled={repeatPauseSaving} type="submit">
                Pause Repeat
              </button>
            </div>
          </form>
        )}
      </OverviewUtilityModal>

      <DelegateTaskModal
        open={Boolean(delegateTask)}
        mode={
          delegateTask
            ? {
                mode: "existing",
                taskId: delegateTask.id,
                taskTitle: delegateTask.title,
              }
            : { mode: "new" }
        }
        onClose={() => setDelegateTask(null)}
        onDelegated={markTaskDelegated}
      />

      <TaskEditorModal
        open={Boolean(editTaskId && editTaskForm)}
        form={editTaskForm}
        saving={editTaskSaving}
        categorySuggestions={categorySuggestions}
        waitingOnSuggestions={waitingOnSuggestions}
        projectOptions={projectOptions}
        onClose={closeTaskEditor}
        onSubmit={submitTaskEditor}
        onFormChange={(updater) =>
          setEditTaskForm((prev) => (prev ? updater(prev) : prev))
        }
      />
      <DiscardChangesModal
        open={Boolean(discardTarget)}
        onKeepEditing={() => setDiscardTarget(null)}
        onDiscardChanges={discardUnsavedChanges}
      />

      <ProjectEditorModal
        open={Boolean(editProjectId && editProjectForm)}
        form={editProjectForm}
        saving={editProjectSaving}
        title="Edit Project"
        submitLabel={editProjectSaving ? "Saving…" : "Save Project"}
        onClose={closeProjectEditor}
        onSubmit={submitProjectEditor}
        onFormChange={(updater) =>
          setEditProjectForm((prev) => (prev ? updater(prev) : prev))
        }
      />

      <TaskDeleteConfirmationModal
        open={Boolean(deleteTaskModalTask)}
        taskTitle={deleteTaskModalTask?.title ?? ""}
        recurring={Boolean(deleteTaskModalTask?.recurrenceSeriesId)}
        mode={deleteTaskMode}
        saving={deleteTaskSaving}
        modeName={`overview-delete-mode-${profile.id}`}
        onModeChange={setDeleteTaskMode}
        onCancel={() => {
          setDeleteTaskModalTask(null);
          setDeleteTaskMode("this");
        }}
        onConfirm={(mode) => {
          if (!deleteTaskModalTask) return;

          if (deleteTaskModalTask.recurrenceSeriesId) {
            void handleDeleteRecurringTask(deleteTaskModalTask, mode);
            return;
          }

          void handleDeleteTask(deleteTaskModalTask);
        }}
      />

      {contextMenu && (
        (() => {
          const menuHeight =
            contextMenu.type === "task" && isRecurringOverviewTask(contextMenu.task) ? 300 : 240;
          const maxHeight =
            typeof window === "undefined"
              ? menuHeight
              : Math.min(menuHeight, Math.max(120, window.innerHeight - 24));
          const maxX =
            typeof window === "undefined" ? contextMenu.x : Math.max(12, window.innerWidth - 196);
          const maxY =
            typeof window === "undefined"
              ? contextMenu.y
              : Math.max(12, window.innerHeight - maxHeight - 12);

          return (
        <div
          className="tm-menu fixed z-[60] min-w-44 overflow-hidden rounded-lg border py-1 text-left shadow-2xl"
          role="menu"
          style={{
            left: Math.min(contextMenu.x, maxX),
            top: Math.min(contextMenu.y, maxY),
            maxHeight,
            overflowY: "auto",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.type === "task" ? (
            (() => {
              const taskPending = Boolean(pendingTaskActions[contextMenu.task.id]);

              return (
            <>
              <button
                type="button"
                className={taskActionMenuItemClass}
                role="menuitem"
                onClick={() => openSingleTaskSnoozeDate(contextMenu.task)}
                disabled={busyAction || taskPending}
              >
                Snooze
              </button>
              <button
                type="button"
                className={taskActionMenuItemClass}
                role="menuitem"
                onClick={() => void handleToggleTaskPriority(contextMenu.task)}
                disabled={busyAction || taskPending}
              >
                {contextMenu.task.isPriority ? "Unprioritise" : "Prioritise"}
              </button>
              <button
                type="button"
                className={taskActionMenuItemClass}
                role="menuitem"
                onClick={() => openTaskEditor(contextMenu.task)}
                disabled={busyAction || editTaskSaving || editProjectSaving || taskPending}
              >
                Edit
              </button>
              <button
                type="button"
                className={taskActionMenuItemClass}
                role="menuitem"
                onClick={() =>
                  void handleToggleTask(contextMenu.task, !Boolean(contextMenu.task.completedOn))
                }
                disabled={busyAction || taskPending}
              >
                {contextMenu.task.completedOn ? "Open" : "Done"}
              </button>
              {isRecurringOverviewTask(contextMenu.task) && (
                <button
                  type="button"
                  className={taskActionMenuItemClass}
                  role="menuitem"
                  onClick={() => requestToggleRepeatPause(contextMenu.task)}
                  disabled={busyAction || taskPending}
                >
                  {isOverviewRepeatPausedOnDate(contextMenu.task, currentDateValue)
                    ? "Resume Repeat"
                    : "Pause Repeat"}
                </button>
              )}
              <button
                type="button"
                className={taskActionMenuItemClass}
                role="menuitem"
                onClick={() => openDelegateTask(contextMenu.task)}
                disabled={busyAction || taskPending || Boolean(contextMenu.task.delegatedTask)}
              >
                {contextMenu.task.delegatedTask ? "Already delegated" : "Delegate Task"}
              </button>
              <button
                type="button"
                className={`${taskActionMenuItemClass} text-red-700 hover:bg-red-50`}
                role="menuitem"
                onClick={() => requestDeleteTask(contextMenu.task)}
                disabled={busyAction || taskPending}
              >
                Delete
              </button>
            </>
              );
            })()
          ) : (
            <>
              {contextMenu.group.projectId && (
                <button
                  type="button"
                  className={taskActionMenuItemClass}
                  role="menuitem"
                  onClick={() => openProjectEditor(contextMenu.group)}
                  disabled={busyAction || editTaskSaving || editProjectSaving}
                >
                  Edit
                </button>
              )}
              {!contextMenu.group.isUnassigned && (
                <button
                  type="button"
                  className={taskActionMenuItemClass}
                  role="menuitem"
                  onClick={() => void handleArchiveProject(contextMenu.group)}
                  disabled={busyAction}
                >
                  Archive
                </button>
              )}
              {contextMenu.group.projectId && (
                <button
                  type="button"
                  className={taskActionMenuItemClass}
                  role="menuitem"
                  onClick={() => void handleToggleProjectPriority(contextMenu.group)}
                  disabled={busyAction}
                >
                  {contextMenu.group.isPriority ? "Unprioritise" : "Prioritise"}
                </button>
              )}
            </>
          )}
        </div>
          );
        })()
      )}
    </article>
  );
}

export function OverviewClient({
  profiles,
  userPreferenceKey,
  initialDate,
}: OverviewClientProps) {
  const [currentDateValue, setCurrentDateValue] = useState(initialDate);
  const [orderedProfiles, setOrderedProfiles] = useState(profiles);
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<OverviewTaskFilter>(
    DEFAULT_OVERVIEW_OPTIONS.selectedFilter
  );
  const [sortMode, setSortMode] = useState<OverviewSortMode>(
    DEFAULT_OVERVIEW_OPTIONS.sortMode
  );
  const [groupingMode, setGroupingMode] = useState<OverviewGroupingMode>(
    DEFAULT_OVERVIEW_OPTIONS.groupingMode
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [overviewOptionsLoaded, setOverviewOptionsLoaded] = useState(false);

  const filterOptions: Array<{ value: OverviewTaskFilter; label: string }> = [
    { value: "all-open", label: "All open" },
    { value: "today", label: "Today" },
    { value: "overdue", label: "Overdue" },
    { value: "upcoming", label: "Upcoming" },
  ];
  const groupingOptions: Array<{ value: OverviewGroupingMode; label: string }> = [
    { value: "project", label: "Project" },
    { value: "category", label: "Category" },
  ];
  const sortOptions: Array<{ value: OverviewSortMode; label: string }> = [
    { value: "manual", label: "Manual" },
    { value: "start-date", label: "Start date" },
    { value: "due-date", label: "Due date" },
  ];

  useEffect(() => {
    setOrderedProfiles(profiles);
  }, [profiles]);

  useBrisbaneBoundaryRefresh((now) => {
    setCurrentDateValue(getBrisbaneDate(now));
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = getOverviewOptionsStorageKey(userPreferenceKey);
    const storedOptions = parseOverviewOptionsPreference(
      window.localStorage.getItem(storageKey)
    );

    if (storedOptions) {
      setSelectedFilter(storedOptions.selectedFilter);
      setSortMode(storedOptions.sortMode);
      setGroupingMode(storedOptions.groupingMode);
      setOverviewOptionsLoaded(true);
      return;
    }

    setOverviewOptionsLoaded(true);
  }, [userPreferenceKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !overviewOptionsLoaded) {
      return;
    }

    window.localStorage.setItem(
      getOverviewOptionsStorageKey(userPreferenceKey),
      JSON.stringify({ selectedFilter, sortMode, groupingMode })
    );
  }, [
    groupingMode,
    overviewOptionsLoaded,
    selectedFilter,
    sortMode,
    userPreferenceKey,
  ]);

  const filteredProfiles = useMemo(() => {
    const trimmedQuery = query.trim().toLocaleLowerCase();
    if (!trimmedQuery) return orderedProfiles;

    return orderedProfiles.filter((profile) =>
      profile.name.toLocaleLowerCase().includes(trimmedQuery)
    );
  }, [orderedProfiles, query]);

  async function persistOrder(
    nextProfiles: OverviewProfileData[],
    previousProfiles: OverviewProfileData[]
  ) {
    setReordering(true);

    try {
      const res = await fetch("/api/profiles/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: nextProfiles.map((profile) => profile.id),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not save profile order");
      }

      const savedProfiles = (await res.json()) as ReorderResponseProfile[];
      setOrderedProfiles(reorderProfilesByIds(nextProfiles, savedProfiles.map((profile) => profile.id)));
    } catch (error) {
      setOrderedProfiles(previousProfiles);
      alert(error instanceof Error ? error.message : "Could not save profile order");
    } finally {
      setReordering(false);
    }
  }

  function handleDragStart(profileId: string) {
    setDraggedId(profileId);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverIndex(null);
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>, index: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const bounds = event.currentTarget.getBoundingClientRect();
    const useVerticalSplit = window.matchMedia("(max-width: 767px)").matches;
    const midpoint = useVerticalSplit
      ? bounds.top + bounds.height / 2
      : bounds.left + bounds.width / 2;

    setDragOverIndex(
      useVerticalSplit
        ? event.clientY < midpoint
          ? index
          : index + 1
        : event.clientX < midpoint
          ? index
          : index + 1
    );
  }

  async function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedId || dragOverIndex === null) {
      handleDragEnd();
      return;
    }

    const previousProfiles = orderedProfiles;
    const nextProfiles = reorderFilteredProfiles(
      previousProfiles,
      filteredProfiles,
      draggedId,
      dragOverIndex
    );

    handleDragEnd();

    const previousOrder = previousProfiles.map((profile) => profile.id).join(",");
    const nextOrder = nextProfiles.map((profile) => profile.id).join(",");
    if (previousOrder === nextOrder) {
      return;
    }

    setOrderedProfiles(nextProfiles);
    await persistOrder(nextProfiles, previousProfiles);
  }

  return (
    <main className="min-h-screen bg-[color:var(--tm-bg)] text-[color:var(--tm-text)]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-10 xl:px-8 2xl:px-10">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Overview</h1>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              All profiles and their active tasks in one place.
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-xl sm:flex-1 sm:flex-row sm:items-center sm:justify-end">
            <OverviewOptionsMenu
              selectedFilter={selectedFilter}
              sortMode={sortMode}
              groupingMode={groupingMode}
              filterOptions={filterOptions}
              sortOptions={sortOptions}
              groupingOptions={groupingOptions}
              onFilterChange={setSelectedFilter}
              onSortChange={setSortMode}
              onGroupingChange={setGroupingMode}
            />
            <input
              className={`${inputClass} w-full sm:max-w-xs`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter profiles by name"
            />
          </div>
        </div>

        <section className="mt-6 grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfiles.length === 0 ? (
            <div className="tm-card rounded-[12px] border p-4 text-sm text-[color:var(--tm-muted)] md:col-span-2 xl:col-span-3">
              No profiles match this filter.
            </div>
          ) : (
            filteredProfiles.map((profile, index) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                currentDateValue={currentDateValue}
                selectedFilter={selectedFilter}
                sortMode={sortMode}
                groupingMode={groupingMode}
                draggable={!reordering}
                dragActive={draggedId === profile.id}
                dragOverPosition={
                  dragOverIndex === index
                    ? "before"
                    : dragOverIndex === index + 1
                      ? "after"
                      : null
                }
                onDragStart={() => handleDragStart(profile.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={handleDrop}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
