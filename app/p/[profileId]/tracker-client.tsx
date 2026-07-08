"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AddTaskModal,
  ProjectEditorModal,
  TaskEditorModal,
  createProjectForm,
  createEditTaskForm,
  type EditTaskFormState,
  type ProjectFormState,
  type RepeatFormState,
  type RepeatPattern,
  type TaskNoteHistoryEntry,
} from "@/app/components/editors";
import { TaskDeleteConfirmationModal } from "@/app/components/task-delete-confirmation-modal";
import { DelegateTaskModal } from "@/app/delegated/delegate-task-modal";
import { SundayCheckIn } from "@/app/components/sunday-check-in";
import {
  DelegatedSenderBadge,
  DelegatedTaskStatusPill,
} from "@/app/delegated/delegated-task-indicators";
import type { DelegatedTaskStatus } from "@/app/delegated/delegated-status-badge";
import {
  type AverageBasis,
  endOfMonth,
  endOfWeekSun,
  getCompletedBreakdowns,
  getDayInsightMetrics,
  getMonthInsightMetrics,
  getWeekInsightMetrics,
  inRangeInclusive,
  startOfMonth,
  startOfWeekMon,
} from "@/app/p/[profileId]/tracker-insights";

type Profile = {
  id: string;
  name: string;
  defaultView: string | null;
  averageBasis: string | null;
};

type Task = {
  id: string;
  title: string;
  startDate: string;
  dueAt: string | null;
  completedAt: string | null;
  completedOn: string | null;
  category: string | null;
  notes: string | null;
  noteHistory: TaskNoteHistoryEntry[];
  projectId: string | null;
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
  createdAt: string;
  orderIndex: number | null;
  isPriority: boolean;
  delegatedTask: {
    id: string;
    status: DelegatedTaskStatus;
    assignedByUser: {
      name: string | null;
      email: string | null;
    } | null;
  } | null;
};

type Project = {
  id: string;
  name: string;
  startDate: string;
  dueAt: string | null;
  category: string | null;
  archived: boolean;
  collapsed: boolean;
  isPriority: boolean;
  createdAt: string;
  orderIndex: number | null;
};

export type TrackerInitialData = {
  profiles: Profile[];
  tasks: Task[];
  projects: Project[];
};

type TrackerClientProps = {
  pageMode: "tracker" | "reporting";
  profileId: string;
  profileName: string;
  routineSupportEnabled?: boolean;
  initialData?: TrackerInitialData;
};

const ROUTINE_AFFIRMATIONS: Record<string, string> = {
  morning: "Starting the day feeling your best.",
  afternoon: "Strong today. Strong tomorrow.",
  nighttime: "Taking care of tomorrow’s you.",
};

type TaskFormState = RepeatFormState & {
  title: string;
  startDate: string;
  dueAt: string;
  category: string;
  notes: string;
  waitingOn: string;
  projectId: string;
};

type ViewMode = "day" | "week" | "month";
type OpenFilter = "all-active" | "today" | "upcoming" | "overdue";
type TaskView =
  | "active"
  | "today"
  | "upcoming"
  | "overdue"
  | "paused"
  | "done"
  | "archived";
type DoneRange = "today" | "week" | "month" | "all";
type SortMode = "start-date" | "due-date" | "manual";
type TaskSortColumn = "title" | "category" | "due" | "notes";
type SortDirection = "asc" | "desc";
type VisibleTaskColumn = "category" | "due" | "waitingOn" | "notes";
type DeleteMode = "this" | "future" | "series";
type DragPosition = "before" | "after";
type BulkAction =
  | "mark-done"
  | "mark-open"
  | "move-project"
  | "set-category"
  | "set-start-date"
  | "set-due-date"
  | "clear-due-date"
  | "delete";

type CalendarDay = {
  key: string;
  date: Date;
  dateValue: string;
  isCurrentMonth: boolean;
  openActiveCount: number;
  openNewCount: number;
  openDueCount: number;
};

type SearchSection = {
  key: string;
  label: string;
  tasks: Task[];
};

type QuickAddParseResult = {
  title: string;
  category: string | null;
  projectId: string | null;
  dueAt: string | null;
};

type SnoozePreset = "tomorrow" | "next-business-day" | "next-week";
type RepeatPausePreset = "tomorrow" | "next-week" | "custom" | "indefinite";
type TaskPendingAction = "complete" | "update" | "delete";
const MIN_TASK_PENDING_MS = 500;

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];
const VALID_VIEW_MODES = new Set<ViewMode>(["day", "week", "month"]);

const TASK_VIEW_OPTIONS: Array<{ value: TaskView; label: string }> = [
  { value: "active", label: "Active" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];

const DONE_RANGE_OPTIONS: Array<{ value: DoneRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All" },
];
const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "start-date", label: "Start date" },
  { value: "due-date", label: "Due date" },
];
const TASK_COLUMN_OPTIONS: Array<{ value: VisibleTaskColumn; label: string }> = [
  { value: "category", label: "Category" },
  { value: "due", label: "Due" },
  { value: "waitingOn", label: "Waiting On" },
  { value: "notes", label: "Tags / Notes" },
];
const DEFAULT_VISIBLE_TASK_COLUMNS: Record<VisibleTaskColumn, boolean> = {
  category: true,
  due: true,
  waitingOn: false,
  notes: true,
};
const AVERAGE_BASIS_OPTIONS: Array<{ value: AverageBasis; label: string }> = [
  { value: "calendar-days", label: "Calendar days" },
  { value: "work-week", label: "Work week" },
];
const VALID_AVERAGE_BASES = new Set<AverageBasis>(["calendar-days", "work-week"]);
const PREFERENCE_SAVE_DEBOUNCE_MS = 400;
const DATE_ONLY_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL_REPEAT_DAYS_MASK = 0b1111111;
const SNOOZE_PRESET_OPTIONS: Array<{ value: SnoozePreset; label: string }> = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next-business-day", label: "Next business day" },
  { value: "next-week", label: "Next week (+7 days)" },
];
const REPEAT_PAUSE_PRESET_OPTIONS: Array<{
  value: RepeatPausePreset;
  label: string;
}> = [
  { value: "tomorrow", label: "Pause until tomorrow" },
  { value: "next-week", label: "Pause until next week" },
  { value: "custom", label: "Custom date" },
  { value: "indefinite", label: "Pause indefinitely" },
];
const cardClass = "tm-card min-w-0 rounded-[12px] border shadow-sm";
const sectionCardClass = `${cardClass} p-4`;
const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";
const primaryButtonClass =
  "tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";
const compactButtonClass =
  "tm-button inline-flex h-8 items-center justify-center rounded-[10px] border px-2.5 text-sm";
const taskTitleButtonClass =
  "min-w-0 cursor-pointer rounded border border-transparent px-1 py-0.5 text-left transition-colors hover:border-amber-700/20 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,226,190,0.36))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[color:var(--tm-card)]";
const chipClass = "tm-chip rounded-full border px-2 py-0.5";
const smallChipClass = "tm-chip rounded-full border px-2 py-0.5 text-xs";
const priorityChipClass =
  "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800";
const overdueChipClass =
  "rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700";
const segmentedTabSetClass = "tm-tabset inline-flex rounded-full border p-1 text-sm";
const segmentedTabClass = "tm-tab rounded-full px-3 py-1.5";
const segmentedActiveTabClass = "tm-tab-active rounded-full px-3 py-1.5";
const progressTrackClass = "tm-progress-track overflow-hidden rounded-full";
const progressFillClass = "tm-progress-fill rounded-full transition-[width]";
const modalChoiceClass = "tm-choice flex cursor-pointer items-start gap-3 rounded-lg border p-3";
const commandBarClass =
  "sticky top-[57px] z-30 -mx-4 border-b border-[color:var(--tm-border)] bg-[color:var(--tm-bg)]/95 px-4 py-2 backdrop-blur md:top-0 md:z-40 md:-mx-6 md:px-6";
const matrixHeaderCellClass =
  "sticky top-0 z-10 border-b border-[color:var(--tm-border)] bg-[color:var(--tm-card)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tm-muted)]";
const matrixCellClass = "px-3 py-2.5 align-top";
const iconButtonClass =
  "tm-button inline-flex h-8 w-8 items-center justify-center rounded-[10px] border text-sm";
const taskActionMenuItemClass =
  "block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/70 disabled:opacity-50";

type TaskActionMenuConfig = {
  taskId: string;
  x: number;
  y: number;
  showSnoozeAction: boolean;
  completedActionLabel?: string;
  toggleCompletedTo?: boolean;
  pauseReferenceDate: string;
};

function taskViewToOpenFilter(taskView: TaskView): OpenFilter {
  if (taskView === "today") return "today";
  if (taskView === "upcoming") return "upcoming";
  if (taskView === "overdue") return "overdue";
  return "all-active";
}

function reorderIds(
  orderedIds: string[],
  draggedId: string,
  targetId: string,
  position: DragPosition
) {
  const withoutDragged = orderedIds.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.indexOf(targetId);

  if (targetIndex === -1) {
    return orderedIds;
  }

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  return [
    ...withoutDragged.slice(0, insertIndex),
    draggedId,
    ...withoutDragged.slice(insertIndex),
  ];
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInputValue() {
  return dateInputValue(new Date());
}

function createTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekdayNumber(value: string) {
  const weekday = parseDateOnly(value).getDay();
  return weekday === 0 ? 7 : weekday;
}

function getDayOfMonth(value: string) {
  return parseDateOnly(value).getDate();
}

function getRepeatDayBit(weekday: number) {
  return 1 << (weekday - 1);
}

function matchesRepeatDays(dateValue: string, repeatDays: number | null | undefined) {
  const mask = repeatDays ?? ALL_REPEAT_DAYS_MASK;
  return (mask & getRepeatDayBit(getWeekdayNumber(dateValue))) !== 0;
}

function formatRepeatDays(repeatDays: number) {
  if (repeatDays === ALL_REPEAT_DAYS_MASK) {
    return "every day";
  }

  const weekdaysMask =
    getRepeatDayBit(1) |
    getRepeatDayBit(2) |
    getRepeatDayBit(3) |
    getRepeatDayBit(4) |
    getRepeatDayBit(5);

  if (repeatDays === weekdaysMask) {
    return "weekdays";
  }

  return WEEKDAY_LABELS.filter((_, index) => repeatDays & (1 << index)).join(", ");
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function maxDateValue(left: string, right: string) {
  return left >= right ? left : right;
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

function resolveQuickAddProjectId(projects: Project[], projectToken: string) {
  const normalizedToken = projectToken.trim().toLocaleLowerCase();
  if (!normalizedToken) {
    return null;
  }

  const exactMatch = projects.find(
    (project) => project.name.trim().toLocaleLowerCase() === normalizedToken
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  const startsWithMatch = projects.find((project) =>
    project.name.trim().toLocaleLowerCase().startsWith(normalizedToken)
  );
  return startsWithMatch?.id ?? null;
}

function parseQuickAddInput(
  value: string,
  selectedDay: string,
  projects: Project[]
): QuickAddParseResult {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const titleParts: string[] = [];
  let category: string | null = null;
  let projectId: string | null = null;
  let dueAt: string | null = null;

  for (const part of parts) {
    if (part.startsWith("#")) {
      category = part.slice(1).trim() || null;
      continue;
    }

    if (part.startsWith("@")) {
      projectId = resolveQuickAddProjectId(projects, part.slice(1));
      continue;
    }

    if (part.startsWith("^due:")) {
      const dueToken = part.slice(5).trim().toLocaleLowerCase();

      if (dueToken === "tomorrow") {
        dueAt = dateInputValue(addDays(parseDateOnly(selectedDay), 1));
      } else if (DATE_ONLY_INPUT_RE.test(dueToken)) {
        dueAt = dueToken;
      } else {
        dueAt = null;
      }
      continue;
    }

    if (part.startsWith("^")) {
      continue;
    }

    titleParts.push(part);
  }

  return {
    title: titleParts.join(" ").trim(),
    category,
    projectId,
    dueAt,
  };
}

function addMonthsKeepingDay(date: Date, amount: number) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const dayOfMonth = date.getDate();
  const targetMonthIndex = monthIndex + amount;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const maxDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(dayOfMonth, maxDay));
}

function toDateOnly(value: string | null) {
  return value ? dateInputValue(new Date(value)) : "";
}

function dayDifference(left: string, right: string) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(
    (parseDateOnly(left).getTime() - parseDateOnly(right).getTime()) /
      millisecondsPerDay
  );
}

function monthDifference(left: string, right: string) {
  const leftDate = parseDateOnly(left);
  const rightDate = parseDateOnly(right);
  return (
    (leftDate.getFullYear() - rightDate.getFullYear()) * 12 +
    leftDate.getMonth() -
    rightDate.getMonth()
  );
}

function isSameDateValue(value: string | null, dateValue: string) {
  return toDateOnly(value) === dateValue;
}

function createRepeatDefaults(dateValue: string): RepeatFormState {
  const repeatWeeklyDay = getWeekdayNumber(dateValue);

  return {
    repeatEnabled: false,
    repeatPattern: "daily",
    repeatInterval: 1,
    repeatDays: ALL_REPEAT_DAYS_MASK,
    repeatWeeklyDay,
    repeatMonthlyDay: getDayOfMonth(dateValue),
  };
}

function getRepeatSummary(task: Task) {
  if (!task.repeatEnabled || !task.repeatPattern) return null;
  const interval = Math.max(1, task.repeatInterval ?? 1);

  if (task.repeatPattern === "daily") {
    if (interval > 1) return `Repeats every ${interval} days`;
    return `Repeats ${formatRepeatDays(task.repeatDays ?? ALL_REPEAT_DAYS_MASK)}`;
  }

  if (task.repeatPattern === "weekly") {
    const repeatDays =
      task.repeatDays ??
      (task.repeatWeeklyDay ? getRepeatDayBit(task.repeatWeeklyDay) : getRepeatDayBit(1));
    if (interval === 2) return `Repeats fortnightly on ${formatRepeatDays(repeatDays)}`;
    if (interval > 1) return `Repeats every ${interval} weeks on ${formatRepeatDays(repeatDays)}`;
    return `Repeats weekly on ${formatRepeatDays(repeatDays)}`;
  }

  if (interval > 1) {
    return `Repeats every ${interval} months on day ${task.repeatMonthlyDay ?? 1}`;
  }
  return `Repeats monthly on day ${task.repeatMonthlyDay ?? 1}`;
}

function isRepeatPausedOnDate(task: Task, dateValue: string) {
  if (!isRecurringTask(task) || !task.repeatPaused) return false;
  const pauseUntil = toDateOnly(task.repeatPauseUntil);
  return pauseUntil === "" || dateValue <= pauseUntil;
}

function getRepeatPauseBadge(task: Task, dateValue: string) {
  if (!isRepeatPausedOnDate(task, dateValue)) return null;

  const pauseUntil = toDateOnly(task.repeatPauseUntil);
  return pauseUntil ? `Paused until ${formatShortDate(pauseUntil)}` : "Paused";
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

function formatLongDate(value: string) {
  return parseDateOnly(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  return parseDateOnly(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatNoteTimestamp(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStartOfMonthGrid(date: Date) {
  return startOfWeekMon(new Date(date.getFullYear(), date.getMonth(), 1));
}

function getEndOfMonthGrid(date: Date) {
  return addDays(startOfWeekMon(new Date(date.getFullYear(), date.getMonth() + 1, 0)), 6);
}

function isTaskActiveOnDate(task: Task, dateValue: string) {
  return toDateOnly(task.startDate) <= dateValue;
}

function isRecurringTaskDueOnDate(task: Task, dateValue: string) {
  if (!isRecurringTask(task)) return true;
  if (isRepeatPausedOnDate(task, dateValue)) return false;
  if (!isTaskActiveOnDate(task, dateValue)) return false;

  if (task.repeatPattern === "daily") {
    return (
      dayDifference(dateValue, toDateOnly(task.startDate)) %
        Math.max(1, task.repeatInterval ?? 1) ===
        0 && matchesRepeatDays(dateValue, task.repeatDays)
    );
  }

  if (task.repeatPattern === "weekly") {
    const repeatDays =
      task.repeatDays ??
      (task.repeatWeeklyDay ? getRepeatDayBit(task.repeatWeeklyDay) : null);
    return (
      Math.floor(dayDifference(dateValue, toDateOnly(task.startDate)) / 7) %
        Math.max(1, task.repeatInterval ?? 1) ===
        0 && matchesRepeatDays(dateValue, repeatDays)
    );
  }

  if (task.repeatPattern === "monthly") {
    return (
      monthDifference(dateValue, toDateOnly(task.startDate)) %
        Math.max(1, task.repeatInterval ?? 1) ===
        0 &&
      getDayOfMonth(dateValue) ===
        (task.repeatMonthlyDay ?? getDayOfMonth(toDateOnly(task.startDate)))
    );
  }

  return true;
}

function isTaskVisibleOnDate(task: Task, dateValue: string) {
  return isRecurringTask(task)
    ? isRecurringTaskDueOnDate(task, dateValue)
    : isTaskActiveOnDate(task, dateValue);
}

function isTaskUpcomingAfterDate(task: Task, dateValue: string) {
  return toDateOnly(task.startDate) > dateValue;
}

function isTaskCompleted(task: Task) {
  return Boolean(task.completedAt);
}

function isTaskOverdue(task: Task, referenceDate: string) {
  const dueDate = toDateOnly(task.dueAt);
  return !isTaskCompleted(task) && dueDate !== "" && dueDate < referenceDate;
}

function isOpenTaskNewOnDate(task: Task, dateValue: string) {
  return !isTaskCompleted(task) && toDateOnly(task.startDate) === dateValue;
}

function isOpenTaskDueOnDate(task: Task, dateValue: string) {
  return !isTaskCompleted(task) && toDateOnly(task.dueAt) === dateValue;
}

function isTaskRelevantToRange(task: Task, startValue: string, endValue: string) {
  return (
    inRangeInclusive(task.startDate, startValue, endValue) ||
    inRangeInclusive(task.dueAt, startValue, endValue)
  );
}

function getTaskSeriesKey(task: Task) {
  return task.recurrenceSeriesId ? `series:${task.recurrenceSeriesId}` : `task:${task.id}`;
}

function getRoutineAffirmation(projectName: string) {
  return ROUTINE_AFFIRMATIONS[projectName.trim().toLocaleLowerCase()] ?? null;
}

function getRoutineStreak(tasks: Task[], projectId: string, today: string) {
  const routineTasks = tasks.filter(
    (task) => task.projectId === projectId && isRecurringTask(task)
  );

  if (routineTasks.length === 0) return 0;

  const tasksBySeries = new Map<string, Task[]>();
  for (const task of routineTasks) {
    const key = getTaskSeriesKey(task);
    const seriesTasks = tasksBySeries.get(key) ?? [];
    seriesTasks.push(task);
    tasksBySeries.set(key, seriesTasks);
  }

  for (const seriesTasks of tasksBySeries.values()) {
    seriesTasks.sort((left, right) =>
      toDateOnly(left.startDate).localeCompare(toDateOnly(right.startDate))
    );
  }

  const earliestStart = routineTasks.reduce((earliest, task) => {
    const start = toDateOnly(task.startDate);
    return start < earliest ? start : earliest;
  }, toDateOnly(routineTasks[0].startDate));

  const completedSeriesByDate = new Map<string, Set<string>>();
  for (const task of routineTasks) {
    if (!isTaskCompleted(task) || !task.completedOn) continue;

    const completionDate = toDateOnly(task.completedOn);
    const completedSeries = completedSeriesByDate.get(completionDate) ?? new Set();
    completedSeries.add(getTaskSeriesKey(task));
    completedSeriesByDate.set(completionDate, completedSeries);
  }

  function getExpectedSeries(dateValue: string) {
    const expected = new Set<string>();

    for (const [seriesKey, seriesTasks] of tasksBySeries) {
      let representative: Task | undefined;
      for (let index = seriesTasks.length - 1; index >= 0; index -= 1) {
        if (toDateOnly(seriesTasks[index].startDate) <= dateValue) {
          representative = seriesTasks[index];
          break;
        }
      }

      if (representative && isRecurringTaskDueOnDate(representative, dateValue)) {
        expected.add(seriesKey);
      }
    }

    return expected;
  }

  function isRoutineComplete(dateValue: string, expected: Set<string>) {
    const completed = completedSeriesByDate.get(dateValue) ?? new Set<string>();

    return [...expected].every((seriesKey) => completed.has(seriesKey));
  }

  let cursor = today;
  const todayExpected = getExpectedSeries(today);
  if (todayExpected.size === 0 || !isRoutineComplete(today, todayExpected)) {
    cursor = dateInputValue(addDays(parseDateOnly(today), -1));
  }

  let streak = 0;
  while (cursor >= earliestStart) {
    const expected = getExpectedSeries(cursor);

    if (expected.size > 0) {
      if (!isRoutineComplete(cursor, expected)) break;
      streak += 1;
    }

    cursor = dateInputValue(addDays(parseDateOnly(cursor), -1));
  }

  return streak;
}

function compareTasksByStartDate(
  left: Task,
  right: Task,
  direction: "asc" | "desc"
) {
  const leftStart = toDateOnly(left.startDate);
  const rightStart = toDateOnly(right.startDate);

  if (leftStart !== rightStart) {
    return direction === "asc"
      ? leftStart.localeCompare(rightStart)
      : rightStart.localeCompare(leftStart);
  }

  return direction === "asc"
    ? left.id.localeCompare(right.id)
    : right.id.localeCompare(left.id);
}

function compareTasksByCreatedAt(left: Task, right: Task) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function compareTasksForStartDateSort(left: Task, right: Task) {
  const leftStart = toDateOnly(left.startDate);
  const rightStart = toDateOnly(right.startDate);

  if (leftStart !== rightStart) {
    return leftStart.localeCompare(rightStart);
  }

  return compareTasksByCreatedAt(left, right);
}

function compareTasksForDueDateSort(left: Task, right: Task) {
  const leftDue = toDateOnly(left.dueAt);
  const rightDue = toDateOnly(right.dueAt);

  if (leftDue !== rightDue) {
    if (!leftDue) return 1;
    if (!rightDue) return -1;
    return leftDue.localeCompare(rightDue);
  }

  return compareTasksForStartDateSort(left, right);
}

function compareTasksForManualSort(left: Task, right: Task) {
  const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return compareTasksForStartDateSort(left, right);
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

function sortTasks(tasks: Task[], sortMode: SortMode) {
  const sorted = [...tasks];
  sorted.sort((left, right) => {
    if (sortMode === "due-date") {
      return compareTasksForDueDateSort(left, right);
    }

    if (sortMode === "manual") {
      return compareTasksForManualSort(left, right);
    }

    return compareTasksForStartDateSort(left, right);
  });
  return sorted;
}

function getTaskColumnSortValue(task: Task, sortColumn: TaskSortColumn) {
  if (sortColumn === "title") {
    return task.title.trim().toLocaleLowerCase();
  }

  if (sortColumn === "category") {
    return (task.category?.trim() || "Uncategorized").toLocaleLowerCase();
  }

  if (sortColumn === "due") {
    return toDateOnly(task.dueAt);
  }

  return getTaskNotesText(task).trim() ? 1 : 0;
}

function sortTasksByColumn(
  tasks: Task[],
  sortColumn: TaskSortColumn | null,
  sortDirection: SortDirection | null
) {
  if (!sortColumn || !sortDirection) return tasks;

  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      if (sortColumn === "due") {
        const leftDue = getTaskColumnSortValue(left.task, sortColumn) as string;
        const rightDue = getTaskColumnSortValue(right.task, sortColumn) as string;

        if (leftDue !== rightDue) {
          if (!leftDue) return 1;
          if (!rightDue) return -1;

          const comparison = leftDue.localeCompare(rightDue);
          return sortDirection === "asc" ? comparison : -comparison;
        }
      } else {
        const leftValue = getTaskColumnSortValue(left.task, sortColumn);
        const rightValue = getTaskColumnSortValue(right.task, sortColumn);
        const comparison =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue), undefined, {
                sensitivity: "base",
              });

        if (comparison !== 0) {
          return sortDirection === "asc" ? comparison : -comparison;
        }
      }

      return left.index - right.index;
    })
    .map(({ task }) => task);
}

function reorderTaskIds(
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

function projectTasksBySeries(tasks: Task[], pick: "earliest" | "latest") {
  const projected = new Map<string, Task>();

  for (const task of tasks) {
    const key = getTaskSeriesKey(task);
    const existing = projected.get(key);

    if (!existing) {
      projected.set(key, task);
      continue;
    }

    const comparison = compareTasksByStartDate(task, existing, pick === "earliest" ? "asc" : "desc");
    if (comparison < 0) {
      projected.set(key, task);
    }
  }

  return Array.from(projected.values()).sort((left, right) =>
    compareTasksByStartDate(left, right, "desc")
  );
}

function projectOpenTasksForView(
  tasks: Task[],
  viewMode: ViewMode,
  selectedDay: string,
  weekStart: string,
  weekEnd: string,
  monthStart: string,
  monthEnd: string
) {
  const rangeStart =
    viewMode === "week" ? weekStart : viewMode === "month" ? monthStart : selectedDay;
  const rangeEnd =
    viewMode === "week" ? weekEnd : viewMode === "month" ? monthEnd : selectedDay;
  const openTasks = tasks.filter(
    (task) => !isTaskCompleted(task) && !isRepeatPausedOnDate(task, selectedDay)
  );
  const viewScopedTasks =
    viewMode === "day"
      ? openTasks
      : openTasks.filter((task) => isTaskRelevantToRange(task, rangeStart, rangeEnd));
  const rangeProjectedTasks = projectTasksBySeries(
    viewScopedTasks.filter((task) =>
      viewMode === "day"
        ? isTaskVisibleOnDate(task, selectedDay)
        : toDateOnly(task.startDate) <= rangeEnd
    ),
    "latest"
  );
  const upcomingTasks = projectTasksBySeries(
    viewScopedTasks.filter((task) => toDateOnly(task.startDate) > selectedDay),
    "earliest"
  );

  return {
    allOpen: viewScopedTasks,
    allActive: rangeProjectedTasks,
    today: rangeProjectedTasks.filter((task) => {
      const startDate = toDateOnly(task.startDate);
      const dueDate = toDateOnly(task.dueAt);
      return startDate === selectedDay || dueDate === selectedDay;
    }),
    upcoming: upcomingTasks,
    overdue: rangeProjectedTasks.filter((task) => {
      const dueDate = toDateOnly(task.dueAt);
      return dueDate !== "" && dueDate < selectedDay;
    }),
  };
}

function buildCalendarDays(tasks: Task[], start: Date, end: Date, month: number) {
  const days: CalendarDay[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const dateValue = dateInputValue(cursor);
    const projectedOpenTasks = projectOpenTasksForView(
      tasks,
      "day",
      dateValue,
      dateValue,
      dateValue,
      dateValue,
      dateValue
    ).allActive;
    days.push({
      key: dateValue,
      date: new Date(cursor),
      dateValue,
      isCurrentMonth: cursor.getMonth() === month,
      openActiveCount: projectedOpenTasks.length,
      openNewCount: tasks.filter((task) => isOpenTaskNewOnDate(task, dateValue)).length,
      openDueCount: projectedOpenTasks.filter((task) => isOpenTaskDueOnDate(task, dateValue))
        .length,
    });
  }

  return days;
}

function matchesTaskSearch(
  task: Task,
  query: string,
  projectById: Map<string, Project>
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const projectName = task.projectId ? projectById.get(task.projectId)?.name ?? "" : "";

  return [task.title, task.category ?? "", getTaskNotesText(task), projectName].some(
    (value) => value.toLowerCase().includes(normalized)
  );
}

function isTaskInArchivedProject(
  task: Task,
  projectById: Map<string, Project>
) {
  if (!task.projectId) return false;

  return projectById.get(task.projectId)?.archived ?? false;
}

function isTaskVisibleForProgress(
  task: Task,
  projectById: Map<string, Project>,
  showArchived: boolean
) {
  return showArchived || !isTaskInArchivedProject(task, projectById);
}

function isTaskVisibleForSearch(
  task: Task,
  projectById: Map<string, Project>,
  includeArchived: boolean
) {
  return includeArchived || !isTaskInArchivedProject(task, projectById);
}

function filterTasksByArchivedVisibility(
  tasks: Task[],
  projectById: Map<string, Project>,
  includeArchived: boolean
) {
  return tasks.filter((task) =>
    isTaskVisibleForSearch(task, projectById, includeArchived)
  );
}

function getTaskProjectLabel(
  task: { projectId: string | null; recurrenceSeriesId?: string | null; repeatEnabled?: boolean; repeatPattern?: string | null },
  projectById: Map<string, Project>
) {
  if (isRecurringTask(task as Task) && !task.projectId) {
    return "Recurring";
  }

  return task.projectId ? projectById.get(task.projectId)?.name ?? "Unassigned" : "Unassigned";
}

function normalizeViewMode(value: string | null | undefined): ViewMode {
  return value && VALID_VIEW_MODES.has(value as ViewMode) ? (value as ViewMode) : "day";
}

function normalizeAverageBasis(value: string | null | undefined): AverageBasis {
  return value && VALID_AVERAGE_BASES.has(value as AverageBasis)
    ? (value as AverageBasis)
    : "calendar-days";
}

async function loadTrackerData(profileId: string) {
  const [profilesRes, tasksRes, projectsRes] = await Promise.all([
    fetch("/api/profiles", { cache: "no-store" }),
    fetch(`/api/p/${profileId}/tasks`, { cache: "no-store" }),
    fetch(`/api/p/${profileId}/projects`, { cache: "no-store" }),
  ]);

  if (!profilesRes.ok) {
    const body = await profilesRes.json().catch(() => ({}));
    throw new Error(body?.error ?? "Could not load profiles");
  }

  if (!tasksRes.ok) {
    const body = await tasksRes.json().catch(() => ({}));
    throw new Error(body?.error ?? "Could not load tasks");
  }

  if (!projectsRes.ok) {
    const body = await projectsRes.json().catch(() => ({}));
    throw new Error(body?.error ?? "Could not load projects");
  }

  const [profilesData, tasksData, projectsData] = (await Promise.all([
    profilesRes.json(),
    tasksRes.json(),
    projectsRes.json(),
  ])) as [Profile[], Task[], Project[]];

  return { profilesData, tasksData: tasksData.map(normalizeTask), projectsData };
}

function isTaskCompletedOnDate(task: Task, dateValue: string) {
  return isTaskCompleted(task) && isSameDateValue(task.completedOn, dateValue);
}

function countsTowardDayProgress(task: Task, dateValue: string) {
  return (
    isTaskVisibleOnDate(task, dateValue) &&
    (!isTaskCompleted(task) || isTaskCompletedOnDate(task, dateValue))
  );
}

function openDateInputPicker(input: HTMLInputElement) {
  const pickerInput = input as HTMLInputElement & {
    showPicker?: () => void;
  };

  pickerInput.showPicker?.();
}

function DateInput(props: ComponentPropsWithoutRef<"input">) {
  const { onClick, ...rest } = props;

  return (
    <input
      {...rest}
      type="date"
      onClick={(event) => {
        openDateInputPicker(event.currentTarget);
        onClick?.(event);
      }}
    />
  );
}

function CategoryCombobox({
  suggestions,
  value,
  onChange,
  onFocus,
  onClick,
  onBlur,
  className,
  disabled,
  optionsLabel = "category options",
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  optionsLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLocaleLowerCase();
  const filteredSuggestions = suggestions.filter((suggestion) =>
    normalizedValue === ""
      ? true
      : suggestion.toLocaleLowerCase().includes(normalizedValue)
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <div className="flex min-w-0 items-center gap-2">
        <input
          {...props}
          className={className}
          disabled={disabled}
          value={value}
          onBlur={(event) => {
            onBlur?.(event);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onClick={(event) => {
            if (!disabled) {
              setOpen(true);
            }
            onClick?.(event);
          }}
          onFocus={(event) => {
            if (!disabled) {
              setOpen(true);
            }
            onFocus?.(event);
          }}
        />
        <button
          aria-expanded={open}
          aria-label={`Show ${optionsLabel}`}
          className="tm-button rounded-md border px-2 py-1 text-xs"
          disabled={disabled}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
        >
          ▾
        </button>
      </div>

      {open && filteredSuggestions.length > 0 && (
        <div className="tm-menu absolute left-0 right-0 top-full z-40 mt-1 max-h-52 min-w-full overflow-auto rounded-md border py-1 shadow-2xl">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/70"
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(suggestion);
                setOpen(false);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SnoozeMenu({
  label = "Snooze",
  disabled = false,
  onSelectPreset,
  onPickDate,
}: {
  label?: string;
  disabled?: boolean;
  onSelectPreset: (preset: SnoozePreset) => void;
  onPickDate: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        className={`${buttonClass} px-3 py-1 disabled:opacity-50`}
        disabled={disabled}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
      </button>

      {open && (
        <div className="tm-menu absolute right-0 top-full z-40 mt-2 min-w-48 overflow-hidden rounded-lg border shadow-2xl">
          {SNOOZE_PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/70"
              type="button"
              onClick={() => {
                setOpen(false);
                onSelectPreset(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            className="block w-full border-t border-[color:var(--tm-border)] px-3 py-2 text-left text-sm transition-colors hover:bg-white/70"
            type="button"
            onClick={() => {
              setOpen(false);
              onPickDate();
            }}
          >
            Pick date...
          </button>
        </div>
      )}
    </div>
  );
}

function createEmptyProjectForm(): ProjectFormState {
  return {
    name: "",
    startDate: todayInputValue(),
    dueAt: "",
    category: "",
  };
}

function createEmptyTaskForm(dateValue = todayInputValue()): TaskFormState {
  return {
    title: "",
    startDate: dateValue,
    dueAt: "",
    category: "",
    notes: "",
    waitingOn: "",
    projectId: "",
    ...createRepeatDefaults(dateValue),
  };
}

function isRecurringTask(task: Task) {
  return Boolean(task.recurrenceSeriesId || task.repeatEnabled || task.repeatPattern);
}

function getTaskNotesText(task: Pick<Task, "noteHistory">) {
  return task.noteHistory
    .map((note) =>
      [note.content, note.waitingOn ? `Waiting on: ${note.waitingOn}` : ""]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function getColumnPreferenceKey(profileId: string) {
  return `taskmanager:profile:${profileId}:task-columns`;
}

function normalizeVisibleTaskColumns(value: unknown): Record<VisibleTaskColumn, boolean> {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_VISIBLE_TASK_COLUMNS };
  }

  const candidate = value as Partial<Record<VisibleTaskColumn, unknown>>;
  return {
    category:
      typeof candidate.category === "boolean"
        ? candidate.category
        : DEFAULT_VISIBLE_TASK_COLUMNS.category,
    due:
      typeof candidate.due === "boolean" ? candidate.due : DEFAULT_VISIBLE_TASK_COLUMNS.due,
    waitingOn:
      typeof candidate.waitingOn === "boolean"
        ? candidate.waitingOn
        : DEFAULT_VISIBLE_TASK_COLUMNS.waitingOn,
    notes:
      typeof candidate.notes === "boolean"
        ? candidate.notes
        : DEFAULT_VISIBLE_TASK_COLUMNS.notes,
  };
}

function loadVisibleTaskColumns(profileId: string) {
  if (typeof window === "undefined") {
    return { ...DEFAULT_VISIBLE_TASK_COLUMNS };
  }

  try {
    const rawValue = window.localStorage.getItem(getColumnPreferenceKey(profileId));
    return normalizeVisibleTaskColumns(rawValue ? JSON.parse(rawValue) : null);
  } catch (error) {
    console.warn("Could not load task column preferences", error);
    return { ...DEFAULT_VISIBLE_TASK_COLUMNS };
  }
}

function getLatestWaitingOnValues(task: Pick<Task, "noteHistory">) {
  const latestWaitingOn = task.noteHistory[0]?.waitingOn?.trim() ?? "";

  if (!latestWaitingOn) return [];

  return latestWaitingOn
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function WaitingOnPills({ values }: { values: string[] }) {
  if (values.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-slate-300/70 bg-white/55 px-2 py-0.5 text-[11px] text-slate-700"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function hasTaskNotes(task: Pick<Task, "noteHistory">) {
  return getTaskNotesText(task).trim().length > 0;
}

function formatTaskNotesPreview(task: Pick<Task, "noteHistory">) {
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

function normalizeTask(task: Task): Task {
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

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForMinimumPendingTime(startedAt: number) {
  const remaining = MIN_TASK_PENDING_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await wait(remaining);
  }
}

function isTaskFormDirty(form: TaskFormState, baseline: TaskFormState) {
  return JSON.stringify(form) !== JSON.stringify(baseline);
}

function isEditTaskFormDirty(form: EditTaskFormState, baseline: EditTaskFormState) {
  const { noteHistory: _formHistory, ...formValues } = form;
  const { noteHistory: _baselineHistory, ...baselineValues } = baseline;
  return JSON.stringify(formValues) !== JSON.stringify(baselineValues);
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="tm-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
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
    <div className="tm-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className={`${cardClass} w-full max-w-sm p-5 shadow-2xl`}>
        <h2 className="text-lg font-semibold">Discard unsaved changes?</h2>
        <p className="mt-2 text-sm text-[color:var(--tm-muted)]">
          You have unsaved changes. If you leave now, they will be lost.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={`${buttonClass} px-4`} type="button" onClick={onKeepEditing}>
            Keep Editing
          </button>
          <button
            className={`${primaryButtonClass} px-4`}
            type="button"
            onClick={onDiscardChanges}
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskNotesButton({ notes }: { notes: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
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
    const width = Math.min(380, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, rect.left),
      Math.max(16, window.innerWidth - width - 16)
    );
    const placement =
      window.innerHeight - rect.bottom < 180 && rect.top > 180 ? "above" : "below";
    const top = placement === "above" ? rect.top - 8 : rect.bottom + 8;

    setPosition({ left, top, placement, width });
  }

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }

    updatePosition();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-label="View task notes"
        className="tm-chip inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[color:var(--tm-card)]"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleOpen();
        }}
      >
        📝
      </button>
      {open && position && (
        <div
          ref={popoverRef}
          className="fixed z-[80] max-h-64 overflow-auto whitespace-pre-wrap rounded-[12px] border border-[color:var(--tm-border)] bg-[color:var(--tm-card)] px-3 py-2 text-xs leading-5 text-[color:var(--tm-text)] shadow-2xl"
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
    </>
  );
}

function TaskActionMenu({
  task,
  completionPending = false,
  pendingAction = null,
  snoozeDisabled = false,
  showSnoozeAction = true,
  completedActionLabel,
  onPickSnoozeDate,
  onTogglePriority,
  onOpenEditModal,
  onToggleCompleted,
  onToggleRepeatPause,
  onDelegate,
  onDelete,
  pauseReferenceDate = todayInputValue(),
}: {
  task: Task;
  completionPending?: boolean;
  pendingAction?: TaskPendingAction | null;
  snoozeDisabled?: boolean;
  showSnoozeAction?: boolean;
  completedActionLabel?: string;
  onPickSnoozeDate: (task: Task) => void;
  onTogglePriority: (task: Task) => void;
  onOpenEditModal: (task: Task) => void;
  onToggleCompleted: (task: Task) => void;
  onToggleRepeatPause: (task: Task) => void;
  onDelegate: (task: Task) => void;
  onDelete: (task: Task) => void;
  pauseReferenceDate?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  } | null>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 176;
    const gutter = 12;
    const offset = 8;
    const menuHeight = menuRef.current?.scrollHeight ?? (showSnoozeAction ? 260 : 220);
    const availableBelow = window.innerHeight - rect.bottom - gutter - offset;
    const availableAbove = rect.top - gutter - offset;
    const openAbove = availableBelow < Math.min(menuHeight, 180) && availableAbove > availableBelow;
    const availableHeight = Math.max(120, openAbove ? availableAbove : availableBelow);
    const maxHeight = Math.min(menuHeight, availableHeight);
    const left = Math.min(
      Math.max(gutter, rect.right - menuWidth),
      Math.max(gutter, window.innerWidth - menuWidth - gutter)
    );
    const top = openAbove
      ? Math.max(gutter, rect.top - maxHeight - offset)
      : Math.min(rect.bottom + offset, window.innerHeight - gutter - maxHeight);

    setPosition({
      left,
      top,
      maxHeight,
    });
  }

  function closeMenu() {
    setOpen(false);
  }

  const actionPending = Boolean(pendingAction);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, showSnoozeAction]);

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Task actions for ${task.title}`}
        className={iconButtonClass}
        disabled={actionPending}
        type="button"
        onClick={() => {
          if (!open) updatePosition();
          setOpen((prev) => !prev);
        }}
      >
        ⋯
      </button>

      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="tm-menu fixed z-[1000] min-w-44 overflow-hidden rounded-lg border py-1 text-left shadow-2xl"
            role="menu"
            style={{
              left: position.left,
              top: position.top,
              maxHeight: position.maxHeight,
              overflowY: "auto",
            }}
          >
            <TaskActionMenuItems
              task={task}
              completionPending={completionPending}
              pendingAction={pendingAction}
              snoozeDisabled={snoozeDisabled}
              showSnoozeAction={showSnoozeAction}
              completedActionLabel={completedActionLabel}
              pauseReferenceDate={pauseReferenceDate}
              onClose={closeMenu}
              onPickSnoozeDate={onPickSnoozeDate}
              onTogglePriority={onTogglePriority}
              onOpenEditModal={onOpenEditModal}
              onToggleCompleted={onToggleCompleted}
              onToggleRepeatPause={onToggleRepeatPause}
              onDelegate={onDelegate}
              onDelete={onDelete}
            />
          </div>,
          document.body
        )}
    </>
  );
}

function TaskActionMenuItems({
  task,
  completionPending = false,
  pendingAction = null,
  snoozeDisabled = false,
  showSnoozeAction = true,
  completedActionLabel,
  pauseReferenceDate = todayInputValue(),
  onClose,
  onPickSnoozeDate,
  onTogglePriority,
  onOpenEditModal,
  onToggleCompleted,
  onToggleRepeatPause,
  onDelegate,
  onDelete,
}: {
  task: Task;
  completionPending?: boolean;
  pendingAction?: TaskPendingAction | null;
  snoozeDisabled?: boolean;
  showSnoozeAction?: boolean;
  completedActionLabel?: string;
  pauseReferenceDate?: string;
  onClose: () => void;
  onPickSnoozeDate: (task: Task) => void;
  onTogglePriority: (task: Task) => void;
  onOpenEditModal: (task: Task) => void;
  onToggleCompleted: (task: Task) => void;
  onToggleRepeatPause: (task: Task) => void;
  onDelegate: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const actionPending = Boolean(pendingAction);

  function runAction(action: (task: Task) => void) {
    if (pendingAction) return;
    onClose();
    action(task);
  }

  return (
    <>
      {showSnoozeAction && (
        <button
          className={taskActionMenuItemClass}
          disabled={snoozeDisabled || actionPending}
          role="menuitem"
          type="button"
          onClick={() => runAction(onPickSnoozeDate)}
        >
          Snooze
        </button>
      )}
      <button
        className={taskActionMenuItemClass}
        disabled={actionPending}
        role="menuitem"
        type="button"
        onClick={() => runAction(onTogglePriority)}
      >
        {task.isPriority ? "Unprioritise" : "Prioritise"}
      </button>
      <button
        className={taskActionMenuItemClass}
        disabled={actionPending}
        role="menuitem"
        type="button"
        onClick={() => runAction(onOpenEditModal)}
      >
        Edit
      </button>
      <button
        className={taskActionMenuItemClass}
        disabled={completionPending || actionPending}
        role="menuitem"
        type="button"
        onClick={() => runAction(onToggleCompleted)}
      >
        {completedActionLabel ?? (isTaskCompleted(task) ? "Open" : "Done")}
      </button>
      {isRecurringTask(task) && (
        <button
          className={taskActionMenuItemClass}
          disabled={actionPending}
          role="menuitem"
          type="button"
          onClick={() => runAction(onToggleRepeatPause)}
        >
          {isRepeatPausedOnDate(task, pauseReferenceDate)
            ? "Resume Repeat"
            : "Pause Repeat"}
        </button>
      )}
      <button
        className={taskActionMenuItemClass}
        disabled={Boolean(task.delegatedTask) || actionPending}
        role="menuitem"
        type="button"
        onClick={() => runAction(onDelegate)}
      >
        {task.delegatedTask ? "Already delegated" : "Delegate Task"}
      </button>
      <button
        className={`${taskActionMenuItemClass} text-red-700 hover:bg-red-50`}
        disabled={actionPending}
        role="menuitem"
        type="button"
        onClick={() => runAction(onDelete)}
      >
        Delete
      </button>
    </>
  );
}

function ProfileOptionsMenu({
  taskView,
  sortMode,
  visibleColumns,
  onTaskViewChange,
  onSortModeChange,
  onToggleColumn,
}: {
  taskView: TaskView;
  sortMode: SortMode;
  visibleColumns: Record<VisibleTaskColumn, boolean>;
  onTaskViewChange: (view: TaskView) => void;
  onSortModeChange: (sort: SortMode) => void;
  onToggleColumn: (column: VisibleTaskColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"view" | "sort" | "columns" | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [mobileMenuTop, setMobileMenuTop] = useState<number | null>(null);

  function updateMobileMenuPosition() {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    setMobileMenuTop(Math.min(rect.bottom + 8, window.innerHeight - 16));
  }

  useEffect(() => {
    if (!open) return;

    updateMobileMenuPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
      setActiveSubmenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setActiveSubmenu(null);
      }
    }

    function handleReposition() {
      updateMobileMenuPosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  function toggleSubmenu(submenu: "view" | "sort" | "columns") {
    setActiveSubmenu((current) => (current === submenu ? null : submenu));
  }

  function closeMenu() {
    setOpen(false);
    setActiveSubmenu(null);
  }

  const menuItemClass =
    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-white/70";
  const selectedMenuItemClass =
    "bg-white/80 font-semibold shadow-[inset_3px_0_0_rgba(31,41,55,0.18)]";
  const submenuClass =
    "tm-menu static mt-1 w-full min-w-0 overflow-hidden rounded-lg border py-1 shadow-2xl md:absolute md:right-full md:top-0 md:mt-0 md:mr-1 md:w-auto md:min-w-44";
  const chevronClass = "text-xs text-[color:var(--tm-muted)]";
  const gearGlyph = <span className="leading-none md:text-[22px]">⚙</span>;

  function renderViewOptions() {
    return TASK_VIEW_OPTIONS.map((option) => (
      <button
        key={option.value}
        className={`${menuItemClass} ${
          taskView === option.value ? selectedMenuItemClass : ""
        }`}
        role="menuitemradio"
        type="button"
        aria-checked={taskView === option.value}
        onClick={() => {
          onTaskViewChange(option.value);
          closeMenu();
        }}
      >
        <span>{option.label}</span>
        <span className="w-4 text-right">{taskView === option.value ? "✓" : ""}</span>
      </button>
    ));
  }

  function renderSortOptions() {
    return SORT_OPTIONS.map((option) => (
      <button
        key={option.value}
        className={`${menuItemClass} ${
          sortMode === option.value ? selectedMenuItemClass : ""
        }`}
        role="menuitemradio"
        type="button"
        aria-checked={sortMode === option.value}
        onClick={() => {
          onSortModeChange(option.value);
          closeMenu();
        }}
      >
        <span>{option.label}</span>
        <span className="w-4 text-right">{sortMode === option.value ? "✓" : ""}</span>
      </button>
    ));
  }

  function renderColumnOptions() {
    return TASK_COLUMN_OPTIONS.map((option) => (
      <button
        key={option.value}
        className={`${menuItemClass} ${
          visibleColumns[option.value] ? selectedMenuItemClass : ""
        }`}
        role="menuitemcheckbox"
        type="button"
        aria-checked={visibleColumns[option.value]}
        onClick={() => onToggleColumn(option.value)}
      >
        <span>{option.label}</span>
        <span className="w-4 text-right">
          {visibleColumns[option.value] ? "✓" : ""}
        </span>
      </button>
    ));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${iconButtonClass} md:h-9 md:w-9 md:text-base`}
        title="Profile Options"
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setActiveSubmenu(null);
        }}
      >
        {gearGlyph}
      </button>
      {open && (
        <>
          <div
            className="tm-menu fixed left-4 right-4 z-50 max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-lg border py-1 text-left shadow-2xl md:hidden"
            role="menu"
            style={{ top: mobileMenuTop ?? undefined }}
          >
            <div>
              <button
                className={menuItemClass}
                role="menuitem"
                type="button"
                onClick={() => toggleSubmenu("view")}
              >
                <span>View</span>
                <span className={chevronClass}>{activeSubmenu === "view" ? "⌄" : "›"}</span>
              </button>
              {activeSubmenu === "view" && (
                <div className="border-y border-[color:var(--tm-border)] bg-white/20 py-1" role="menu">
                  {renderViewOptions()}
                </div>
              )}
            </div>

            <div>
              <button
                className={menuItemClass}
                role="menuitem"
                type="button"
                onClick={() => toggleSubmenu("sort")}
              >
                <span>Sort</span>
                <span className={chevronClass}>{activeSubmenu === "sort" ? "⌄" : "›"}</span>
              </button>
              {activeSubmenu === "sort" && (
                <div className="border-y border-[color:var(--tm-border)] bg-white/20 py-1" role="menu">
                  {renderSortOptions()}
                </div>
              )}
            </div>

            <div>
              <button
                className={menuItemClass}
                role="menuitem"
                type="button"
                onClick={() => toggleSubmenu("columns")}
              >
                <span>Columns</span>
                <span className={chevronClass}>{activeSubmenu === "columns" ? "⌄" : "›"}</span>
              </button>
              {activeSubmenu === "columns" && (
                <div className="border-t border-[color:var(--tm-border)] bg-white/20 py-1" role="menu">
                  {renderColumnOptions()}
                </div>
              )}
            </div>
          </div>

          <div
            className="tm-menu absolute right-0 top-full z-50 mt-2 hidden min-w-48 overflow-visible rounded-lg border py-1 text-left shadow-2xl md:block"
            role="menu"
          >
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu("view")}
            >
              <button
                className={menuItemClass}
                role="menuitem"
                type="button"
                onClick={() => toggleSubmenu("view")}
              >
                <span>View</span>
                <span className={chevronClass}>›</span>
              </button>
              {activeSubmenu === "view" && (
                <div className={submenuClass} role="menu">
                  {renderViewOptions()}
                </div>
              )}
            </div>

            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu("sort")}
            >
              <button
                className={menuItemClass}
                role="menuitem"
                type="button"
                onClick={() => toggleSubmenu("sort")}
              >
                <span>Sort</span>
                <span className={chevronClass}>›</span>
              </button>
              {activeSubmenu === "sort" && (
                <div className={submenuClass} role="menu">
                  {renderSortOptions()}
                </div>
              )}
            </div>

            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu("columns")}
            >
              <button
                className={menuItemClass}
                role="menuitem"
                type="button"
                onClick={() => toggleSubmenu("columns")}
              >
                <span>Columns</span>
                <span className={chevronClass}>›</span>
              </button>
              {activeSubmenu === "columns" && (
                <div className={submenuClass} role="menu">
                  {renderColumnOptions()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TaskRow({
  task,
  projectName,
  projectArchived = false,
  completionPending = false,
  pendingAction = null,
  snoozeDisabled = false,
  showSnoozeAction = false,
  selectMode = false,
  selected = false,
  visibleColumns,
  currentDateValue,
  editingCategoryTaskId,
  editingCategoryValue,
  categorySuggestions,
  onToggleSelected,
  onStartCategoryEdit,
  onChangeCategoryEdit,
  onCancelCategoryEdit,
  onSaveCategoryEdit,
  onOpenEditModal,
  onToggleCompleted,
  onSnoozePreset,
  onPickSnoozeDate,
  onTogglePriority,
  onToggleRepeatPause,
  onDelegate,
  onDelete,
  draggable = false,
  dragActive = false,
  dragOverPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onContextMenu,
}: {
  task: Task;
  projectName?: string;
  projectArchived?: boolean;
  completionPending?: boolean;
  pendingAction?: TaskPendingAction | null;
  snoozeDisabled?: boolean;
  showSnoozeAction?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  visibleColumns: Record<VisibleTaskColumn, boolean>;
  currentDateValue?: string;
  editingCategoryTaskId: string | null;
  editingCategoryValue: string;
  categorySuggestions: string[];
  onToggleSelected: (taskId: string, checked: boolean) => void;
  onStartCategoryEdit: (task: Task) => void;
  onChangeCategoryEdit: (value: string) => void;
  onCancelCategoryEdit: () => void;
  onSaveCategoryEdit: () => void;
  onOpenEditModal: (task: Task) => void;
  onToggleCompleted: (task: Task, completed: boolean) => void;
  onSnoozePreset: (task: Task, preset: SnoozePreset) => void;
  onPickSnoozeDate: (task: Task) => void;
  onTogglePriority: (task: Task) => void;
  onToggleRepeatPause: (task: Task) => void;
  onDelegate: (task: Task) => void;
  onDelete: (task: Task) => void;
  draggable?: boolean;
  dragActive?: boolean;
  dragOverPosition?: "before" | "after" | null;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const isEditingCategory = editingCategoryTaskId === task.id;
  const repeatSummary = getRepeatSummary(task);
  const repeatPauseBadge = getRepeatPauseBadge(task, currentDateValue ?? todayInputValue());
  const pendingComplete = pendingAction === "complete";
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
  const rowColumns = [
    "minmax(12rem,1.7fr)",
    visibleColumns.category ? "minmax(8rem,0.8fr)" : null,
    visibleColumns.due ? "minmax(5rem,0.5fr)" : null,
    visibleColumns.waitingOn ? "minmax(7rem,0.65fr)" : null,
    visibleColumns.notes ? "minmax(6rem,0.6fr)" : null,
    "auto",
  ]
    .filter(Boolean)
    .join(" ");
  const waitingOnValues = getLatestWaitingOnValues(task);
  const taskOverdue = isTaskOverdue(task, currentDateValue ?? todayInputValue());

  return (
    <div
      className={`border-b border-[color:var(--tm-border)] px-2 py-2 transition-all hover:bg-white/45 ${
        projectArchived
          ? "bg-amber-100/20"
          : pendingAction === "complete"
            ? "bg-emerald-50/80"
            : pendingAction === "delete"
              ? "bg-red-50/70"
              : pendingAction
                ? "bg-slate-100/80"
            : "bg-transparent"
      } ${task.isPriority ? "shadow-[inset_4px_0_0_0_rgba(183,122,116,0.78)]" : ""} ${
        task.delegatedTask ? "border-l-4 border-l-sky-200/70" : ""
      } ${
        draggable ? "cursor-grab" : ""
      } ${dragActive ? "opacity-60" : ""} ${
        pendingAction
          ? "opacity-75 ring-2 ring-inset ring-[color:var(--tm-border)]"
          : ""
      } ${
        dragOverPosition === "before"
          ? "border-t-2 border-t-[color:var(--tm-text)]"
          : dragOverPosition === "after"
            ? "border-b-2 border-b-[color:var(--tm-text)]"
            : ""
      }`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
    >
      <div
        className="grid items-center gap-2 md:[grid-template-columns:var(--task-row-columns)]"
        style={{ "--task-row-columns": rowColumns } as CSSProperties}
      >
        {selectMode && (
          <label
            className="tm-choice flex items-center gap-2 rounded-md border px-2 py-1 text-xs md:[grid-column:1/-1]"
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelected(task.id, e.target.checked)}
            />
            <span>Select</span>
          </label>
        )}
        <div className="min-w-0">
          <button
            className={`${taskTitleButtonClass} text-sm font-medium leading-5`}
            type="button"
            onClick={() => onOpenEditModal(task)}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              {task.delegatedTask ? (
                <DelegatedSenderBadge sender={task.delegatedTask.assignedByUser} />
              ) : null}
              <span
                className={`line-clamp-1 ${
                  isTaskCompleted(task) || pendingComplete ? "line-through opacity-70" : ""
                }`}
              >
                {task.title}
              </span>
              {pendingComplete && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">
                  ✓
                </span>
              )}
              {pendingLabel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {pendingLabel}
                </span>
              )}
            </span>
          </button>
        </div>

        {visibleColumns.category && (
          <div className="min-w-0 text-xs text-[color:var(--tm-muted)]">
            {isEditingCategory ? (
              <div className="tm-chip flex flex-wrap items-center gap-2 rounded-md border px-2 py-1">
                  <CategoryCombobox
                    autoFocus
                    className="min-w-32 bg-transparent outline-none"
                    placeholder="Category"
                    suggestions={categorySuggestions}
                    value={editingCategoryValue}
                    onChange={onChangeCategoryEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSaveCategoryEdit();
                      }

                      if (e.key === "Escape") {
                        e.preventDefault();
                        onCancelCategoryEdit();
                      }
                    }}
                  />
                  <button
                    className="tm-button rounded-md border px-2 py-0.5 text-[11px]"
                    type="button"
                    onClick={onSaveCategoryEdit}
                  >
                    Save
                  </button>
                  <button
                    className="tm-button rounded-md border px-2 py-0.5 text-[11px]"
                    type="button"
                    onClick={onCancelCategoryEdit}
                  >
                    Cancel
                  </button>
              </div>
            ) : (
              <button
                className="line-clamp-1 text-left transition-colors hover:text-[color:var(--tm-text)]"
                type="button"
                onClick={() => onStartCategoryEdit(task)}
              >
                {task.category ?? "Uncategorized"}
              </button>
            )}
          </div>
        )}

        {visibleColumns.due && (
          <div className="flex items-center gap-1.5 text-xs text-[color:var(--tm-muted)]">
            <span className={taskOverdue ? "font-medium text-red-700" : ""}>
              {toDateOnly(task.dueAt) || "—"}
            </span>
            {taskOverdue && <span className={overdueChipClass}>OD</span>}
          </div>
        )}

        {visibleColumns.waitingOn && (
          <div className="min-w-0 text-xs text-[color:var(--tm-muted)]">
            <WaitingOnPills values={waitingOnValues} />
          </div>
        )}

        {visibleColumns.notes && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-[color:var(--tm-muted)]">
            {task.delegatedTask ? (
              <DelegatedTaskStatusPill status={task.delegatedTask.status} />
            ) : null}
            {repeatSummary && <span className={smallChipClass}>{repeatSummary}</span>}
            {repeatPauseBadge && (
              <span className="rounded-full border border-slate-300/70 bg-slate-100/80 px-2 py-0.5 text-slate-700">
                {repeatPauseBadge}
              </span>
            )}
            {hasTaskNotes(task) && (
              <TaskNotesButton notes={formatTaskNotesPreview(task)} />
            )}
            {task.isPriority && <span className={priorityChipClass}>Priority</span>}
            {projectArchived && (
              <span className="rounded-full border border-amber-300/40 bg-amber-100/80 px-2 py-0.5 text-amber-900">
                Archived
              </span>
            )}
            {projectName && <span className="line-clamp-1">{projectName}</span>}
            {task.completedOn && <span>Done {toDateOnly(task.completedOn)}</span>}
          </div>
        )}

        <div className="justify-self-start md:justify-self-end">
          <TaskActionMenu
            task={task}
            completionPending={completionPending}
            pendingAction={pendingAction}
            snoozeDisabled={snoozeDisabled}
            showSnoozeAction={showSnoozeAction}
            onPickSnoozeDate={onPickSnoozeDate}
            onTogglePriority={onTogglePriority}
            onToggleRepeatPause={onToggleRepeatPause}
            onOpenEditModal={onOpenEditModal}
            onToggleCompleted={(selectedTask) =>
              onToggleCompleted(selectedTask, !isTaskCompleted(selectedTask))
            }
            onDelegate={onDelegate}
            onDelete={onDelete}
            pauseReferenceDate={currentDateValue ?? todayInputValue()}
          />
        </div>
      </div>
    </div>
  );
}

function SortableTaskHeader({
  sortColumn,
  sortDirection,
  visibleColumns,
  onSort,
}: {
  sortColumn: TaskSortColumn | null;
  sortDirection: SortDirection | null;
  visibleColumns: Record<VisibleTaskColumn, boolean>;
  onSort: (column: TaskSortColumn) => void;
}) {
  function renderSortableHeader(column: TaskSortColumn, label: string) {
    const active = sortColumn === column && sortDirection;
    const arrow = active === "asc" ? "↑" : active === "desc" ? "↓" : "";

    return (
      <button
        className="group inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-white/45 hover:text-[color:var(--tm-text)]"
        type="button"
        onClick={() => onSort(column)}
      >
        <span className="truncate">{label}</span>
        <span className="w-2 text-[9px] text-[color:var(--tm-muted)] opacity-70">
          {arrow}
        </span>
      </button>
    );
  }

  const headerColumns = [
    "minmax(12rem,1.7fr)",
    visibleColumns.category ? "minmax(8rem,0.8fr)" : null,
    visibleColumns.due ? "minmax(5rem,0.5fr)" : null,
    visibleColumns.waitingOn ? "minmax(7rem,0.65fr)" : null,
    visibleColumns.notes ? "minmax(6rem,0.6fr)" : null,
    "auto",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="grid items-center gap-2 border-b border-[color:var(--tm-border)] bg-white/25 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)] md:[grid-template-columns:var(--task-row-columns)]"
      style={{ "--task-row-columns": headerColumns } as CSSProperties}
    >
      {renderSortableHeader("title", "Title")}
      {visibleColumns.category && renderSortableHeader("category", "Category")}
      {visibleColumns.due && renderSortableHeader("due", "Due")}
      {visibleColumns.waitingOn && <span>Waiting On</span>}
      {visibleColumns.notes && renderSortableHeader("notes", "Tags / Notes")}
      <span className="text-left md:text-right">Actions</span>
    </div>
  );
}

function SortableTaskTableHeaderCell({
  className,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  className: string;
  label: string;
  sortColumn: TaskSortColumn;
  sortDirection: SortDirection | null;
  onSort: (column: TaskSortColumn) => void;
}) {
  const arrow = sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "";

  return (
    <th className={className}>
      <button
        className="group inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-white/45 hover:text-[color:var(--tm-text)]"
        type="button"
        onClick={() => onSort(sortColumn)}
      >
        <span className="truncate">{label}</span>
        <span className="w-2 text-[9px] text-[color:var(--tm-muted)] opacity-70">
          {arrow}
        </span>
      </button>
    </th>
  );
}

function ProjectSearchRow({
  project,
  onClick,
}: {
  project: Project;
  onClick: (project: Project) => void;
}) {
  const subtitle = [
    project.category ? `Category ${project.category}` : null,
    `Start ${toDateOnly(project.startDate)}`,
    project.dueAt ? `Due ${toDateOnly(project.dueAt)}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <button
      className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-white/70 ${
        project.archived
          ? "border-amber-300/20 bg-amber-200/5"
          : "tm-card"
      }`}
      type="button"
      onClick={() => onClick(project)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">{project.name}</div>
            {project.isPriority && (
              <span className={priorityChipClass}>
                Priority
              </span>
            )}
            {project.archived && (
              <span className="rounded-full border border-amber-300/40 bg-amber-100/80 px-2 py-0.5 text-xs text-amber-900">
                Archived
              </span>
            )}
          </div>
          <div className="tm-muted mt-1 text-xs">{subtitle || "No project metadata"}</div>
        </div>
      </div>
    </button>
  );
}

function InsightMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className={`${cardClass} rounded-lg px-3 py-2`}>
      <div className="tm-muted text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function BreakdownList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <div className={sectionCardClass}>
      <div className="mb-3 text-sm font-medium">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm opacity-50">No completed tasks in this period.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${title}-${item.label}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">{item.label}</span>
              <span className={smallChipClass}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrackerClient({
  pageMode,
  profileId,
  profileName,
  routineSupportEnabled = false,
  initialData,
}: TrackerClientProps) {
  const router = useRouter();
  const completionPendingTaskIdsRef = useRef<Set<string>>(new Set());
  const pendingTaskActionIdsRef = useRef<Set<string>>(new Set());
  const preferenceSyncProfileIdRef = useRef<string | null>(null);
  const columnPreferencesHydratedRef = useRef(false);
  const skipNextColumnPreferenceSaveRef = useRef(false);
  const dragOrderSnapshotRef = useRef<Task[] | null>(null);
  const projectDragOrderSnapshotRef = useRef<Project[] | null>(null);
  const lastSavedPreferencesRef = useRef<{
    profileId: string;
    defaultView: ViewMode;
    averageBasis: AverageBasis;
  } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>(() => initialData?.profiles ?? []);
  const [tasks, setTasks] = useState<Task[]>(() =>
    initialData?.tasks.map(normalizeTask) ?? []
  );
  const [projects, setProjects] = useState<Project[]>(() => initialData?.projects ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(todayInputValue);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [taskView, setTaskView] = useState<TaskView>("active");
  const [doneRange, setDoneRange] = useState<DoneRange>("today");
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [sortColumn, setSortColumn] = useState<TaskSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<VisibleTaskColumn, boolean>>(
    () => ({ ...DEFAULT_VISIBLE_TASK_COLUMNS })
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [averageBasis, setAverageBasis] = useState<AverageBasis>("calendar-days");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectSaving, setNewProjectSaving] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editProjectForm, setEditProjectForm] = useState<ProjectFormState | null>(null);
  const [editProjectSaving, setEditProjectSaving] = useState(false);
  const [deleteProjectModalProject, setDeleteProjectModalProject] = useState<Project | null>(null);
  const [deleteProjectSaving, setDeleteProjectSaving] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [delegateTask, setDelegateTask] = useState<Task | null>(null);
  const [deleteTaskSaving, setDeleteTaskSaving] = useState(false);
  const [pendingTaskActions, setPendingTaskActions] = useState<Record<string, TaskPendingAction>>({});
  const [completionPendingTaskIds, setCompletionPendingTaskIds] = useState<string[]>([]);
  const [editingCategoryTaskId, setEditingCategoryTaskId] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");
  const [deleteTaskModalTask, setDeleteTaskModalTask] = useState<Task | null>(null);
  const [deleteTaskMode, setDeleteTaskMode] = useState<DeleteMode>("this");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkActionScope, setBulkActionScope] = useState<DeleteMode>("this");
  const [bulkScopeAction, setBulkScopeAction] = useState<{
    action: BulkAction;
    taskIds: string[];
    category?: string | null;
    projectId?: string | null;
    startDate?: string | null;
    dueAt?: string | null;
    completedOn?: string | null;
  } | null>(null);
  const [bulkProjectModalOpen, setBulkProjectModalOpen] = useState(false);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [bulkDateModal, setBulkDateModal] = useState<"startDate" | "dueAt" | null>(null);
  const [bulkProjectValue, setBulkProjectValue] = useState("");
  const [bulkCategoryValue, setBulkCategoryValue] = useState("");
  const [bulkDateValue, setBulkDateValue] = useState("");
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [singleSnoozeTask, setSingleSnoozeTask] = useState<Task | null>(null);
  const [singleSnoozeDateValue, setSingleSnoozeDateValue] = useState("");
  const [repeatPauseTask, setRepeatPauseTask] = useState<Task | null>(null);
  const [repeatPausePreset, setRepeatPausePreset] =
    useState<RepeatPausePreset>("tomorrow");
  const [repeatPauseUntilValue, setRepeatPauseUntilValue] = useState("");
  const [repeatPauseNoteValue, setRepeatPauseNoteValue] = useState("");
  const [bulkSnoozeDateValue, setBulkSnoozeDateValue] = useState("");
  const [taskContextMenu, setTaskContextMenu] = useState<TaskActionMenuConfig | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<DragPosition | null>(null);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [dragOverProjectPosition, setDragOverProjectPosition] =
    useState<DragPosition | null>(null);
  const [form, setForm] = useState<TaskFormState>(createEmptyTaskForm);
  const [newProjectForm, setNewProjectForm] = useState<ProjectFormState>(
    createEmptyProjectForm
  );
  const [editTaskForm, setEditTaskForm] = useState<EditTaskFormState | null>(null);
  const [discardTarget, setDiscardTarget] = useState<"new-task" | "edit-task" | null>(
    null
  );

  async function refreshData() {
    setLoading(true);
    setError(null);

    try {
      const { profilesData, tasksData, projectsData } = await loadTrackerData(profileId);
      setProfiles(profilesData);
      setTasks(tasksData);
      setProjects(projectsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tracker data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      if (initialData) {
        setProfiles(initialData.profiles);
      setTasks(initialData.tasks.map(normalizeTask));
        setProjects(initialData.projects);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { profilesData, tasksData, projectsData } = await loadTrackerData(profileId);
        if (cancelled) return;
        setProfiles(profilesData);
        setTasks(tasksData);
        setProjects(projectsData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load tracker data");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      cancelled = true;
    };
  }, [initialData, profileId]);

  useEffect(() => {
    setForm(createEmptyTaskForm());
    setNewProjectForm(createEmptyProjectForm());
    setEditTaskForm(null);
    setEditTaskId(null);
    setEditingCategoryTaskId(null);
    setEditingCategoryValue("");
    setSelectedDay(todayInputValue());
    setTaskView("active");
    setDoneRange("today");
    setSortMode("manual");
    setSortColumn(null);
    setSortDirection(null);
    setSearchQuery("");
    setNewProjectOpen(false);
    setEditProjectId(null);
    setEditProjectForm(null);
    setDeleteProjectModalProject(null);
    setDeleteTaskModalTask(null);
    setDeleteTaskMode("this");
    setSelectMode(false);
    setSelectedTaskIds([]);
    setBulkSaving(false);
    setBulkActionScope("this");
    setBulkScopeAction(null);
    setBulkProjectModalOpen(false);
    setBulkCategoryModalOpen(false);
    setBulkDateModal(null);
    setBulkProjectValue("");
    setBulkCategoryValue("");
    setBulkDateValue("");
    setQuickAddValue("");
    setQuickAddSaving(false);
    setSingleSnoozeTask(null);
    setSingleSnoozeDateValue("");
    setBulkSnoozeDateValue("");
    setTaskContextMenu(null);
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
    setDraggedProjectId(null);
    setDragOverProjectId(null);
    setDragOverProjectPosition(null);
    dragOrderSnapshotRef.current = null;
    projectDragOrderSnapshotRef.current = null;
    preferenceSyncProfileIdRef.current = null;
    columnPreferencesHydratedRef.current = false;
    skipNextColumnPreferenceSaveRef.current = false;
    lastSavedPreferencesRef.current = null;
  }, [profileId]);

  useEffect(() => {
    setVisibleColumns(loadVisibleTaskColumns(profileId));
    columnPreferencesHydratedRef.current = true;
    skipNextColumnPreferenceSaveRef.current = true;
  }, [profileId]);

  useEffect(() => {
    if (!columnPreferencesHydratedRef.current || typeof window === "undefined") return;
    if (skipNextColumnPreferenceSaveRef.current) {
      skipNextColumnPreferenceSaveRef.current = false;
      return;
    }

    try {
      window.localStorage.setItem(
        getColumnPreferenceKey(profileId),
        JSON.stringify(visibleColumns)
      );
    } catch (error) {
      console.warn("Could not persist task column preferences", error);
    }
  }, [profileId, visibleColumns]);

  useEffect(() => {
    setSortColumn(null);
    setSortDirection(null);
  }, [viewMode]);

  const currentProfile = profiles.find((profile) => profile.id === profileId);

  useEffect(() => {
    if (!currentProfile) return;

    const hasPendingLocalPreferenceChange =
      lastSavedPreferencesRef.current?.profileId === profileId &&
      (lastSavedPreferencesRef.current.defaultView !== viewMode ||
        lastSavedPreferencesRef.current.averageBasis !== averageBasis);

    if (
      preferenceSyncProfileIdRef.current === profileId &&
      hasPendingLocalPreferenceChange
    ) {
      return;
    }

    const nextViewMode = normalizeViewMode(currentProfile.defaultView);
    const nextAverageBasis = normalizeAverageBasis(currentProfile.averageBasis);

    setViewMode(nextViewMode);
    setAverageBasis(nextAverageBasis);
    preferenceSyncProfileIdRef.current = profileId;
    lastSavedPreferencesRef.current = {
      profileId,
      defaultView: nextViewMode,
      averageBasis: nextAverageBasis,
    };
  }, [averageBasis, currentProfile, profileId, viewMode]);

  useEffect(() => {
    if (preferenceSyncProfileIdRef.current !== profileId) return;

    const nextPreferences = {
      profileId,
      defaultView: viewMode,
      averageBasis,
    };

    if (
      lastSavedPreferencesRef.current?.profileId === nextPreferences.profileId &&
      lastSavedPreferencesRef.current.defaultView === nextPreferences.defaultView &&
      lastSavedPreferencesRef.current.averageBasis === nextPreferences.averageBasis
    ) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/profiles/${profileId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              defaultView: nextPreferences.defaultView,
              averageBasis: nextPreferences.averageBasis,
            }),
          });

          if (!res.ok) {
            throw new Error(`Preference save failed with status ${res.status}`);
          }

          if (cancelled) return;

          lastSavedPreferencesRef.current = nextPreferences;
          setProfiles((prev) =>
            prev.map((profile) =>
              profile.id === profileId
                ? {
                    ...profile,
                    defaultView: nextPreferences.defaultView,
                    averageBasis: nextPreferences.averageBasis,
                  }
                : profile
            )
          );
        } catch (error) {
          if (!cancelled) {
            console.warn("Could not persist profile preferences", error);
          }
        }
      })();
    }, PREFERENCE_SAVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [averageBasis, profileId, viewMode]);

  const currentProfileName = currentProfile?.name ?? profileName;
  const selectedDate = parseDateOnly(selectedDay);
  const weekStart = startOfWeekMon(selectedDate);
  const weekEnd = endOfWeekSun(selectedDate);
  const weekStartValue = dateInputValue(weekStart);
  const weekEndValue = dateInputValue(weekEnd);
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const monthStartValue = dateInputValue(monthStart);
  const monthEndValue = dateInputValue(monthEnd);

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchActive = normalizedSearchQuery.length > 0;
  const archivedView = taskView === "archived";
  const visibleProjects = projects.filter((project) =>
    archivedView ? project.archived : !project.archived
  );
  const assignableProjects = projects.filter(
    (project) => archivedView || !project.archived
  );
  const matchingActiveProjects = searchActive
    ? projects.filter(
        (project) =>
          !project.archived && project.name.toLowerCase().includes(normalizedSearchQuery)
      )
    : [];
  const matchingArchivedProjects = searchActive
    ? projects.filter(
        (project) =>
          project.archived && project.name.toLowerCase().includes(normalizedSearchQuery)
      )
    : [];

  const visibleTasks = archivedView
    ? tasks.filter((task) => isTaskInArchivedProject(task, projectById))
    : filterTasksByArchivedVisibility(tasks, projectById, false);
  const selectedDayVisibleTasks = visibleTasks.filter((task) =>
    isRecurringTask(task) ? isRecurringTaskDueOnDate(task, selectedDay) : true
  );
  const dayInsights = getDayInsightMetrics(selectedDayVisibleTasks, selectedDay);
  const weekInsights = getWeekInsightMetrics(visibleTasks, selectedDay, true, averageBasis);
  const monthInsights = getMonthInsightMetrics(visibleTasks, selectedDay, true, averageBasis);
  const weekBreakdowns = getCompletedBreakdowns(
    visibleTasks,
    selectedDay,
    "week",
    (task) => getTaskProjectLabel(task, projectById)
  );
  const monthBreakdowns = getCompletedBreakdowns(
    visibleTasks,
    selectedDay,
    "month",
    (task) => getTaskProjectLabel(task, projectById)
  );
  const progressTasks = visibleTasks.filter((task) =>
    isTaskVisibleForProgress(task, projectById, archivedView)
  );
  const progressTotal = progressTasks.filter((task) =>
    countsTowardDayProgress(task, selectedDay)
  ).length;
  const progressCompleted = progressTasks.filter((task) =>
    isTaskCompletedOnDate(task, selectedDay)
  ).length;
  const progressPercent =
    progressTotal === 0 ? 0 : Math.round((progressCompleted / progressTotal) * 100);
  const projectProgressRows = [
    ...visibleProjects.map((project) => {
      const totalCount = progressTasks.filter(
        (task) => task.projectId === project.id && countsTowardDayProgress(task, selectedDay)
      ).length;
      const doneCount = progressTasks.filter(
        (task) => task.projectId === project.id && isTaskCompletedOnDate(task, selectedDay)
      ).length;

      return {
        key: project.id,
        label: project.name,
        doneCount,
        totalCount,
        archived: project.archived,
      };
    }),
    {
      key: "unassigned",
      label: "Unassigned",
      doneCount: progressTasks.filter(
        (task) => !task.projectId && isTaskCompletedOnDate(task, selectedDay)
      ).length,
      totalCount: progressTasks.filter(
        (task) => !task.projectId && countsTowardDayProgress(task, selectedDay)
      ).length,
      archived: false,
    },
  ]
    .map((row) => ({
      ...row,
      progressPercent:
        row.totalCount === 0 ? 0 : Math.round((row.doneCount / row.totalCount) * 100),
    }))
    .filter((row) => row.totalCount > 0);

  const projectedOpenTasks = projectOpenTasksForView(
    visibleTasks,
    viewMode,
    selectedDay,
    weekStartValue,
    weekEndValue,
    monthStartValue,
    monthEndValue
  );
  const openFilter = taskViewToOpenFilter(taskView);
  const openTasks = projectedOpenTasks[
    openFilter === "all-active"
      ? "allActive"
      : openFilter === "today"
        ? "today"
        : openFilter === "upcoming"
          ? "upcoming"
          : "overdue"
  ];
  const sortedOpenTasks = useMemo(
    () => sortTasks(openTasks, sortMode),
    [openTasks, sortMode]
  );

  const doneTasks = visibleTasks.filter((task) => {
    if (!task.completedOn) return false;

    const completedDate = toDateOnly(task.completedOn);

    switch (doneRange) {
      case "today":
        return completedDate === selectedDay;
      case "week":
        return completedDate >= weekStartValue && completedDate <= weekEndValue;
      case "month":
        return completedDate >= monthStartValue && completedDate <= monthEndValue;
      case "all":
        return true;
      default:
        return false;
    }
  });

  function isTaskVisibleInDayView(task: Task) {
    if (!task.projectId) return true;

    const project = projectById.get(task.projectId);
    return project ? archivedView || !project.archived : true;
  }

  const activeDayOpenTasks = sortedOpenTasks.filter(
    (task) => isTaskVisibleInDayView(task) && matchesTaskSearch(task, searchQuery, projectById)
  );
  const pausedDayOpenTasks = sortTasks(
    visibleTasks.filter(
      (task) =>
        isRecurringTask(task) &&
        !isTaskCompleted(task) &&
        isRepeatPausedOnDate(task, selectedDay) &&
        isTaskVisibleInDayView(task) &&
        matchesTaskSearch(task, searchQuery, projectById)
    ),
    sortMode
  );
  const dayDoneTasks = doneTasks.filter(
    (task) =>
      isTaskVisibleInDayView(task) && matchesTaskSearch(task, searchQuery, projectById)
  );
  const archivedDayTasks = sortTasks(
    tasks.filter(
      (task) =>
        isTaskInArchivedProject(task, projectById) &&
        matchesTaskSearch(task, searchQuery, projectById)
    ),
    sortMode
  );
  const dayViewTasks =
    taskView === "done"
      ? dayDoneTasks
      : taskView === "archived"
        ? archivedDayTasks
        : taskView === "paused"
          ? pausedDayOpenTasks
          : activeDayOpenTasks;
  const displayedDayViewTasks = useMemo(
    () => sortTasksByColumn(dayViewTasks, sortColumn, sortDirection),
    [dayViewTasks, sortColumn, sortDirection]
  );
  const pausedOpenTasks = sortTasks(
    visibleTasks.filter(
      (task) =>
        isRecurringTask(task) &&
        !isTaskCompleted(task) &&
        isRepeatPausedOnDate(task, selectedDay)
    ),
    sortMode
  );
  const baseMatrixTasks =
    taskView === "done"
      ? doneTasks
      : taskView === "archived"
        ? archivedDayTasks
        : taskView === "paused"
          ? pausedOpenTasks
          : sortedOpenTasks;
  const matrixTasks = useMemo(
    () => sortTasksByColumn(baseMatrixTasks, sortColumn, sortDirection),
    [baseMatrixTasks, sortColumn, sortDirection]
  );
  const searchResults = selectedDayVisibleTasks.filter((task) =>
    matchesTaskSearch(task, searchQuery, projectById)
  );
  const searchSections: SearchSection[] = [
    {
      key: "active",
      label: "Active",
      tasks: sortTasks(
        searchResults.filter(
          (task) => !isTaskCompleted(task) && isTaskVisibleOnDate(task, selectedDay)
        ),
        sortMode
      ),
    },
    {
      key: "upcoming",
      label: "Upcoming",
      tasks: sortTasks(
        searchResults.filter(
          (task) => !isTaskCompleted(task) && isTaskUpcomingAfterDate(task, selectedDay)
        ),
        sortMode
      ),
    },
    {
      key: "complete",
      label: "Complete",
      tasks: searchResults.filter((task) => isTaskCompleted(task)),
    },
  ];
  const displayedSearchSections = useMemo(
    () =>
      searchSections.map((section) => ({
        ...section,
        tasks: sortTasksByColumn(section.tasks, sortColumn, sortDirection),
      })),
    [searchSections, sortColumn, sortDirection]
  );
  const searchResultCount = searchSections.reduce(
    (count, section) => count + section.tasks.length,
    0
  );
  const categorySuggestions = Array.from(
    new Map(
      tasks
        .map((task) => task.category?.trim() ?? "")
        .filter(Boolean)
        .map((category) => [category.toLocaleLowerCase(), category])
    ).values()
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const waitingOnSuggestions = Array.from(
    new Map(
      tasks
        .flatMap((task) => task.noteHistory.map((note) => note.waitingOn?.trim() ?? ""))
        .filter(Boolean)
        .map((waitingOn) => [waitingOn.toLocaleLowerCase(), waitingOn])
    ).values()
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  function clearSearch() {
    setSearchQuery("");
  }

  function scrollToProjectSection(projectId: string) {
    requestAnimationFrame(() => {
      document
        .getElementById(`project-${projectId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function focusProjectFromSearch(project: Project) {
    setViewMode("day");
    setSearchQuery("");

    if (project.collapsed) {
      setProjects((prev) =>
        prev.map((item) =>
          item.id === project.id ? { ...item, collapsed: false } : item
        )
      );
      scrollToProjectSection(project.id);

      try {
        await updateProject(project.id, { collapsed: false });
      } catch (err) {
        setProjects((prev) =>
          prev.map((item) =>
            item.id === project.id ? { ...item, collapsed: true } : item
          )
        );
        setError(err instanceof Error ? err.message : "Could not update project");
      }

      return;
    }

    scrollToProjectSection(project.id);
  }

  const weekDays = buildCalendarDays(
    visibleTasks,
    weekStart,
    weekEnd,
    selectedDate.getMonth()
  );
  const monthDays = buildCalendarDays(
    visibleTasks,
    getStartOfMonthGrid(selectedDate),
    getEndOfMonthGrid(selectedDate),
    selectedDate.getMonth()
  );
  const nonDayOpenListLabel =
    viewMode === "week"
      ? `${formatLongDate(weekStartValue)} to ${formatLongDate(weekEndValue)}`
      : formatMonthTitle(selectedDate);
  const showStartChipInTables = viewMode === "week" || viewMode === "month";
  const selectedRangeLabel =
    viewMode === "day"
      ? formatLongDate(selectedDay)
      : viewMode === "week"
        ? `${formatLongDate(weekStartValue)} to ${formatLongDate(weekEndValue)}`
        : formatMonthTitle(selectedDate);

  const groupedSections = [
    {
      key: "recurring",
      label: "Recurring",
      project: null,
      collapsed: false,
      openTasks: displayedDayViewTasks.filter(
        (task) => isRecurringTask(task) && !task.projectId
      ),
      doneTasks: dayDoneTasks.filter(
        (task) => isRecurringTask(task) && !task.projectId
      ),
      progressTotal: 0,
      progressCompleted: 0,
    },
    {
      key: "unassigned",
      label: "Unassigned",
      project: null,
      collapsed: false,
      openTasks: displayedDayViewTasks.filter(
        (task) => !isRecurringTask(task) && !task.projectId
      ),
      doneTasks: dayDoneTasks.filter(
        (task) => !isRecurringTask(task) && !task.projectId
      ),
      progressTotal: 0,
      progressCompleted: 0,
    },
    ...visibleProjects.map((project) => ({
      key: project.id,
      label: project.name,
      project,
      collapsed: project.collapsed,
      openTasks: displayedDayViewTasks.filter((task) => task.projectId === project.id),
      doneTasks: dayDoneTasks.filter((task) => task.projectId === project.id),
      progressTotal: progressTasks.filter(
        (task) => task.projectId === project.id && countsTowardDayProgress(task, selectedDay)
      ).length,
      progressCompleted: progressTasks.filter(
        (task) =>
          task.projectId === project.id &&
          isTaskCompletedOnDate(task, selectedDay)
      ).length,
    })),
  ];
  const visibleGroupedSections = groupedSections.filter(
    (section) =>
      section.openTasks.length > 0 ||
      (routineSupportEnabled &&
        (taskView === "active" || taskView === "today") &&
        Boolean(section.project && getRoutineAffirmation(section.project.name)))
  );
  const visibleDayTaskIds = Array.from(
    new Set(
      (searchActive
        ? displayedSearchSections.flatMap((section) => section.tasks)
        : visibleGroupedSections.flatMap((section) => section.openTasks)
      ).map((task) => task.id)
    )
  );
  const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(task.id));
  const recurringSelectedTasks = selectedTasks.filter((task) => isRecurringTask(task));
  const hasRecurringSelection = recurringSelectedTasks.length > 0;
  const visibleSelectedCount = visibleDayTaskIds.filter((taskId) =>
    selectedTaskIds.includes(taskId)
  ).length;
  const allVisibleSelected =
    visibleDayTaskIds.length > 0 && visibleSelectedCount === visibleDayTaskIds.length;
  const partiallyVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < visibleDayTaskIds.length;
  const selectAllShownCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (viewMode !== "day") {
      setSelectMode(false);
      setSelectedTaskIds([]);
    }
  }, [viewMode]);

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const next = prev.filter((taskId) => visibleDayTaskIds.includes(taskId));

      if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
        return prev;
      }

      return next;
    });
  }, [visibleDayTaskIds]);

  useEffect(() => {
    if (!selectAllShownCheckboxRef.current) return;

    selectAllShownCheckboxRef.current.indeterminate = partiallyVisibleSelected;
  }, [partiallyVisibleSelected]);

  const editTask = editTaskId ? tasks.find((task) => task.id === editTaskId) ?? null : null;
  const projectOptions = projects.filter(
    (project) =>
      !project.archived || archivedView || project.id === (editTask?.projectId ?? "")
  );
  const newTaskProjectOptions = assignableProjects;
  const isReportingPage = pageMode === "reporting";
  const manualReorderEnabled =
    viewMode === "day" &&
    !searchActive &&
    taskView === "active" &&
    sortMode === "manual" &&
    !sortColumn &&
    !selectMode;

  useEffect(() => {
    if (manualReorderEnabled) return;

    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
    dragOrderSnapshotRef.current = null;
  }, [manualReorderEnabled]);

  useEffect(() => {
    if (!taskContextMenu) return;

    function closeContextMenu() {
      setTaskContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    }

    document.addEventListener("pointerdown", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);

    return () => {
      document.removeEventListener("pointerdown", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, [taskContextMenu]);

  function toggleColumnSort(column: TaskSortColumn) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }

    setSortColumn(null);
    setSortDirection(null);
    setSortMode("manual");
  }

  function changeSortMode(nextSortMode: SortMode) {
    setSortMode(nextSortMode);
    setSortColumn(null);
    setSortDirection(null);
  }

  function toggleVisibleColumn(column: VisibleTaskColumn) {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  }

  function openTaskContextMenu(
    event: React.MouseEvent,
    task: Task,
    options: {
      showSnoozeAction?: boolean;
      completedActionLabel?: string;
      toggleCompletedTo?: boolean;
      pauseReferenceDate?: string;
    } = {}
  ) {
    event.preventDefault();
    event.stopPropagation();

    setTaskContextMenu({
      taskId: task.id,
      x: event.clientX,
      y: event.clientY,
      showSnoozeAction: options.showSnoozeAction ?? true,
      completedActionLabel: options.completedActionLabel,
      toggleCompletedTo: options.toggleCompletedTo,
      pauseReferenceDate: options.pauseReferenceDate ?? selectedDay,
    });
  }

  function shiftSelectedDay(direction: -1 | 1) {
    const nextDate =
      viewMode === "day"
        ? addDays(selectedDate, direction)
        : viewMode === "week"
          ? addDays(selectedDate, direction * 7)
          : addMonthsKeepingDay(selectedDate, direction);
    setSelectedDay(dateInputValue(nextDate));
  }

  function jumpToDay(dateValue: string) {
    setSelectedDay(dateValue);
    setViewMode("day");
  }

  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/p/${profileId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startDate: form.startDate,
          dueAt: form.dueAt || null,
          category: form.category || null,
          notes: form.notes.trim() || null,
          waitingOn: form.waitingOn.trim() || null,
          projectId: form.projectId || null,
          repeatEnabled: form.repeatEnabled,
          repeatPattern: form.repeatEnabled ? form.repeatPattern : null,
          repeatInterval: form.repeatEnabled ? form.repeatInterval : 1,
          repeatDays:
            form.repeatEnabled &&
            (form.repeatPattern === "daily" || form.repeatPattern === "weekly")
              ? form.repeatDays
              : null,
          repeatWeeklyDay:
            form.repeatEnabled && form.repeatPattern === "weekly"
              ? form.repeatWeeklyDay
              : null,
          repeatMonthlyDay:
            form.repeatEnabled && form.repeatPattern === "monthly"
              ? form.repeatMonthlyDay
              : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create task");
      }

      const submittedNote = form.notes.trim();
      const submittedWaitingOn = form.waitingOn.trim();
      const createdTask = (await res.json()) as Task & {
        noteSaveError?: boolean;
        noteSaveErrorMessage?: string;
      };
      const task = normalizeTask(createdTask);
      setTasks((prev) => [task, ...prev]);
      setForm(createEmptyTaskForm(selectedDay));
      setNewTaskOpen(false);
      if (createdTask.noteSaveError) {
        setEditTaskId(task.id);
        setEditTaskForm({
          ...createEditTaskForm(task),
          notes: submittedNote,
          waitingOn: submittedWaitingOn,
        });
        setError(
          createdTask.noteSaveErrorMessage ??
            "Task was created, but the note could not be saved. Please add the note again from task details."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  }

  async function submitQuickAdd() {
    if (quickAddSaving) return;

    const parsed = parseQuickAddInput(quickAddValue, selectedDay, projects);
    if (!parsed.title) {
      return;
    }

    setQuickAddSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/p/${profileId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: parsed.title,
          startDate: selectedDay,
          dueAt: parsed.dueAt,
          category: parsed.category,
          projectId: parsed.projectId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create task");
      }

      const task = normalizeTask((await res.json()) as Task);
      setTasks((prev) => [task, ...prev]);
      setQuickAddValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setQuickAddSaving(false);
    }
  }

  async function createProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newProjectForm.name.trim();
    if (!name) return;

    setNewProjectSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/p/${profileId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate: newProjectForm.startDate,
          dueAt: newProjectForm.dueAt || null,
          category: newProjectForm.category || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create project");
      }

      const project = (await res.json()) as Project;
      setProjects((prev) => [project, ...prev]);
      setNewProjectForm(createEmptyProjectForm());
      setNewProjectOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setNewProjectSaving(false);
    }
  }

  async function updateTask(
    taskId: string,
    body: Record<string, unknown>,
    options: { pendingStartedAt?: number } = {}
  ) {
    setError(null);

    const res = await fetch(`/api/p/${profileId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not update task");
    }

    const payload = (await res.json()) as Task | { task: Task; createdTask?: Task | null };
    const task = normalizeTask("task" in payload ? payload.task : payload);
    const createdTask =
      "task" in payload && payload.createdTask ? normalizeTask(payload.createdTask) : null;

    if (options.pendingStartedAt) {
      await waitForMinimumPendingTime(options.pendingStartedAt);
    }

    setTasks((prev) => {
      const replaced = prev.map((item) => (item.id === task.id ? task : item));

      if (!createdTask) {
        return replaced;
      }

      const withoutCreated = replaced.filter((item) => item.id !== createdTask.id);
      return [createdTask, ...withoutCreated];
    });

    return task;
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

  async function toggleTaskCompleted(taskId: string, completed: boolean) {
    if (completionPendingTaskIdsRef.current.has(taskId)) {
      return;
    }
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(taskId, completed ? "complete" : "update")) {
      return;
    }

    completionPendingTaskIdsRef.current.add(taskId);
    setCompletionPendingTaskIds((prev) =>
      prev.includes(taskId) ? prev : [...prev, taskId]
    );

    try {
      await updateTask(taskId, {
        completed,
        completedOn: completed ? selectedDay : null,
      }, { pendingStartedAt });
    } finally {
      await waitForMinimumPendingTime(pendingStartedAt);
      completionPendingTaskIdsRef.current.delete(taskId);
      setCompletionPendingTaskIds((prev) => prev.filter((id) => id !== taskId));
      finishTaskPendingAction(taskId);
    }
  }

  async function toggleTaskPriority(task: Task) {
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(task.id, "update")) return;
    try {
      await updateTask(task.id, { isPriority: !task.isPriority }, { pendingStartedAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task");
    } finally {
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(task.id);
    }
  }

  function closeRepeatPauseModal() {
    setRepeatPauseTask(null);
    setRepeatPausePreset("tomorrow");
    setRepeatPauseUntilValue("");
    setRepeatPauseNoteValue("");
  }

  function requestToggleRepeatPause(task: Task) {
    if (!isRecurringTask(task)) return;

    if (isRepeatPausedOnDate(task, selectedDay)) {
      const pendingStartedAt = Date.now();
      if (!startTaskPendingAction(task.id, "update")) return;
      void updateTask(task.id, {
        repeatPaused: false,
        repeatPauseUntil: null,
        repeatPauseNote: null,
      }, { pendingStartedAt })
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Could not resume repeat")
        )
        .finally(async () => {
          await waitForMinimumPendingTime(pendingStartedAt);
          finishTaskPendingAction(task.id);
        });
      return;
    }

    setRepeatPauseTask(task);
    setRepeatPausePreset("tomorrow");
    setRepeatPauseUntilValue(getRepeatPauseUntilForPreset(selectedDay, "tomorrow"));
    setRepeatPauseNoteValue(task.repeatPauseNote ?? "");
  }

  async function pauseRepeatTask() {
    if (!repeatPauseTask) return;

    const repeatPauseUntil =
      repeatPausePreset === "indefinite" ? null : repeatPauseUntilValue || null;

    await updateTask(repeatPauseTask.id, {
      repeatPaused: true,
      repeatPauseUntil,
      repeatPauseNote: repeatPauseNoteValue.trim() || null,
    });
    closeRepeatPauseModal();
  }

  function applyManualOrder(orderedIds: string[]) {
    const orderById = new Map(orderedIds.map((id, index) => [id, (index + 1) * 10]));

    setTasks((prev) =>
      prev.map((task) =>
        orderById.has(task.id)
          ? { ...task, orderIndex: orderById.get(task.id) ?? task.orderIndex }
          : task
      )
    );
  }

  async function reorderVisibleOpenTasks(orderedIds: string[]) {
    const res = await fetch(`/api/p/${profileId}/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not reorder tasks");
    }
  }

  function finishDragState() {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
  }

  async function handleTaskDrop(targetTaskId: string, position: "before" | "after") {
    if (!manualReorderEnabled || !draggedTaskId) {
      finishDragState();
      return;
    }

    const orderedIds = activeDayOpenTasks.map((task) => task.id);
    const nextOrderedIds = reorderTaskIds(orderedIds, draggedTaskId, targetTaskId, position);

    if (nextOrderedIds.every((id, index) => id === orderedIds[index])) {
      finishDragState();
      return;
    }

    dragOrderSnapshotRef.current = tasks;
    applyManualOrder(nextOrderedIds);
    finishDragState();

    try {
      await reorderVisibleOpenTasks(nextOrderedIds);
      dragOrderSnapshotRef.current = null;
    } catch (err) {
      if (dragOrderSnapshotRef.current) {
        setTasks(dragOrderSnapshotRef.current);
        dragOrderSnapshotRef.current = null;
      }
      window.alert(err instanceof Error ? err.message : "Could not reorder tasks");
    }
  }

  async function updateProject(projectId: string, body: Record<string, unknown>) {
    setError(null);

    const res = await fetch(`/api/p/${profileId}/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not update project");
    }

    const project = (await res.json()) as Project;
    setProjects((prev) => prev.map((item) => (item.id === project.id ? project : item)));
    return project;
  }

  function applyProjectOrder(orderedIds: string[]) {
    const orderById = new Map(orderedIds.map((id, index) => [id, (index + 1) * 10]));

    setProjects((prev) =>
      [...prev]
        .map((project) => ({
          ...project,
          orderIndex: orderById.get(project.id) ?? project.orderIndex,
        }))
        .sort(compareProjectsForManualSort)
    );
  }

  async function reorderProjects(orderedIds: string[]) {
    const res = await fetch(`/api/p/${profileId}/projects/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not reorder projects");
    }
  }

  function finishProjectDragState() {
    setDraggedProjectId(null);
    setDragOverProjectId(null);
    setDragOverProjectPosition(null);
  }

  async function handleProjectDrop(targetProjectId: string, position: DragPosition) {
    if (!draggedProjectId) {
      finishProjectDragState();
      return;
    }

    const orderedIds = projects.map((project) => project.id);
    const nextOrderedIds = reorderIds(
      orderedIds,
      draggedProjectId,
      targetProjectId,
      position
    );

    if (nextOrderedIds.every((id, index) => id === orderedIds[index])) {
      finishProjectDragState();
      return;
    }

    projectDragOrderSnapshotRef.current = projects;
    applyProjectOrder(nextOrderedIds);
    finishProjectDragState();

    try {
      await reorderProjects(nextOrderedIds);
      projectDragOrderSnapshotRef.current = null;
    } catch (err) {
      if (projectDragOrderSnapshotRef.current) {
        setProjects(projectDragOrderSnapshotRef.current);
        projectDragOrderSnapshotRef.current = null;
      }
      window.alert(err instanceof Error ? err.message : "Could not reorder projects");
    }
  }

  function openProjectEditor(project: Project) {
    setEditProjectId(project.id);
    setEditProjectForm(createProjectForm(project));
  }

  function closeProjectEditor() {
    setEditProjectId(null);
    setEditProjectForm(null);
    setEditProjectSaving(false);
  }

  async function submitProjectEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editProjectId || !editProjectForm) return;

    setEditProjectSaving(true);
    setError(null);

    try {
      await updateProject(editProjectId, {
        name: editProjectForm.name,
        startDate: editProjectForm.startDate,
        dueAt: editProjectForm.dueAt || null,
        category: editProjectForm.category || null,
      });
      closeProjectEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update project");
    } finally {
      setEditProjectSaving(false);
    }
  }

  async function deleteProject(project: Project) {
    setError(null);
    setDeleteProjectSaving(true);
    const scrollY = window.scrollY;

    try {
      const res = await fetch(`/api/p/${profileId}/projects/${project.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        throw new Error(responseBody?.error ?? "Could not delete project");
      }

      await refreshData();
      setDeleteProjectModalProject(null);
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    } finally {
      setDeleteProjectSaving(false);
    }
  }

  async function deleteTask(task: Task, mode: DeleteMode) {
    const pendingStartedAt = Date.now();
    if (!startTaskPendingAction(task.id, "delete")) return;
    setError(null);
    setDeleteTaskSaving(true);
    const scrollY = window.scrollY;

    try {
      const res = await fetch(`/api/p/${profileId}/tasks/${task.id}?mode=${mode}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        throw new Error(responseBody?.error ?? "Could not delete task");
      }

      await waitForMinimumPendingTime(pendingStartedAt);
      await refreshData();
      setDeleteTaskModalTask(null);
      setDeleteTaskMode("this");
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    } finally {
      setDeleteTaskSaving(false);
      await waitForMinimumPendingTime(pendingStartedAt);
      finishTaskPendingAction(task.id);
    }
  }

  function requestDeleteTask(task: Task) {
    setDeleteTaskModalTask(task);
    setDeleteTaskMode("this");
  }

  function startCategoryEdit(task: Task) {
    setEditingCategoryTaskId(task.id);
    setEditingCategoryValue(task.category ?? "");
  }

  function cancelCategoryEdit() {
    setEditingCategoryTaskId(null);
    setEditingCategoryValue("");
  }

  async function saveCategoryEdit() {
    if (!editingCategoryTaskId) return;

    const nextCategory = editingCategoryValue.trim();
    const currentTask = tasks.find((task) => task.id === editingCategoryTaskId);

    if (!currentTask) {
      cancelCategoryEdit();
      return;
    }

    if ((currentTask.category ?? "") === nextCategory) {
      cancelCategoryEdit();
      return;
    }

    try {
      await updateTask(editingCategoryTaskId, { category: nextCategory || null });
      cancelCategoryEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task");
    }
  }

  function toggleTaskSelected(taskId: string, checked: boolean) {
    setSelectedTaskIds((prev) => {
      if (checked) {
        return prev.includes(taskId) ? prev : [...prev, taskId];
      }

      return prev.filter((id) => id !== taskId);
    });
  }

  function toggleSelectAllShown() {
    setSelectedTaskIds(allVisibleSelected ? [] : visibleDayTaskIds);
  }

  async function executeBulkAction(input: {
    action: BulkAction;
    taskIds: string[];
    scope?: DeleteMode;
    category?: string | null;
    projectId?: string | null;
    startDate?: string | null;
    dueAt?: string | null;
    completedOn?: string | null;
  }) {
    if (input.taskIds.length === 0) return;

    setBulkSaving(true);
    setError(null);
    const scrollY = window.scrollY;

    try {
      const res = await fetch(`/api/p/${profileId}/tasks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not run bulk action");
      }

      await refreshData();
      setBulkActionScope("this");
      setBulkScopeAction(null);
      setBulkProjectModalOpen(false);
      setBulkCategoryModalOpen(false);
      setBulkDateModal(null);
      setBulkProjectValue("");
      setBulkCategoryValue("");
      setBulkDateValue("");
      setSingleSnoozeTask(null);
      setSingleSnoozeDateValue("");
      setBulkSnoozeDateValue("");
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    } finally {
      setBulkSaving(false);
    }
  }

  function requestBulkAction(input: {
    action: BulkAction;
    category?: string | null;
    projectId?: string | null;
    startDate?: string | null;
    dueAt?: string | null;
    completedOn?: string | null;
  }) {
    if (selectedTaskIds.length === 0) return;

    const request = {
      ...input,
      taskIds: selectedTaskIds,
    };

    if (input.action === "delete" && hasRecurringSelection) {
      setBulkScopeAction(request);
      setBulkActionScope("this");
      return;
    }

    void executeBulkAction({ ...request, scope: "this" }).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not run bulk action")
    );
  }

  function getTaskSnoozeBaseDateValue(task: Task) {
    return maxDateValue(toDateOnly(task.startDate), selectedDay);
  }

  function snoozeTask(task: Task, preset: SnoozePreset) {
    const startDate = getSnoozeDateValue(getTaskSnoozeBaseDateValue(task), preset);

    void executeBulkAction({
      action: "set-start-date",
      taskIds: [task.id],
      scope: "this",
      startDate,
    }).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not snooze task")
    );
  }

  function openSingleTaskSnoozeDate(task: Task) {
    setSingleSnoozeTask(task);
    setSingleSnoozeDateValue(getSnoozeDateValue(getTaskSnoozeBaseDateValue(task), "tomorrow"));
  }

  function snoozeSelectedTasks(preset: SnoozePreset) {
    if (selectedTaskIds.length === 0) return;

    requestBulkAction({
      action: "set-start-date",
      startDate: getSnoozeDateValue(selectedDay, preset),
    });
  }

  function openTaskEditor(task: Task) {
    setEditTaskId(task.id);
    setEditTaskForm(createEditTaskForm(task));
  }

  function openDelegateTask(task: Task) {
    if (task.delegatedTask) {
      setError("This task has already been delegated.");
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

    setTasks((prev) =>
      prev.map((task) =>
        task.id === delegateTask.id ? { ...task, delegatedTask } : task
      )
    );
    setDelegateTask(null);
    router.refresh();
  }

  function closeNewTaskDialog() {
    if (saving) return;

    if (isTaskFormDirty(form, createEmptyTaskForm(selectedDay))) {
      setDiscardTarget("new-task");
      return;
    }

    setNewTaskOpen(false);
    setForm(createEmptyTaskForm(selectedDay));
  }

  function closeTaskEditor() {
    if (!editTaskForm || !editTask) {
      setEditTaskId(null);
      setEditTaskForm(null);
      return;
    }

    if (isEditTaskFormDirty(editTaskForm, createEditTaskForm(editTask))) {
      setDiscardTarget("edit-task");
      return;
    }

    setEditTaskId(null);
    setEditTaskForm(null);
  }

  function discardUnsavedChanges() {
    if (discardTarget === "new-task") {
      setNewTaskOpen(false);
      setForm(createEmptyTaskForm(selectedDay));
    }

    if (discardTarget === "edit-task") {
      setEditTaskId(null);
      setEditTaskForm(null);
    }

    setDiscardTarget(null);
  }

  async function submitTaskEditor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
            name: profileName,
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
      setTasks((prev) =>
        prev.map((task) =>
          task.id === editTaskId
            ? { ...task, noteHistory: [pendingNote, ...task.noteHistory] }
            : task
        )
      );
    }

    try {
      await updateTask(editTaskId, {
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
      setEditTaskId(null);
      setEditTaskForm(null);
    } catch (err) {
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
        setTasks((prev) =>
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
      setError(
        pendingNote
          ? err instanceof Error
            ? `Could not save task note. ${err.message}`
            : "Could not save task note. Your note text is still in the editor."
          : err instanceof Error
            ? err.message
            : "Could not update task"
      );
    } finally {
      setEditTaskSaving(false);
    }
  }

  async function toggleProjectCollapsed(project: Project) {
    try {
      await updateProject(project.id, { collapsed: !project.collapsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update project");
    }
  }

  async function toggleProjectArchived(project: Project) {
    try {
      await updateProject(project.id, { archived: !project.archived });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update project");
    }
  }

  async function toggleProjectPriority(project: Project) {
    try {
      await updateProject(project.id, { isPriority: !project.isPriority });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update project");
    }
  }

  if (isReportingPage) {
    return (
      <section className="space-y-4 text-[color:var(--tm-text)]">
        <div className={commandBarClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`${smallChipClass} px-3 py-1.5 uppercase tracking-[0.14em]`}>
              {currentProfileName}
            </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={segmentedTabSetClass}>
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={
                      viewMode === option.value
                        ? segmentedActiveTabClass
                        : segmentedTabClass
                    }
                    type="button"
                    onClick={() => setViewMode(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <DateInput
                className={`${inputClass} min-w-[11rem]`}
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              />
              <button className={buttonClass} type="button" onClick={() => shiftSelectedDay(-1)}>
                Prev
              </button>
              <button className={buttonClass} type="button" onClick={() => shiftSelectedDay(1)}>
                Next
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="tm-muted">Profile</span>
                <select
                  className={`${inputClass} min-w-[11rem]`}
                  value={profileId}
                  onChange={(e) => router.push(`/p/${e.target.value}/reporting`)}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id} className="text-black">
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="tm-muted">Average</span>
                <select
                  className={`${inputClass} min-w-[11rem]`}
                  value={averageBasis}
                  onChange={(e) => setAverageBasis(e.target.value as AverageBasis)}
                >
                  {AVERAGE_BASIS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="text-black">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-300/60 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className={sectionCardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="tm-muted text-xs font-semibold uppercase tracking-[0.18em]">
                Reporting
              </div>
              <h1 className="mt-1 text-2xl font-semibold">Reporting</h1>
              <div className="tm-muted mt-1 text-sm">Metrics, charts, and summaries.</div>
            </div>
            <div className="tm-muted text-sm">{selectedRangeLabel}</div>
          </div>
        </section>

        {viewMode === "day" && (
          <section className={sectionCardClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Day Progress</h2>
                <div className="tm-muted text-sm">{formatLongDate(selectedDay)}</div>
              </div>
              <div className="tm-muted text-sm">
                {progressCompleted} / {progressTotal} completed
              </div>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InsightMetric label="Completed Today" value={dayInsights.completedToday} />
              <InsightMetric label="Created Today" value={dayInsights.createdToday} />
              <InsightMetric label="Open Today" value={dayInsights.openToday} />
              <InsightMetric label="Rolled Over" value={dayInsights.rolledOver} />
            </div>
            <div className={`${progressTrackClass} h-3`}>
              <div
                key={selectedDay}
                className={`h-full ${progressFillClass}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </section>
        )}

        {viewMode === "week" && (
          <>
            <section className={sectionCardClass}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Week Summary</h2>
                  <div className="tm-muted text-sm">
                    {formatLongDate(weekStartValue)} to {formatLongDate(weekEndValue)}
                  </div>
                </div>
                <div className="tm-muted text-right text-sm">Week starts Monday</div>
              </div>
              <div className="tm-muted mb-4 text-sm">
                Avg/day basis:{" "}
                {averageBasis === "calendar-days"
                  ? `${weekInsights.basisDays} calendar days`
                  : `${weekInsights.basisDays} work week days`}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InsightMetric label="Completed This Week" value={weekInsights.completedCount} />
                <InsightMetric label="Avg / Day" value={weekInsights.avgPerDay.toFixed(1)} />
                <InsightMetric
                  label="Best Day"
                  value={`${weekInsights.bestDay.date.toLocaleDateString(undefined, {
                    weekday: "short",
                  })} (${weekInsights.bestDay.count})`}
                />
                <InsightMetric label="Backlog" value={weekInsights.backlogCount} />
              </div>
            </section>
            <section className="grid gap-4 xl:grid-cols-2">
              <BreakdownList title="Top Projects" items={weekBreakdowns.topProjects} />
              <BreakdownList title="Top Categories" items={weekBreakdowns.topCategories} />
            </section>
          </>
        )}

        {viewMode === "month" && (
          <>
            <section className={sectionCardClass}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Month Summary</h2>
                  <div className="tm-muted text-sm">{formatMonthTitle(selectedDate)}</div>
                </div>
                <div className="tm-muted text-right text-sm">Week starts Monday</div>
              </div>
              <div className="tm-muted mb-4 text-sm">
                Avg/day basis:{" "}
                {averageBasis === "calendar-days"
                  ? `${monthInsights.basisDays} calendar days`
                  : `${monthInsights.basisDays} work week days`}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InsightMetric label="Completed This Month" value={monthInsights.completedCount} />
                <InsightMetric label="Avg / Day" value={monthInsights.avgPerDay.toFixed(1)} />
                <InsightMetric
                  label="Best Week"
                  value={`${monthInsights.bestWeek.start.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}-${monthInsights.bestWeek.end.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })} (${monthInsights.bestWeek.count})`}
                />
                <InsightMetric
                  label="Backlog Snapshot"
                  value={monthInsights.backlogSnapshotCount}
                />
              </div>
            </section>
            <section className="grid gap-4 xl:grid-cols-2">
              <BreakdownList title="Top Projects" items={monthBreakdowns.topProjects} />
              <BreakdownList title="Top Categories" items={monthBreakdowns.topCategories} />
            </section>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4 text-[color:var(--tm-text)]">
      <div className={commandBarClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`${smallChipClass} px-3 py-1.5 uppercase tracking-[0.14em]`}>
              {currentProfileName}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={segmentedTabSetClass}>
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={
                    viewMode === option.value
                      ? segmentedActiveTabClass
                      : segmentedTabClass
                  }
                  type="button"
                  onClick={() => setViewMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <DateInput
              className={`${inputClass} min-w-[11rem]`}
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            />
            <button className={buttonClass} type="button" onClick={() => shiftSelectedDay(-1)}>
              Prev
            </button>
            <button className={buttonClass} type="button" onClick={() => shiftSelectedDay(1)}>
              Next
            </button>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <button
              className={primaryButtonClass}
              type="button"
              onClick={() => setNewTaskOpen(true)}
            >
              + Task
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300/60 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {routineSupportEnabled && (
        <SundayCheckIn
          profile={{ id: profileId, name: currentProfileName }}
          variant="compact"
        />
      )}

      {isReportingPage && viewMode === "day" && (
        <section className={sectionCardClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Day Progress</h2>
              <div className="tm-muted text-sm">{formatLongDate(selectedDay)}</div>
            </div>
            <div className="tm-muted text-sm">
              {progressCompleted} / {progressTotal} completed
            </div>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InsightMetric label="Completed Today" value={dayInsights.completedToday} />
            <InsightMetric label="Created Today" value={dayInsights.createdToday} />
            <InsightMetric label="Open Today" value={dayInsights.openToday} />
            <InsightMetric label="Rolled Over" value={dayInsights.rolledOver} />
          </div>
          <div className={`${progressTrackClass} h-3`}>
            <div
              key={selectedDay}
              className={`h-full ${progressFillClass}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium">Project Progress (Today)</h3>
            {projectProgressRows.length === 0 ? (
              <div className="mt-3 text-sm opacity-60">No project tasks for this day.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {projectProgressRows.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.label}</span>
                        {row.archived && (
                          <span className="rounded-full border border-amber-300/40 bg-amber-100/80 px-2 py-0.5 text-xs text-amber-900">
                            Archived
                          </span>
                        )}
                      </div>
                      <span className="tm-muted">
                        {row.doneCount} / {row.totalCount}
                      </span>
                    </div>
                    <div className={`${progressTrackClass} h-2`}>
                      <div
                        className={`h-full rounded-full transition-[width] ${
                          row.archived ? "bg-amber-500/60" : "tm-progress-fill"
                        }`}
                        style={{ width: `${row.progressPercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {isReportingPage && viewMode === "week" && (
        <div className="space-y-4">
          <section className={sectionCardClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Week Summary</h2>
                <div className="tm-muted text-sm">
                  {formatLongDate(weekStartValue)} to {formatLongDate(weekEndValue)}
                </div>
              </div>
              <div className="tm-muted text-right text-sm">Week starts Monday</div>
            </div>
            <div className="tm-muted mb-4 text-sm">
              Avg/day basis:{" "}
              {averageBasis === "calendar-days"
                ? `${weekInsights.basisDays} calendar days`
                : `${weekInsights.basisDays} work week days`}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InsightMetric
                label="Completed This Week"
                value={weekInsights.completedCount}
              />
              <InsightMetric
                label="Avg / Day"
                value={weekInsights.avgPerDay.toFixed(1)}
              />
              <InsightMetric
                label="Best Day"
                value={`${weekInsights.bestDay.date.toLocaleDateString(undefined, {
                  weekday: "short",
                })} (${weekInsights.bestDay.count})`}
              />
              <InsightMetric label="Backlog" value={weekInsights.backlogCount} />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <BreakdownList title="Top Projects" items={weekBreakdowns.topProjects} />
            <BreakdownList title="Top Categories" items={weekBreakdowns.topCategories} />
          </section>

          <section className={sectionCardClass}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Week</h2>
                <div className="tm-muted text-sm">
                  {formatLongDate(weekStartValue)} to {formatLongDate(weekEndValue)}
                </div>
              </div>
              <div className="tm-muted text-right text-sm">
                <div>Week starts Monday</div>
                <div className="text-xs">
                  Legend: X active • +Y new • Z due
                </div>
              </div>
            </div>
            <div className="max-w-full overflow-x-auto">
              <div className="grid min-w-[42rem] grid-cols-7 gap-3">
                {weekDays.map((day, index) => (
                  <button
                    key={day.key}
                    className={`tm-button rounded-md border p-3 text-left hover:bg-white/70 ${
                      day.openNewCount > 0
                        ? "border-emerald-300/40"
                        : day.openDueCount > 0
                          ? "border-amber-300/40"
                          : ""
                    }`}
                    type="button"
                    onClick={() => jumpToDay(day.dateValue)}
                  >
                    <div className="tm-muted text-xs uppercase tracking-wide">
                      {WEEKDAY_LABELS[index]}
                    </div>
                    <div className="mt-2 text-lg font-semibold">{day.date.getDate()}</div>
                    <div className="tm-muted mt-3 text-sm">
                      {day.openActiveCount} active
                    </div>
                    {day.openNewCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-emerald-300/40 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        +{day.openNewCount} new
                      </div>
                    )}
                    {day.openDueCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-amber-300/40 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        {day.openDueCount} due
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {isReportingPage && viewMode === "month" && (
        <div className="space-y-4">
          <section className={sectionCardClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Month Summary</h2>
                <div className="tm-muted text-sm">{formatMonthTitle(selectedDate)}</div>
              </div>
              <div className="tm-muted text-right text-sm">Week starts Monday</div>
            </div>
            <div className="tm-muted mb-4 text-sm">
              Avg/day basis:{" "}
              {averageBasis === "calendar-days"
                ? `${monthInsights.basisDays} calendar days`
                : `${monthInsights.basisDays} work week days`}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InsightMetric
                label="Completed This Month"
                value={monthInsights.completedCount}
              />
              <InsightMetric
                label="Avg / Day"
                value={monthInsights.avgPerDay.toFixed(1)}
              />
              <InsightMetric
                label="Best Week"
                value={`${monthInsights.bestWeek.start.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}-${monthInsights.bestWeek.end.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })} (${monthInsights.bestWeek.count})`}
              />
              <InsightMetric
                label="Backlog Snapshot"
                value={monthInsights.backlogSnapshotCount}
              />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <BreakdownList title="Top Projects" items={monthBreakdowns.topProjects} />
            <BreakdownList title="Top Categories" items={monthBreakdowns.topCategories} />
          </section>

          <section className={sectionCardClass}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Month</h2>
                <div className="tm-muted text-sm">{formatMonthTitle(selectedDate)}</div>
              </div>
              <div className="tm-muted text-right text-sm">
                <div>Week starts Monday</div>
                <div className="text-xs">
                  Legend: X active • +Y new • Z due
                </div>
              </div>
            </div>
            <div className="max-w-full overflow-x-auto">
              <div className="mb-3 grid min-w-[42rem] grid-cols-7 gap-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="tm-muted px-2 text-xs uppercase tracking-wide"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid min-w-[42rem] grid-cols-7 gap-2">
                {monthDays.map((day) => (
                  <button
                    key={day.key}
                    className={`rounded-md border p-3 text-left hover:bg-white/70 ${
                      day.openNewCount > 0
                        ? "border-emerald-300/40"
                        : day.openDueCount > 0
                          ? "border-amber-300/40"
                          : "border-[color:var(--tm-border)]"
                    } ${day.isCurrentMonth ? "tm-card" : "bg-white/40 opacity-60"}`}
                    type="button"
                    onClick={() => jumpToDay(day.dateValue)}
                  >
                    <div className="text-sm font-semibold">{day.date.getDate()}</div>
                    <div className="tm-muted mt-3 text-sm">
                      {day.openActiveCount} active
                    </div>
                    {day.openNewCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-emerald-300/40 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        +{day.openNewCount} new
                      </div>
                    )}
                    {day.openDueCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-amber-300/40 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        {day.openDueCount} due
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {viewMode === "day" ? (
        <section
          className={`${sectionCardClass} ${
            visibleColumns.waitingOn ? "xl:-mx-3 2xl:-mx-6" : ""
          }`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tasks</h2>
              <div className="tm-muted text-sm">
                {searchActive
                  ? `Profile-wide search anchored to ${formatLongDate(selectedDay)}`
                  : `Grouped by project for ${formatLongDate(selectedDay)}`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ProfileOptionsMenu
                taskView={taskView}
                sortMode={sortMode}
                visibleColumns={visibleColumns}
                onTaskViewChange={setTaskView}
                onSortModeChange={changeSortMode}
                onToggleColumn={toggleVisibleColumn}
              />
              <button
                className={`rounded-md border px-3 py-2 text-sm ${
                  selectMode ? "tm-button-primary" : "tm-button"
                }`}
                type="button"
                onClick={() => {
                  setSelectMode((prev) => {
                    if (prev) {
                      setSelectedTaskIds([]);
                    }

                    return !prev;
                  });
                }}
              >
                {selectMode ? "Done selecting" : "Select"}
              </button>
            </div>
          </div>

          {searchActive ? (
            <div className="tm-muted mb-4 text-sm">
              Found {searchResultCount} matching task
              {searchResultCount === 1 ? "" : "s"} across this profile.
            </div>
          ) : (
            <>
              {taskView === "done" && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <select
                    className={`${inputClass} py-1 text-sm`}
                    value={doneRange}
                    onChange={(e) => setDoneRange(e.target.value as DoneRange)}
                  >
                    {DONE_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="text-black">
                        Done: {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="tm-muted mb-4 text-sm">
                Showing {dayViewTasks.length} {TASK_VIEW_OPTIONS.find((option) => option.value === taskView)?.label.toLowerCase()} task
                {dayViewTasks.length === 1 ? "" : "s"}.
                {manualReorderEnabled ? " Drag open rows to reorder them." : ""}
              </div>
            </>
          )}

          {selectMode && selectedTaskIds.length > 0 && (
            <div className={`${cardClass} mb-4 p-3`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="tm-muted text-sm">
                    {selectedTaskIds.length} selected
                  </div>
                  <label className="tm-choice flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                    <input
                      ref={selectAllShownCheckboxRef}
                      checked={allVisibleSelected}
                      type="checkbox"
                      onChange={toggleSelectAllShown}
                    />
                    <span>Select all shown</span>
                  </label>
                  {hasRecurringSelection && (
                    <div className="text-xs text-amber-200/90">
                      Bulk done/open not available for repeating tasks
                    </div>
                  )}
                </div>
                {selectedTaskIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <SnoozeMenu
                      disabled={bulkSaving}
                      label="Snooze selected"
                      onPickDate={() =>
                        setBulkSnoozeDateValue(getSnoozeDateValue(selectedDay, "tomorrow"))
                      }
                      onSelectPreset={snoozeSelectedTasks}
                    />
                    <button
                      className={compactButtonClass}
                      disabled={bulkSaving || hasRecurringSelection}
                      type="button"
                      onClick={() =>
                        requestBulkAction({
                          action: "mark-done",
                          completedOn: selectedDay,
                        })
                      }
                    >
                      Mark done
                    </button>
                    <button
                      className={compactButtonClass}
                      disabled={bulkSaving || hasRecurringSelection}
                      type="button"
                      onClick={() => requestBulkAction({ action: "mark-open" })}
                    >
                      Mark open
                    </button>
                    <button
                      className={compactButtonClass}
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => {
                        setBulkProjectValue("");
                        setBulkProjectModalOpen(true);
                      }}
                    >
                      Move
                    </button>
                    <button
                      className={compactButtonClass}
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => {
                        setBulkCategoryValue("");
                        setBulkCategoryModalOpen(true);
                      }}
                    >
                      Set category
                    </button>
                    <button
                      className={compactButtonClass}
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => {
                        setBulkDateValue(selectedDay);
                        setBulkDateModal("startDate");
                      }}
                    >
                      Set start
                    </button>
                    <button
                      className={compactButtonClass}
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => {
                        setBulkDateValue(selectedDay);
                        setBulkDateModal("dueAt");
                      }}
                    >
                      Set due
                    </button>
                    <button
                      className={compactButtonClass}
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => requestBulkAction({ action: "clear-due-date" })}
                    >
                      Clear due
                    </button>
                    <button
                      className="tm-button-danger rounded-md border px-2.5 py-1"
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => requestBulkAction({ action: "delete" })}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-sm opacity-60">Loading tasks…</div>
          ) : searchActive ? (
            <div className="space-y-4">
              <section className={sectionCardClass}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Projects</h3>
                    <div className="tm-muted text-sm">
                      {matchingActiveProjects.length +
                        (archivedView ? matchingArchivedProjects.length : 0)}{" "}
                      result
                      {matchingActiveProjects.length +
                        (archivedView ? matchingArchivedProjects.length : 0) ===
                      1
                        ? ""
                        : "s"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-sm font-medium">Active Projects</div>
                    {matchingActiveProjects.length === 0 ? (
                      <div className="text-sm opacity-50">No matching active projects.</div>
                    ) : (
                      <div className="space-y-3">
                        {matchingActiveProjects.map((project) => (
                          <ProjectSearchRow
                            key={project.id}
                            project={project}
                            onClick={(nextProject) => void focusProjectFromSearch(nextProject)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {archivedView && (
                    <div>
                      <div className="mb-2 text-sm font-medium">
                        Archived Projects
                      </div>
                      {matchingArchivedProjects.length === 0 ? (
                        <div className="text-sm opacity-50">
                          No matching archived projects.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {matchingArchivedProjects.map((project) => (
                            <ProjectSearchRow
                              key={project.id}
                              project={project}
                              onClick={(nextProject) =>
                                void focusProjectFromSearch(nextProject)
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {displayedSearchSections.map((section) => (
                <section
                  key={section.key}
                  className={sectionCardClass}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{section.label}</h3>
                      <div className="tm-muted text-sm">
                        {section.tasks.length} result
                        {section.tasks.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  {section.tasks.length === 0 ? (
                    <div className="text-sm opacity-50">No matching tasks.</div>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-[color:var(--tm-border)]">
                      <SortableTaskHeader
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        visibleColumns={visibleColumns}
                        onSort={toggleColumnSort}
                      />
                      {section.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          projectName={
                            getTaskProjectLabel(task, projectById)
                          }
                          projectArchived={
                            task.projectId
                              ? projectById.get(task.projectId)?.archived ?? false
                              : false
                          }
                          completionPending={completionPendingTaskIds.includes(task.id)}
                          pendingAction={
                            pendingTaskActions[task.id] ??
                            (completionPendingTaskIds.includes(task.id) ? "complete" : null)
                          }
                          selectMode={selectMode}
                          selected={selectedTaskIds.includes(task.id)}
                          visibleColumns={visibleColumns}
                          currentDateValue={selectedDay}
                          editingCategoryTaskId={editingCategoryTaskId}
                          editingCategoryValue={editingCategoryValue}
                          categorySuggestions={categorySuggestions}
                          onToggleSelected={toggleTaskSelected}
                          onStartCategoryEdit={startCategoryEdit}
                          onChangeCategoryEdit={setEditingCategoryValue}
                          onCancelCategoryEdit={cancelCategoryEdit}
                          onSaveCategoryEdit={() => void saveCategoryEdit()}
                          onOpenEditModal={openTaskEditor}
                          onToggleCompleted={(nextTask, completed) =>
                            void toggleTaskCompleted(nextTask.id, completed).catch(
                              (err: unknown) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not update task"
                                )
                            )
                          }
                          onSnoozePreset={snoozeTask}
                          onPickSnoozeDate={openSingleTaskSnoozeDate}
                          onTogglePriority={toggleTaskPriority}
                          onToggleRepeatPause={requestToggleRepeatPause}
                          onDelegate={openDelegateTask}
                          showSnoozeAction={!isTaskCompleted(task)}
                          snoozeDisabled={bulkSaving}
                          onDelete={requestDeleteTask}
                          onContextMenu={(event) =>
                            openTaskContextMenu(event, task, {
                              showSnoozeAction: !isTaskCompleted(task),
                              toggleCompletedTo: !isTaskCompleted(task),
                              pauseReferenceDate: selectedDay,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {searchSections.every((section) => section.tasks.length === 0) && (
                <div className="text-sm opacity-60">No matching tasks in this profile.</div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleGroupedSections.length === 0 && (
                <div className="text-sm opacity-60">No matching tasks for this view.</div>
              )}
              {visibleGroupedSections.map((section) => {
                const routineAffirmation =
                  routineSupportEnabled && section.project
                    ? getRoutineAffirmation(section.project.name)
                    : null;
                const routineStreak =
                  routineAffirmation && section.project
                    ? getRoutineStreak(tasks, section.project.id, todayInputValue())
                    : null;
                const subtitle = section.project
                  ? [
                      section.project.category ? `Category ${section.project.category}` : null,
                      `Start ${toDateOnly(section.project.startDate)}`,
                      section.project.dueAt ? `Due ${toDateOnly(section.project.dueAt)}` : null,
                      section.project.isPriority ? "Priority" : null,
                      section.project.archived ? "Archived" : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")
                  : "Tasks with no project";
                const projectDragPosition =
                  section.project && dragOverProjectId === section.project.id
                    ? dragOverProjectPosition
                    : null;

                return (
                  <section
                    key={section.key}
                    id={section.project ? `project-${section.project.id}` : undefined}
                    className={`rounded-md border px-3 py-2 ${
                      section.project?.archived
                        ? "border-amber-300/20 bg-amber-200/5"
                        : "border-[color:var(--tm-border)] bg-white/25"
                    } ${section.project ? "cursor-grab active:cursor-grabbing" : ""} ${
                      draggedProjectId === section.project?.id ? "opacity-60" : ""
                    } ${
                      projectDragPosition === "before"
                        ? "ring-2 ring-inset ring-[color:var(--tm-text)]"
                        : projectDragPosition === "after"
                          ? "ring-2 ring-[color:var(--tm-text)] ring-offset-2 ring-offset-[color:var(--tm-bg)]"
                          : ""
                    }`}
                    draggable={Boolean(section.project)}
                    onDragStart={
                      section.project
                        ? (event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", section.project.id);
                            setDraggedProjectId(section.project.id);
                            setDragOverProjectId(null);
                            setDragOverProjectPosition(null);
                          }
                        : undefined
                    }
                    onDragEnd={section.project ? finishProjectDragState : undefined}
                    onDragOver={
                      section.project
                        ? (event) => {
                            if (draggedProjectId === section.project?.id) return;

                            event.preventDefault();
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const position =
                              event.clientY >= bounds.top + bounds.height / 2
                                ? "after"
                                : "before";
                            setDragOverProjectId(section.project.id);
                            setDragOverProjectPosition(position);
                          }
                        : undefined
                    }
                    onDrop={
                      section.project
                        ? (event) => {
                            event.preventDefault();
                            void handleProjectDrop(
                              section.project.id,
                              dragOverProjectId === section.project.id &&
                                dragOverProjectPosition === "after"
                                ? "after"
                                : "before"
                            );
                          }
                        : undefined
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--tm-border)] pb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium">{section.label}</h3>
                          {section.project?.isPriority && (
                            <span className={priorityChipClass}>
                              Priority
                            </span>
                          )}
                          {section.project?.archived && (
                            <span className="rounded-full border border-amber-300/40 bg-amber-100/80 px-2 py-0.5 text-xs text-amber-900">
                              Archived
                            </span>
                          )}
                          <span className={`${smallChipClass} opacity-100`}>
                            {section.openTasks.length}
                          </span>
                        </div>
                        {routineAffirmation && (
                          <div className="tm-routine-support mt-2 rounded-[10px] border px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="tm-routine-support-label text-[10px] font-semibold uppercase leading-none">
                                Routine note
                              </span>
                              <span
                                className="tm-routine-support-streak shrink-0 border-l pl-2 text-[11px] font-medium leading-none"
                                aria-label={
                                  routineStreak
                                    ? `${routineStreak} day routine streak`
                                    : "Routine streak ready to begin"
                                }
                              >
                                {routineStreak
                                  ? `🔥 ${routineStreak} day streak`
                                  : "🌱 A fresh start"}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm italic leading-5 text-[color:var(--tm-text)]/80">
                              {routineAffirmation}
                            </p>
                          </div>
                        )}
                        <div className="tm-muted mt-1 text-xs">{subtitle}</div>
                        {section.project && (
                          <div className="mt-2 max-w-md">
                            <div className="tm-muted mb-2 flex items-center justify-between text-xs">
                              <span>Day progress</span>
                              <span>
                                {section.progressCompleted} / {section.progressTotal}
                              </span>
                            </div>
                            <div className={`${progressTrackClass} h-2`}>
                              <div
                                className={`h-full rounded-full transition-[width] ${
                                  section.project.archived ? "bg-amber-500/60" : "tm-progress-fill"
                                }`}
                                style={{
                                  width:
                                    section.progressTotal === 0
                                      ? "0%"
                                      : `${Math.round(
                                          (section.progressCompleted / section.progressTotal) *
                                            100
                                        )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {section.project && (
                          <>
                            <button
                              className={buttonClass}
                              type="button"
                              onClick={() => openProjectEditor(section.project)}
                            >
                              Edit
                            </button>
                            <button
                              className={buttonClass}
                              type="button"
                              onClick={() => void toggleProjectPriority(section.project)}
                            >
                              {section.project.isPriority ? "Unprioritise" : "Prioritise"}
                            </button>
                            <button
                              className={buttonClass}
                              type="button"
                              onClick={() => void toggleProjectCollapsed(section.project)}
                            >
                              {section.project.collapsed ? "Expand" : "Collapse"}
                            </button>
                            <button
                              className={buttonClass}
                              type="button"
                              onClick={() => void toggleProjectArchived(section.project)}
                            >
                              {section.project.archived ? "Restore" : "Archive"}
                            </button>
                            <button
                              className="tm-button-danger inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm"
                              type="button"
                              onClick={() => setDeleteProjectModalProject(section.project)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!section.collapsed && (
                      <div className="mt-2 space-y-3">
                        <div>
                          <div className="overflow-hidden rounded-md border border-[color:var(--tm-border)]">
                            <SortableTaskHeader
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              visibleColumns={visibleColumns}
                              onSort={toggleColumnSort}
                            />
                            {section.openTasks.map((task) => (
                              <TaskRow
                                  key={task.id}
                                  task={task}
                                  draggable={manualReorderEnabled}
                                  dragActive={draggedTaskId === task.id}
                                  dragOverPosition={
                                    dragOverTaskId === task.id ? dragOverPosition : null
                                  }
                                  completionPending={completionPendingTaskIds.includes(
                                    task.id
                                  )}
                                  pendingAction={
                                    pendingTaskActions[task.id] ??
                                    (completionPendingTaskIds.includes(task.id)
                                      ? "complete"
                                      : null)
                                  }
                                  selectMode={selectMode}
                                  selected={selectedTaskIds.includes(task.id)}
                                  visibleColumns={visibleColumns}
                                  currentDateValue={selectedDay}
                                  editingCategoryTaskId={editingCategoryTaskId}
                                  editingCategoryValue={editingCategoryValue}
                                  categorySuggestions={categorySuggestions}
                                  onToggleSelected={toggleTaskSelected}
                                  onStartCategoryEdit={startCategoryEdit}
                                  onChangeCategoryEdit={setEditingCategoryValue}
                                  onCancelCategoryEdit={cancelCategoryEdit}
                                  onSaveCategoryEdit={() => void saveCategoryEdit()}
                                  onOpenEditModal={openTaskEditor}
                                  onToggleCompleted={(nextTask, completed) =>
                                    void toggleTaskCompleted(nextTask.id, completed).catch(
                                      (err: unknown) =>
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : "Could not update task"
                                        )
                                    )
                                  }
                                  onSnoozePreset={snoozeTask}
                                  onPickSnoozeDate={openSingleTaskSnoozeDate}
                                  onTogglePriority={toggleTaskPriority}
                                  onToggleRepeatPause={requestToggleRepeatPause}
                                  onDelegate={openDelegateTask}
                                  showSnoozeAction
                                  snoozeDisabled={bulkSaving}
                                  onDelete={requestDeleteTask}
                                  onContextMenu={(event) =>
                                    openTaskContextMenu(event, task, {
                                      showSnoozeAction: true,
                                      toggleCompletedTo: !isTaskCompleted(task),
                                      pauseReferenceDate: selectedDay,
                                    })
                                  }
                                  onDragStart={(event) => {
                                    event.stopPropagation();
                                    if (!manualReorderEnabled) return;
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", task.id);
                                    setDraggedTaskId(task.id);
                                    setDragOverTaskId(null);
                                    setDragOverPosition(null);
                                  }}
                                  onDragEnd={finishDragState}
                                  onDragOver={(event) => {
                                    event.stopPropagation();
                                    if (!manualReorderEnabled || draggedTaskId === task.id) {
                                      return;
                                    }

                                    event.preventDefault();
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    const position =
                                      event.clientY >= bounds.top + bounds.height / 2
                                        ? "after"
                                        : "before";
                                    setDragOverTaskId(task.id);
                                    setDragOverPosition(position);
                                  }}
                                  onDrop={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    void handleTaskDrop(
                                      task.id,
                                      dragOverTaskId === task.id && dragOverPosition === "after"
                                        ? "after"
                                        : "before"
                                    );
                                  }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
              {visibleGroupedSections.length === 0 && (
                <div className="text-sm opacity-60">No matching tasks for this day.</div>
              )}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          <section
            className={`${sectionCardClass} ${
              visibleColumns.waitingOn ? "xl:-mx-3 2xl:-mx-6" : ""
            }`}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--tm-border)] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">
                    {TASK_VIEW_OPTIONS.find((option) => option.value === taskView)?.label ?? "Open"}
                  </h2>
                  <span className="tm-muted text-sm">
                    {matrixTasks.length} task{matrixTasks.length === 1 ? "" : "s"} for{" "}
                    {nonDayOpenListLabel}
                  </span>
                </div>
                {taskView === "today" && (
                  <div className="tm-muted mt-1 text-xs">
                    Today includes tasks that start today or are due today.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ProfileOptionsMenu
                  taskView={taskView}
                  sortMode={sortMode}
                  visibleColumns={visibleColumns}
                  onTaskViewChange={setTaskView}
                  onSortModeChange={changeSortMode}
                  onToggleColumn={toggleVisibleColumn}
                />
                <label className="flex items-center gap-2 text-sm">
                  <span className="tm-muted">Average basis</span>
                  <select
                    className={`${inputClass} min-w-[10rem]`}
                    value={averageBasis}
                    onChange={(e) => setAverageBasis(e.target.value as AverageBasis)}
                  >
                    {AVERAGE_BASIS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="text-black">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {taskView === "done" && (
                  <label className="flex items-center gap-2 text-sm">
                    <span className="tm-muted">Range</span>
                    <select
                      className={`${inputClass} min-w-[10rem]`}
                      value={doneRange}
                      onChange={(e) => setDoneRange(e.target.value as DoneRange)}
                    >
                      {DONE_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="text-black">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-sm opacity-60">Loading tasks…</div>
            ) : matrixTasks.length === 0 ? (
              <div className="text-sm opacity-60">No matching tasks.</div>
            ) : (
              <div className="relative max-h-[520px] max-w-full overflow-y-auto overflow-x-auto">
                <table
                  className={`table-fixed border-separate border-spacing-0 text-sm ${
                    visibleColumns.waitingOn ? "min-w-[62rem]" : "min-w-[50rem]"
                  }`}
                >
                  <thead>
                    <tr>
                      <SortableTaskTableHeaderCell
                        className={`${matrixHeaderCellClass} w-[34%]`}
                        label="Title"
                        sortColumn="title"
                        sortDirection={sortColumn === "title" ? sortDirection : null}
                        onSort={toggleColumnSort}
                      />
                      <th className={`${matrixHeaderCellClass} w-[14%]`}>Project</th>
                      {visibleColumns.category && (
                        <SortableTaskTableHeaderCell
                          className={`${matrixHeaderCellClass} w-[14%]`}
                          label="Category"
                          sortColumn="category"
                          sortDirection={sortColumn === "category" ? sortDirection : null}
                          onSort={toggleColumnSort}
                        />
                      )}
                      {visibleColumns.due && (
                        <SortableTaskTableHeaderCell
                          className={`${matrixHeaderCellClass} w-[120px]`}
                          label="Due"
                          sortColumn="due"
                          sortDirection={sortColumn === "due" ? sortDirection : null}
                          onSort={toggleColumnSort}
                        />
                      )}
                      {visibleColumns.waitingOn && (
                        <th className={`${matrixHeaderCellClass} w-[150px]`}>Waiting On</th>
                      )}
                      <th className={`${matrixHeaderCellClass} w-[120px]`}>Start</th>
                      <th className={`${matrixHeaderCellClass} w-[72px] text-center`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixTasks.map((task) => {
                      const pendingAction =
                        pendingTaskActions[task.id] ??
                        (completionPendingTaskIds.includes(task.id) ? "complete" : null);
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
                      const waitingOnValues = getLatestWaitingOnValues(task);
                      const taskOverdue = isTaskOverdue(task, selectedDay);

                      return (
                      <tr
                        key={task.id}
                        className={`tm-table-row border-t border-l-4 border-l-transparent align-top ${
                          task.isPriority
                            ? "bg-[rgba(243,225,220,0.82)] shadow-[inset_4px_0_0_0_rgba(183,122,116,0.78)]"
                            : ""
                        } ${
                          task.delegatedTask ? "border-l-sky-200/70" : ""
                        } ${
                          pendingAction === "complete"
                            ? "bg-emerald-50/80 opacity-75 ring-2 ring-inset ring-emerald-200"
                            : pendingAction === "delete"
                              ? "bg-red-50/70 opacity-75 ring-2 ring-inset ring-red-200"
                              : pendingAction
                                ? "bg-slate-100/80 opacity-75 ring-2 ring-inset ring-slate-200"
                                : ""
                        }`}
                        onContextMenu={(event) =>
                          openTaskContextMenu(event, task, {
                            showSnoozeAction: true,
                            completedActionLabel: taskView === "done" ? "Open" : "Done",
                            toggleCompletedTo: taskView !== "done",
                            pauseReferenceDate: selectedDay,
                          })
                        }
                      >
                        <td className={matrixCellClass}>
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              {task.delegatedTask ? (
                                <DelegatedSenderBadge
                                  sender={task.delegatedTask.assignedByUser}
                                />
                              ) : null}
                              <button
                                className={`${taskTitleButtonClass} font-semibold`}
                                type="button"
                                onClick={() => openTaskEditor(task)}
                              >
                                <span
                                  className={`block truncate ${
                                    pendingAction === "complete" ? "line-through opacity-70" : ""
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </button>
                              {pendingAction === "complete" && (
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">
                                  ✓
                                </span>
                              )}
                              {pendingLabel && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                  {pendingLabel}
                                </span>
                              )}
                              {hasTaskNotes(task) && (
                                <TaskNotesButton notes={formatTaskNotesPreview(task)} />
                              )}
                            </div>
                            <div className="tm-muted mt-1 flex flex-wrap gap-1.5 text-[11px]">
                              {task.delegatedTask ? (
                                <DelegatedTaskStatusPill status={task.delegatedTask.status} />
                              ) : null}
                              {showStartChipInTables && (
                                <span className={smallChipClass}>
                                  Start {formatShortDate(toDateOnly(task.startDate))}
                                </span>
                              )}
                              {task.isPriority && (
                                <span className={priorityChipClass}>
                                  Priority
                                </span>
                              )}
                              {getRepeatPauseBadge(task, selectedDay) && (
                                <span className="rounded-full border border-slate-300/70 bg-slate-100/80 px-2 py-0.5 text-slate-700">
                                  {getRepeatPauseBadge(task, selectedDay)}
                                </span>
                              )}
                              {task.projectId && projectById.get(task.projectId)?.archived && (
                                <span className="rounded-full border border-amber-300/40 bg-amber-100/80 px-2 py-0.5 text-amber-900">
                                  Archived
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`${matrixCellClass} tm-muted`}>
                          {getTaskProjectLabel(task, projectById)}
                        </td>
                        {visibleColumns.category && (
                          <td className={`${matrixCellClass} tm-muted`}>
                            {task.category ?? "—"}
                          </td>
                        )}
                        {visibleColumns.due && (
                          <td className={matrixCellClass}>
                            <div className="flex items-center gap-1.5">
                              <span className={taskOverdue ? "font-medium text-red-700" : ""}>
                                {toDateOnly(task.dueAt) || "—"}
                              </span>
                              {taskOverdue && <span className={overdueChipClass}>OD</span>}
                            </div>
                          </td>
                        )}
                        {visibleColumns.waitingOn && (
                          <td className={matrixCellClass}>
                            <WaitingOnPills values={waitingOnValues} />
                          </td>
                        )}
                        <td className={matrixCellClass}>{toDateOnly(task.startDate)}</td>
                        <td className={`${matrixCellClass} text-center`}>
                          <TaskActionMenu
                            task={task}
                            completionPending={completionPendingTaskIds.includes(task.id)}
                            pendingAction={pendingAction}
                            completedActionLabel={taskView === "done" ? "Open" : "Done"}
                            onPickSnoozeDate={openSingleTaskSnoozeDate}
                            onTogglePriority={(selectedTask) => void toggleTaskPriority(selectedTask)}
                            onToggleRepeatPause={requestToggleRepeatPause}
                            onOpenEditModal={openTaskEditor}
                            onToggleCompleted={(selectedTask) =>
                              void toggleTaskCompleted(selectedTask.id, taskView !== "done").catch(
                                (err: unknown) =>
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Could not update task"
                                  )
                              )
                            }
                            onDelegate={openDelegateTask}
                            onDelete={requestDeleteTask}
                            pauseReferenceDate={selectedDay}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}

      {taskContextMenu &&
        typeof document !== "undefined" &&
        (() => {
          const contextTask =
            tasks.find((task) => task.id === taskContextMenu.taskId) ?? null;
          if (!contextTask) return null;

          const menuWidth = 176;
          const gutter = 12;
          const estimatedMenuHeight = taskContextMenu.showSnoozeAction ? 260 : 220;
          const maxHeight = Math.min(
            estimatedMenuHeight,
            Math.max(120, window.innerHeight - gutter * 2)
          );
          const left = Math.min(
            Math.max(gutter, taskContextMenu.x),
            Math.max(gutter, window.innerWidth - menuWidth - gutter)
          );
          const top = Math.min(
            Math.max(gutter, taskContextMenu.y),
            Math.max(gutter, window.innerHeight - maxHeight - gutter)
          );
          const pendingAction =
            pendingTaskActions[contextTask.id] ??
            (completionPendingTaskIds.includes(contextTask.id) ? "complete" : null);

          return createPortal(
            <div
              className="tm-menu fixed z-[1000] min-w-44 overflow-hidden rounded-lg border py-1 text-left shadow-2xl"
              role="menu"
              style={{ left, top, maxHeight, overflowY: "auto" }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <TaskActionMenuItems
                task={contextTask}
                completionPending={completionPendingTaskIds.includes(contextTask.id)}
                pendingAction={pendingAction}
                snoozeDisabled={bulkSaving}
                showSnoozeAction={taskContextMenu.showSnoozeAction}
                completedActionLabel={taskContextMenu.completedActionLabel}
                pauseReferenceDate={taskContextMenu.pauseReferenceDate}
                onClose={() => setTaskContextMenu(null)}
                onPickSnoozeDate={openSingleTaskSnoozeDate}
                onTogglePriority={toggleTaskPriority}
                onToggleRepeatPause={requestToggleRepeatPause}
                onOpenEditModal={openTaskEditor}
                onToggleCompleted={(selectedTask) =>
                  void toggleTaskCompleted(
                    selectedTask.id,
                    taskContextMenu.toggleCompletedTo ?? !isTaskCompleted(selectedTask)
                  ).catch((err: unknown) =>
                    setError(
                      err instanceof Error ? err.message : "Could not update task"
                    )
                  )
                }
                onDelegate={openDelegateTask}
                onDelete={requestDeleteTask}
              />
            </div>,
            document.body
          );
        })()}

      <AddTaskModal
        open={newTaskOpen}
        form={form}
        saving={saving}
        categorySuggestions={categorySuggestions}
        waitingOnSuggestions={waitingOnSuggestions}
        projectOptions={newTaskProjectOptions}
        topActionLabel="+ Project"
        onTopAction={() => setNewProjectOpen(true)}
        onClose={closeNewTaskDialog}
        onSubmit={createTask}
        onFormChange={(updater) => setForm((prev) => updater(prev))}
      />

      <Modal
        open={Boolean(bulkScopeAction)}
        title="Recurring bulk action"
        onClose={() => {
          if (bulkSaving) return;
          setBulkScopeAction(null);
          setBulkActionScope("this");
        }}
      >
        {bulkScopeAction && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void executeBulkAction({
                ...bulkScopeAction,
                scope: bulkActionScope,
              }).catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not run bulk action")
              );
            }}
          >
            <div className="tm-muted text-sm">
              Recurring tasks are selected. Choose how broadly this action should apply.
            </div>
            <div className="space-y-2">
              <label className={modalChoiceClass}>
                <input
                  checked={bulkActionScope === "this"}
                  disabled={bulkSaving}
                  name="bulk-scope"
                  type="radio"
                  value="this"
                  onChange={() => setBulkActionScope("this")}
                />
                <div className="font-medium">This task only</div>
              </label>
              <label className={modalChoiceClass}>
                <input
                  checked={bulkActionScope === "future"}
                  disabled={bulkSaving}
                  name="bulk-scope"
                  type="radio"
                  value="future"
                  onChange={() => setBulkActionScope("future")}
                />
                <div className="font-medium">This and future</div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-300/50 bg-red-50 p-3">
                <input
                  checked={bulkActionScope === "series"}
                  disabled={bulkSaving}
                  name="bulk-scope"
                  type="radio"
                  value="series"
                  onChange={() => setBulkActionScope("series")}
                />
                <div className="font-medium text-red-700">Entire series</div>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className={buttonClass}
                disabled={bulkSaving}
                type="button"
                onClick={() => {
                  setBulkScopeAction(null);
                  setBulkActionScope("this");
                }}
              >
                Cancel
              </button>
              <button
                className={`${primaryButtonClass} px-4 disabled:opacity-50`}
                disabled={bulkSaving}
                type="submit"
              >
                Continue
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(singleSnoozeTask)}
        title="Snooze task"
        onClose={() => {
          if (bulkSaving) return;
          setSingleSnoozeTask(null);
          setSingleSnoozeDateValue("");
        }}
      >
        {singleSnoozeTask && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void executeBulkAction({
                action: "set-start-date",
                taskIds: [singleSnoozeTask.id],
                scope: "this",
                startDate: singleSnoozeDateValue,
              }).catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not snooze task")
              );
            }}
          >
            <DateInput
              autoFocus
              className={`w-full ${inputClass}`}
              required
              value={singleSnoozeDateValue}
              onChange={(e) => setSingleSnoozeDateValue(e.target.value)}
            />
            <button
              className={`${primaryButtonClass} px-4 disabled:opacity-50`}
              disabled={bulkSaving}
              type="submit"
            >
              Apply
            </button>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(repeatPauseTask)}
        title="Pause Repeat"
        onClose={() => {
          if (bulkSaving) return;
          closeRepeatPauseModal();
        }}
      >
        {repeatPauseTask && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void pauseRepeatTask().catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not pause repeat")
              );
            }}
          >
            <div className="space-y-2">
              {REPEAT_PAUSE_PRESET_OPTIONS.map((option) => (
                <label key={option.value} className={modalChoiceClass}>
                  <input
                    checked={repeatPausePreset === option.value}
                    name="repeat-pause-preset"
                    type="radio"
                    value={option.value}
                    onChange={() => {
                      setRepeatPausePreset(option.value);
                      if (option.value === "tomorrow" || option.value === "next-week") {
                        setRepeatPauseUntilValue(
                          getRepeatPauseUntilForPreset(selectedDay, option.value)
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
                <DateInput
                  autoFocus
                  className={`w-full ${inputClass}`}
                  required
                  value={repeatPauseUntilValue}
                  onChange={(e) => setRepeatPauseUntilValue(e.target.value)}
                />
              </label>
            )}
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Note</div>
              <input
                className={`w-full ${inputClass}`}
                placeholder="Optional reason"
                value={repeatPauseNoteValue}
                onChange={(e) => setRepeatPauseNoteValue(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                className={buttonClass}
                type="button"
                onClick={closeRepeatPauseModal}
              >
                Cancel
              </button>
              <button className={`${primaryButtonClass} px-4`} type="submit">
                Pause Repeat
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={bulkSnoozeDateValue !== ""}
        title="Snooze selected tasks"
        onClose={() => {
          if (bulkSaving) return;
          setBulkSnoozeDateValue("");
        }}
      >
        {bulkSnoozeDateValue !== "" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setBulkSnoozeDateValue("");
              requestBulkAction({
                action: "set-start-date",
                startDate: bulkSnoozeDateValue,
              });
            }}
          >
            <DateInput
              autoFocus
              className={`w-full ${inputClass}`}
              required
              value={bulkSnoozeDateValue}
              onChange={(e) => setBulkSnoozeDateValue(e.target.value)}
            />
            <button
              className={`${primaryButtonClass} px-4 disabled:opacity-50`}
              disabled={bulkSaving}
              type="submit"
            >
              Apply
            </button>
          </form>
        )}
      </Modal>

      <Modal
        open={bulkProjectModalOpen}
        title="Move tasks to project"
        onClose={() => {
          if (bulkSaving) return;
          setBulkProjectModalOpen(false);
          setBulkProjectValue("");
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBulkProjectModalOpen(false);
            requestBulkAction({
              action: "move-project",
              projectId: bulkProjectValue || null,
            });
          }}
        >
          <label className="space-y-1 text-sm">
            <div className="tm-muted">Project</div>
            <select
              className={`w-full ${inputClass}`}
              value={bulkProjectValue}
              onChange={(e) => setBulkProjectValue(e.target.value)}
            >
              <option value="" className="text-black">
                Unassigned
              </option>
              {assignableProjects.map((project) => (
                <option key={project.id} value={project.id} className="text-black">
                  {project.name}
                  {project.archived ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`${primaryButtonClass} px-4 disabled:opacity-50`}
            disabled={bulkSaving}
            type="submit"
          >
            Apply
          </button>
        </form>
      </Modal>

      <Modal
        open={bulkCategoryModalOpen}
        title="Set task category"
        onClose={() => {
          if (bulkSaving) return;
          setBulkCategoryModalOpen(false);
          setBulkCategoryValue("");
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBulkCategoryModalOpen(false);
            requestBulkAction({
              action: "set-category",
              category: bulkCategoryValue.trim() || null,
            });
          }}
        >
          <CategoryCombobox
            autoFocus
            className={`w-full ${inputClass}`}
            placeholder="Category"
            suggestions={categorySuggestions}
            value={bulkCategoryValue}
            onChange={setBulkCategoryValue}
          />
          <button
            className={`${primaryButtonClass} px-4 disabled:opacity-50`}
            disabled={bulkSaving}
            type="submit"
          >
            Apply
          </button>
        </form>
      </Modal>

      <Modal
        open={bulkDateModal !== null}
        title={bulkDateModal === "startDate" ? "Set start date" : "Set due date"}
        onClose={() => {
          if (bulkSaving) return;
          setBulkDateModal(null);
          setBulkDateValue("");
        }}
      >
        {bulkDateModal && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setBulkDateModal(null);
              requestBulkAction(
                bulkDateModal === "startDate"
                  ? {
                      action: "set-start-date",
                      startDate: bulkDateValue,
                    }
                  : {
                      action: "set-due-date",
                      dueAt: bulkDateValue,
                    }
              );
            }}
          >
            <DateInput
              autoFocus
              className={`w-full ${inputClass}`}
              required
              value={bulkDateValue}
              onChange={(e) => setBulkDateValue(e.target.value)}
            />
            <button
              className={`${primaryButtonClass} px-4 disabled:opacity-50`}
              disabled={bulkSaving}
              type="submit"
            >
              Apply
            </button>
          </form>
        )}
      </Modal>

      <TaskDeleteConfirmationModal
        open={Boolean(deleteTaskModalTask)}
        taskTitle={deleteTaskModalTask?.title ?? ""}
        recurring={Boolean(deleteTaskModalTask?.recurrenceSeriesId)}
        mode={deleteTaskMode}
        saving={deleteTaskSaving}
        modeName="delete-mode"
        onModeChange={setDeleteTaskMode}
        onCancel={() => {
          setDeleteTaskModalTask(null);
          setDeleteTaskMode("this");
        }}
        onConfirm={(mode) => {
          if (!deleteTaskModalTask) return;
          void deleteTask(deleteTaskModalTask, mode).catch((err: unknown) =>
            setError(err instanceof Error ? err.message : "Could not delete task")
          );
        }}
      />

      <Modal
        open={newProjectOpen}
        title="New Project"
        onClose={() => {
          setNewProjectOpen(false);
          setNewProjectForm(createEmptyProjectForm());
        }}
      >
        <form className="space-y-3" onSubmit={createProject}>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Project name"
            value={newProjectForm.name}
            onChange={(e) =>
              setNewProjectForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <DateInput
              className={inputClass}
              value={newProjectForm.startDate}
              onChange={(e) =>
                setNewProjectForm((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
            <DateInput
              className={inputClass}
              value={newProjectForm.dueAt}
              onChange={(e) =>
                setNewProjectForm((prev) => ({ ...prev, dueAt: e.target.value }))
              }
            />
          </div>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Category"
            value={newProjectForm.category}
            onChange={(e) =>
              setNewProjectForm((prev) => ({ ...prev, category: e.target.value }))
            }
          />
          <button
            className={`${primaryButtonClass} px-4 disabled:opacity-50`}
            disabled={newProjectSaving}
            type="submit"
          >
            Save Project
          </button>
        </form>
      </Modal>

      <ProjectEditorModal
        open={Boolean(editProjectId && editProjectForm)}
        form={editProjectForm}
        saving={editProjectSaving}
        title="Edit Project"
        submitLabel={editProjectSaving ? "Saving..." : "Save Project"}
        onClose={closeProjectEditor}
        onSubmit={submitProjectEditor}
        onFormChange={(updater) =>
          setEditProjectForm((prev) => (prev ? updater(prev) : prev))
        }
      />

      <Modal
        open={Boolean(deleteProjectModalProject)}
        title="Delete Project"
        onClose={() => setDeleteProjectModalProject(null)}
      >
        {deleteProjectModalProject && (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--tm-muted)]">
              Delete project <span className="font-medium text-[color:var(--tm-text)]">
                {deleteProjectModalProject.name}
              </span>
              ? Tasks assigned to this project will remain in this profile and become
              unassigned.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className={buttonClass}
                disabled={deleteProjectSaving}
                type="button"
                onClick={() => setDeleteProjectModalProject(null)}
              >
                Cancel
              </button>
              <button
                className="tm-button-danger inline-flex h-10 items-center justify-center rounded-[10px] border px-4 text-sm disabled:opacity-50"
                disabled={deleteProjectSaving}
                type="button"
                onClick={() =>
                  void deleteProject(deleteProjectModalProject).catch((err: unknown) =>
                    setError(
                      err instanceof Error ? err.message : "Could not delete project"
                    )
                  )
                }
              >
                {deleteProjectSaving ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        )}
      </Modal>

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
    </section>
  );
}
