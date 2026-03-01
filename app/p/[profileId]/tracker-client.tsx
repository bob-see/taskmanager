"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
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
  projectId: string | null;
  recurrenceSeriesId: string | null;
  repeatEnabled: boolean;
  repeatPattern: RepeatPattern | null;
  repeatDays: number | null;
  repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  startDate: string;
  dueAt: string | null;
  category: string | null;
  archived: boolean;
  collapsed: boolean;
  createdAt: string;
};

type TrackerClientProps = {
  pageMode: "tracker" | "reporting";
  profileId: string;
  profileName: string;
};

type RepeatPattern = "daily" | "weekly" | "monthly";

type RepeatFormState = {
  repeatEnabled: boolean;
  repeatPattern: RepeatPattern;
  repeatDays: number;
  repeatWeeklyDay: number;
  repeatMonthlyDay: number;
};

type TaskFormState = RepeatFormState & {
  title: string;
  startDate: string;
  dueAt: string;
  category: string;
  projectId: string;
};

type ProjectFormState = {
  name: string;
  startDate: string;
  dueAt: string;
  category: string;
};

type EditTaskFormState = RepeatFormState & {
  title: string;
  startDate: string;
  dueAt: string;
  category: string;
  notes: string;
  projectId: string;
};

type ViewMode = "day" | "week" | "month";
type OpenFilter = "all-active" | "today" | "upcoming" | "overdue";
type DoneRange = "today" | "week" | "month" | "all";
type DeleteMode = "this" | "future" | "series";
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

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];
const VALID_VIEW_MODES = new Set<ViewMode>(["day", "week", "month"]);

const OPEN_FILTER_OPTIONS: Array<{ value: OpenFilter; label: string }> = [
  { value: "all-active", label: "All Active" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
];

const DONE_RANGE_OPTIONS: Array<{ value: DoneRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All" },
];
const AVERAGE_BASIS_OPTIONS: Array<{ value: AverageBasis; label: string }> = [
  { value: "calendar-days", label: "Calendar days" },
  { value: "work-week", label: "Work week" },
];
const VALID_AVERAGE_BASES = new Set<AverageBasis>(["calendar-days", "work-week"]);
const PREFERENCE_SAVE_DEBOUNCE_MS = 400;
const DATE_ONLY_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_TOGGLE_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const REPEAT_PATTERN_OPTIONS: Array<{ value: RepeatPattern; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const ALL_REPEAT_DAYS_MASK = 0b1111111;
const SNOOZE_PRESET_OPTIONS: Array<{ value: SnoozePreset; label: string }> = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next-business-day", label: "Next business day" },
  { value: "next-week", label: "Next week (+7 days)" },
];
const cardClass = "tm-card rounded-[12px] border shadow-sm";
const sectionCardClass = `${cardClass} p-4`;
const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";
const primaryButtonClass =
  "tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";
const compactButtonClass =
  "tm-button inline-flex h-8 items-center justify-center rounded-[10px] border px-2.5 text-sm";
const chipClass = "tm-chip rounded-full border px-2 py-0.5";
const smallChipClass = "tm-chip rounded-full border px-2 py-0.5 text-xs";
const tabSetClass = "tm-tabset inline-flex rounded-md border p-1 text-sm";
const tabClass = "tm-tab rounded px-3 py-1";
const activeTabClass = "tm-tab-active rounded px-3 py-1";
const segmentedTabSetClass = "tm-tabset inline-flex rounded-full border p-1 text-sm";
const segmentedTabClass = "tm-tab rounded-full px-3 py-1.5";
const segmentedActiveTabClass = "tm-tab-active rounded-full px-3 py-1.5";
const progressTrackClass = "tm-progress-track overflow-hidden rounded-full";
const progressFillClass = "tm-progress-fill rounded-full transition-[width]";
const modalChoiceClass = "tm-choice flex cursor-pointer items-start gap-3 rounded-lg border p-3";
const commandBarClass =
  "sticky top-0 z-40 -mx-4 border-b border-[color:var(--tm-border)] bg-[color:var(--tm-bg)]/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6";
const matrixHeaderCellClass =
  "sticky top-0 z-10 border-b border-[color:var(--tm-border)] bg-[color:var(--tm-card)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tm-muted)]";
const matrixCellClass = "px-3 py-2.5 align-top";
const iconButtonClass =
  "tm-button inline-flex h-8 w-8 items-center justify-center rounded-[10px] border text-sm";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInputValue() {
  return dateInputValue(new Date());
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

function isSameDateValue(value: string | null, dateValue: string) {
  return toDateOnly(value) === dateValue;
}

function createRepeatDefaults(dateValue: string): RepeatFormState {
  const repeatWeeklyDay = getWeekdayNumber(dateValue);

  return {
    repeatEnabled: false,
    repeatPattern: "daily",
    repeatDays: ALL_REPEAT_DAYS_MASK,
    repeatWeeklyDay,
    repeatMonthlyDay: getDayOfMonth(dateValue),
  };
}

function getRepeatSummary(task: Task) {
  if (!task.repeatEnabled || !task.repeatPattern) return null;

  if (task.repeatPattern === "daily") {
    return `Repeats ${formatRepeatDays(task.repeatDays ?? ALL_REPEAT_DAYS_MASK)}`;
  }

  if (task.repeatPattern === "weekly") {
    return `Repeats weekly on ${WEEKDAY_LABELS[(task.repeatWeeklyDay ?? 1) - 1]}`;
  }

  return `Repeats monthly on day ${task.repeatMonthlyDay ?? 1}`;
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

function getStartOfMonthGrid(date: Date) {
  return startOfWeekMon(new Date(date.getFullYear(), date.getMonth(), 1));
}

function getEndOfMonthGrid(date: Date) {
  return addDays(startOfWeekMon(new Date(date.getFullYear(), date.getMonth() + 1, 0)), 6);
}

function isTaskActiveOnDate(task: Task, dateValue: string) {
  return toDateOnly(task.startDate) <= dateValue;
}

function isTaskUpcomingAfterDate(task: Task, dateValue: string) {
  return toDateOnly(task.startDate) > dateValue;
}

function isTaskCompleted(task: Task) {
  return Boolean(task.completedAt);
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
  const openTasks = tasks.filter((task) => !isTaskCompleted(task));
  const viewScopedTasks =
    viewMode === "day"
      ? openTasks
      : openTasks.filter((task) => isTaskRelevantToRange(task, rangeStart, rangeEnd));
  const rangeProjectedTasks = projectTasksBySeries(
    viewScopedTasks.filter((task) => toDateOnly(task.startDate) <= rangeEnd),
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

  return [task.title, task.category ?? "", task.notes ?? "", projectName].some(
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

function getTaskProjectLabel(task: Task, projectById: Map<string, Project>) {
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

  return { profilesData, tasksData, projectsData };
}

function isTaskCompletedOnDate(task: Task, dateValue: string) {
  return isTaskCompleted(task) && isSameDateValue(task.completedOn, dateValue);
}

function countsTowardDayProgress(task: Task, dateValue: string) {
  return (
    isTaskActiveOnDate(task, dateValue) &&
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
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
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
          aria-label="Show category options"
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
    projectId: "",
    ...createRepeatDefaults(dateValue),
  };
}

function createEditTaskForm(task: Task): EditTaskFormState {
  const startDate = toDateOnly(task.startDate) || todayInputValue();
  const repeatWeeklyDay = task.repeatWeeklyDay ?? getWeekdayNumber(startDate);

  return {
    title: task.title,
    startDate,
    dueAt: toDateOnly(task.dueAt),
    category: task.category ?? "",
    notes: task.notes ?? "",
    projectId: task.projectId ?? "",
    repeatEnabled: task.repeatEnabled,
    repeatPattern: task.repeatPattern ?? "daily",
    repeatDays:
      task.repeatDays ??
      (task.repeatPattern === "weekly"
        ? getRepeatDayBit(repeatWeeklyDay)
        : ALL_REPEAT_DAYS_MASK),
    repeatWeeklyDay,
    repeatMonthlyDay: task.repeatMonthlyDay ?? getDayOfMonth(startDate),
  };
}

function isRecurringTask(task: Task) {
  return Boolean(task.recurrenceSeriesId || task.repeatEnabled || task.repeatPattern);
}

function RepeatFields<T extends RepeatFormState>({
  form,
  onChange,
  defaultDateValue,
}: {
  form: T;
  onChange: (updater: (prev: T) => T) => void;
  defaultDateValue: string;
}) {
  return (
    <div className={`${cardClass} space-y-3 p-3`}>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.repeatEnabled}
          onChange={(e) =>
            onChange((prev) => {
              const repeatWeeklyDay = getWeekdayNumber(defaultDateValue);

              return {
                ...prev,
                repeatEnabled: e.target.checked,
                repeatDays:
                  prev.repeatPattern === "weekly"
                    ? getRepeatDayBit(repeatWeeklyDay)
                    : ALL_REPEAT_DAYS_MASK,
                repeatWeeklyDay,
                repeatMonthlyDay: getDayOfMonth(defaultDateValue),
              };
            })
          }
        />
        <span>Repeat</span>
      </label>

      {form.repeatEnabled && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <div className="tm-muted">Pattern</div>
            <select
              className={`w-full ${inputClass}`}
              value={form.repeatPattern}
              onChange={(e) => {
                const repeatPattern = e.target.value as RepeatPattern;
                const repeatWeeklyDay = getWeekdayNumber(defaultDateValue);

                onChange((prev) => ({
                  ...prev,
                  repeatPattern,
                  repeatDays:
                    repeatPattern === "daily"
                      ? ALL_REPEAT_DAYS_MASK
                      : repeatPattern === "weekly"
                        ? getRepeatDayBit(repeatWeeklyDay)
                        : prev.repeatDays,
                  repeatWeeklyDay,
                  repeatMonthlyDay: getDayOfMonth(defaultDateValue),
                }));
              }}
            >
              {REPEAT_PATTERN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="text-black">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {(form.repeatPattern === "daily" || form.repeatPattern === "weekly") && (
            <div className="space-y-1 text-sm md:col-span-2">
              <div className="tm-muted">
                {form.repeatPattern === "daily" ? "Repeat days" : "Weekday"}
              </div>
              <div className="flex flex-wrap gap-2">
                {DAY_TOGGLE_LABELS.map((label, index) => {
                  const weekday = index + 1;
                  const bit = getRepeatDayBit(weekday);
                  const selected = (form.repeatDays & bit) !== 0;

                  return (
                    <button
                      key={`${label}-${weekday}`}
                      className={`h-9 w-9 rounded-full border text-sm ${
                        selected ? "tm-button-primary" : "tm-button"
                      }`}
                      type="button"
                      onClick={() =>
                        onChange((prev) => {
                          if (prev.repeatPattern === "weekly") {
                            return {
                              ...prev,
                              repeatDays: bit,
                              repeatWeeklyDay: weekday,
                            };
                          }

                          const nextRepeatDays = selected
                            ? prev.repeatDays & ~bit
                            : prev.repeatDays | bit;

                          if (nextRepeatDays === 0) {
                            return prev;
                          }

                          return {
                            ...prev,
                            repeatDays: nextRepeatDays,
                          };
                        })
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.repeatPattern === "monthly" && (
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Day of month</div>
              <select
                className={`w-full ${inputClass}`}
                value={form.repeatMonthlyDay}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    repeatMonthlyDay: Number(e.target.value),
                  }))
                }
              >
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day} className="text-black">
                    {day}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
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
      <div className={`${cardClass} w-full max-w-lg p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            className={buttonClass}
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  projectName,
  projectArchived = false,
  completionPending = false,
  snoozeDisabled = false,
  showSnoozeAction = false,
  selectMode = false,
  selected = false,
  editingTitleTaskId,
  editingTitleValue,
  editingCategoryTaskId,
  editingCategoryValue,
  categorySuggestions,
  onStartTitleEdit,
  onChangeTitleEdit,
  onCancelTitleEdit,
  onSaveTitleEdit,
  onToggleSelected,
  onStartCategoryEdit,
  onChangeCategoryEdit,
  onCancelCategoryEdit,
  onSaveCategoryEdit,
  onOpenEditModal,
  onToggleCompleted,
  onSnoozePreset,
  onPickSnoozeDate,
  onDelete,
}: {
  task: Task;
  projectName?: string;
  projectArchived?: boolean;
  completionPending?: boolean;
  snoozeDisabled?: boolean;
  showSnoozeAction?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  editingTitleTaskId: string | null;
  editingTitleValue: string;
  editingCategoryTaskId: string | null;
  editingCategoryValue: string;
  categorySuggestions: string[];
  onStartTitleEdit: (task: Task) => void;
  onChangeTitleEdit: (value: string) => void;
  onCancelTitleEdit: () => void;
  onSaveTitleEdit: () => void;
  onToggleSelected: (taskId: string, checked: boolean) => void;
  onStartCategoryEdit: (task: Task) => void;
  onChangeCategoryEdit: (value: string) => void;
  onCancelCategoryEdit: () => void;
  onSaveCategoryEdit: () => void;
  onOpenEditModal: (task: Task) => void;
  onToggleCompleted: (task: Task, completed: boolean) => void;
  onSnoozePreset: (task: Task, preset: SnoozePreset) => void;
  onPickSnoozeDate: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const isEditing = editingTitleTaskId === task.id;
  const isEditingCategory = editingCategoryTaskId === task.id;
  const repeatSummary = getRepeatSummary(task);

  return (
    <div
      className={`rounded-md border p-2.5 ${
        projectArchived
          ? "border-amber-300/20 bg-amber-200/5"
          : "tm-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        {selectMode && (
          <label className="tm-choice flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelected(task.id, e.target.checked)}
            />
            <span>Select</span>
          </label>
        )}
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              autoFocus
              className={`w-full ${inputClass} py-1.5`}
              value={editingTitleValue}
              onBlur={onCancelTitleEdit}
              onChange={(e) => onChangeTitleEdit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveTitleEdit();
                }

                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelTitleEdit();
                }
              }}
            />
          ) : (
            <button
              className="min-w-0 text-left text-sm font-medium hover:opacity-80"
              type="button"
              onClick={() => onStartTitleEdit(task)}
            >
              <span className={isTaskCompleted(task) ? "line-through opacity-70" : ""}>
                {task.title}
              </span>
            </button>
          )}
          {task.notes && <p className="tm-muted mt-1.5 text-xs">{task.notes}</p>}
          <div className="tm-muted mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {projectArchived && (
              <span className="rounded-full border border-amber-300/40 bg-amber-100/80 px-2 py-0.5 text-amber-900">
                Archived
              </span>
            )}
            <span className={chipClass}>
              Start {toDateOnly(task.startDate)}
            </span>
            <span className={chipClass}>
              Due {toDateOnly(task.dueAt) || "—"}
            </span>
            {isEditingCategory ? (
              <div className="tm-chip flex flex-wrap items-center gap-2 rounded-full border px-2 py-0.5">
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
                className="tm-chip rounded-full border px-2 py-0.5 text-left transition-colors hover:bg-white/70"
                type="button"
                onClick={() => onStartCategoryEdit(task)}
              >
                Category {task.category ?? "—"}
              </button>
            )}
            {projectName && (
              <span className={chipClass}>
                Project {projectName}
              </span>
            )}
            {repeatSummary && (
              <span className={chipClass}>
                {repeatSummary}
              </span>
            )}
            {task.completedOn && (
              <span className={chipClass}>
                Done {toDateOnly(task.completedOn)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {showSnoozeAction && (
            <SnoozeMenu
              label="Snooze"
              disabled={snoozeDisabled}
              onPickDate={() => onPickSnoozeDate(task)}
              onSelectPreset={(preset) => onSnoozePreset(task, preset)}
            />
          )}
          <button
            className={compactButtonClass}
            type="button"
            onClick={() => onOpenEditModal(task)}
          >
            Edit
          </button>
          <label className="tm-choice flex items-center gap-2 rounded-md border px-2.5 py-1">
            <input
              type="checkbox"
              checked={isTaskCompleted(task)}
              disabled={completionPending}
              onChange={(e) => onToggleCompleted(task, e.target.checked)}
            />
            <span>{isTaskCompleted(task) ? "Done" : "Open"}</span>
          </label>
          <button
            className={compactButtonClass}
            type="button"
            onClick={() => onDelete(task)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
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
}: TrackerClientProps) {
  const router = useRouter();
  const completionPendingTaskIdsRef = useRef<Set<string>>(new Set());
  const preferenceSyncProfileIdRef = useRef<string | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedPreferencesRef = useRef<{
    profileId: string;
    defaultView: ViewMode;
    averageBasis: AverageBasis;
  } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(todayInputValue);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [openFilter, setOpenFilter] = useState<OpenFilter>("all-active");
  const [doneRange, setDoneRange] = useState<DoneRange>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [averageBasis, setAverageBasis] = useState<AverageBasis>("calendar-days");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectSaving, setNewProjectSaving] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [deleteTaskSaving, setDeleteTaskSaving] = useState(false);
  const [completionPendingTaskIds, setCompletionPendingTaskIds] = useState<string[]>([]);
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
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
  const [bulkSnoozeDateValue, setBulkSnoozeDateValue] = useState("");
  const [form, setForm] = useState<TaskFormState>(createEmptyTaskForm);
  const [newProjectForm, setNewProjectForm] = useState<ProjectFormState>(
    createEmptyProjectForm
  );
  const [editTaskForm, setEditTaskForm] = useState<EditTaskFormState | null>(null);

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
  }, [profileId]);

  useEffect(() => {
    setForm(createEmptyTaskForm());
    setNewProjectForm(createEmptyProjectForm());
    setEditTaskForm(null);
    setEditTaskId(null);
    setEditingTitleTaskId(null);
    setEditingTitleValue("");
    setEditingCategoryTaskId(null);
    setEditingCategoryValue("");
    setSelectedDay(todayInputValue());
    setOpenFilter("all-active");
    setDoneRange("today");
    setSearchQuery("");
    setShowArchived(false);
    setNewProjectOpen(false);
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
    preferenceSyncProfileIdRef.current = null;
    lastSavedPreferencesRef.current = null;
  }, [profileId]);

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
  const visibleProjects = projects.filter((project) => showArchived || !project.archived);
  const assignableProjects = projects.filter(
    (project) => showArchived || !project.archived
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

  const visibleTasks = filterTasksByArchivedVisibility(tasks, projectById, showArchived);
  const dayInsights = getDayInsightMetrics(visibleTasks, selectedDay);
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
    isTaskVisibleForProgress(task, projectById, showArchived)
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
  const openTasks = projectedOpenTasks[
    openFilter === "all-active"
      ? "allActive"
      : openFilter === "today"
        ? "today"
        : openFilter === "upcoming"
          ? "upcoming"
          : "overdue"
  ];

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
    return project ? showArchived || !project.archived : true;
  }

  const dayOpenTasks = openTasks.filter(
    (task) =>
      isTaskVisibleInDayView(task) && matchesTaskSearch(task, searchQuery, projectById)
  );
  const dayDoneTasks = doneTasks.filter(
    (task) =>
      isTaskVisibleInDayView(task) && matchesTaskSearch(task, searchQuery, projectById)
  );
  const searchResults = visibleTasks.filter((task) =>
    matchesTaskSearch(task, searchQuery, projectById)
  );
  const searchSections: SearchSection[] = [
    {
      key: "active",
      label: "Active",
      tasks: searchResults.filter(
        (task) => !isTaskCompleted(task) && toDateOnly(task.startDate) <= selectedDay
      ),
    },
    {
      key: "upcoming",
      label: "Upcoming",
      tasks: searchResults.filter(
        (task) => !isTaskCompleted(task) && isTaskUpcomingAfterDate(task, selectedDay)
      ),
    },
    {
      key: "complete",
      label: "Complete",
      tasks: searchResults.filter((task) => isTaskCompleted(task)),
    },
  ];
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
    ...visibleProjects.map((project) => ({
      key: project.id,
      label: project.name,
      project,
      collapsed: project.collapsed,
      openTasks: dayOpenTasks.filter((task) => task.projectId === project.id),
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
    {
      key: "unassigned",
      label: "Unassigned",
      project: null,
      collapsed: false,
      openTasks: dayOpenTasks.filter((task) => !task.projectId),
      doneTasks: dayDoneTasks.filter((task) => !task.projectId),
      progressTotal: 0,
      progressCompleted: 0,
    },
  ];
  const visibleDayTaskIds = Array.from(
    new Set(
      (searchActive
        ? searchSections.flatMap((section) => section.tasks)
        : groupedSections.flatMap((section) => [...section.openTasks, ...section.doneTasks])
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
      !project.archived || showArchived || project.id === (editTask?.projectId ?? "")
  );
  const newTaskProjectOptions = assignableProjects;
  const isReportingPage = pageMode === "reporting";

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
          projectId: form.projectId || null,
          repeatEnabled: form.repeatEnabled,
          repeatPattern: form.repeatEnabled ? form.repeatPattern : null,
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

      const task = (await res.json()) as Task;
      setTasks((prev) => [task, ...prev]);
      setForm(createEmptyTaskForm(selectedDay));
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

      const task = (await res.json()) as Task;
      setTasks((prev) => [task, ...prev]);
      setQuickAddValue("");
      requestAnimationFrame(() => {
        quickAddInputRef.current?.focus();
      });
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

  async function updateTask(taskId: string, body: Record<string, unknown>) {
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
    const task = "task" in payload ? payload.task : payload;
    const createdTask = "task" in payload ? payload.createdTask ?? null : null;

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

  async function toggleTaskCompleted(taskId: string, completed: boolean) {
    if (completionPendingTaskIdsRef.current.has(taskId)) {
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
      });
    } finally {
      completionPendingTaskIdsRef.current.delete(taskId);
      setCompletionPendingTaskIds((prev) => prev.filter((id) => id !== taskId));
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

  async function deleteTask(task: Task, mode: DeleteMode) {
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

      await refreshData();
      setDeleteTaskModalTask(null);
      setDeleteTaskMode("this");
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    } finally {
      setDeleteTaskSaving(false);
    }
  }

  function requestDeleteTask(task: Task) {
    if (!task.recurrenceSeriesId) {
      void deleteTask(task, "this").catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not delete task")
      );
      return;
    }

    setDeleteTaskModalTask(task);
    setDeleteTaskMode("this");
  }

  function startTitleEdit(task: Task) {
    setEditingTitleTaskId(task.id);
    setEditingTitleValue(task.title);
  }

  function cancelTitleEdit() {
    setEditingTitleTaskId(null);
    setEditingTitleValue("");
  }

  function startCategoryEdit(task: Task) {
    setEditingCategoryTaskId(task.id);
    setEditingCategoryValue(task.category ?? "");
  }

  function cancelCategoryEdit() {
    setEditingCategoryTaskId(null);
    setEditingCategoryValue("");
  }

  async function saveTitleEdit() {
    if (!editingTitleTaskId) return;

    const nextTitle = editingTitleValue.trim();
    const currentTask = tasks.find((task) => task.id === editingTitleTaskId);

    if (!currentTask) {
      cancelTitleEdit();
      return;
    }

    if (!nextTitle || nextTitle === currentTask.title) {
      cancelTitleEdit();
      return;
    }

    try {
      await updateTask(editingTitleTaskId, { title: nextTitle });
      cancelTitleEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task");
    }
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

  function closeTaskEditor() {
    setEditTaskId(null);
    setEditTaskForm(null);
  }

  async function submitTaskEditor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTaskId || !editTaskForm) return;

    setEditTaskSaving(true);

    try {
      await updateTask(editTaskId, {
        title: editTaskForm.title.trim(),
        startDate: editTaskForm.startDate,
        dueAt: editTaskForm.dueAt || null,
        category: editTaskForm.category || null,
        notes: editTaskForm.notes || null,
        projectId: editTaskForm.projectId || null,
        repeatEnabled: editTaskForm.repeatEnabled,
        repeatPattern: editTaskForm.repeatEnabled ? editTaskForm.repeatPattern : null,
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
      });
      closeTaskEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task");
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

  if (isReportingPage) {
    return (
      <section className="space-y-4 text-[color:var(--tm-text)]">
        <div className={commandBarClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link
                className="inline-flex h-10 items-center gap-3 rounded-[10px] px-2 text-sm transition-opacity hover:opacity-100"
                href="/"
              >
                <Image
                  src="/logo.png"
                  alt="TaskManager"
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md"
                />
                <span className="tm-muted">← Back to profiles</span>
              </Link>
              <span className={`${smallChipClass} px-3 py-1.5 uppercase tracking-[0.14em]`}>
                {currentProfileName}
              </span>
              <div className={tabSetClass}>
                <Link className={tabClass} href={`/p/${profileId}`}>
                  Tracker
                </Link>
                <Link className={activeTabClass} href={`/p/${profileId}/reporting`}>
                  Reporting
                </Link>
              </div>
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
              <label className="tm-choice flex h-10 items-center gap-2 rounded-[10px] border px-3 text-sm">
                <input
                  checked={showArchived}
                  type="checkbox"
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                <span>Show archived</span>
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
            <Link
              className="inline-flex h-10 items-center gap-3 rounded-[10px] px-2 text-sm transition-opacity hover:opacity-100"
              href="/"
            >
              <Image
                src="/logo.png"
                alt="TaskManager"
                width={28}
                height={28}
                className="h-7 w-7 rounded-md"
              />
              <span className="tm-muted">← Back to profiles</span>
            </Link>
            <span className={`${smallChipClass} px-3 py-1.5 uppercase tracking-[0.14em]`}>
              {currentProfileName}
            </span>
            <div className={tabSetClass}>
              <Link className={activeTabClass} href={`/p/${profileId}`}>
                Tracker
              </Link>
              <Link className={tabClass} href={`/p/${profileId}/reporting`}>
                Reporting
              </Link>
            </div>
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
            <div className="relative min-w-[18rem] max-w-[32rem] flex-1">
              <input
                className={`w-full ${inputClass} pr-9`}
                placeholder="Search title, category, notes"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && searchQuery.trim()) {
                    e.preventDefault();
                    clearSearch();
                  }
                }}
              />
              {searchQuery.trim() && (
                <button
                  aria-label="Clear search"
                  className="tm-muted absolute right-2 top-1/2 -translate-y-1/2 rounded-sm px-1 text-sm transition-opacity hover:opacity-100"
                  type="button"
                  onClick={clearSearch}
                >
                  ✕
                </button>
              )}
            </div>
            <label className="tm-choice flex h-10 items-center gap-2 rounded-[10px] border px-3 text-sm">
              <input
                checked={showArchived}
                type="checkbox"
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>{searchActive ? "Include archived" : "Show archived"}</span>
            </label>
            <button
              className={primaryButtonClass}
              type="button"
              onClick={() => quickAddInputRef.current?.focus()}
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

      {pageMode === "reporting" && viewMode === "day" && (
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

      {pageMode === "reporting" && viewMode === "week" && (
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
            <div className="overflow-x-auto">
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

      {pageMode === "reporting" && viewMode === "month" && (
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
            <div className="overflow-x-auto">
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
        <section className={sectionCardClass}>
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

          <form
            className="mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitQuickAdd();
            }}
          >
            <input
              ref={quickAddInputRef}
              className={`w-full ${inputClass} text-sm transition-colors`}
              disabled={quickAddSaving}
              placeholder="Quick add... (Enter to add)"
              value={quickAddValue}
              onChange={(e) => setQuickAddValue(e.target.value)}
            />
          </form>

          {searchActive ? (
            <div className="tm-muted mb-4 text-sm">
              Found {searchResultCount} matching task
              {searchResultCount === 1 ? "" : "s"} across this profile.
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {OPEN_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-md border px-3 py-1 text-sm ${
                      openFilter === option.value ? "tm-button-primary" : "tm-button"
                    }`}
                    type="button"
                    onClick={() => setOpenFilter(option.value)}
                  >
                    Open: {option.label}
                  </button>
                ))}
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

              <div className="tm-muted mb-4 text-sm">
                Showing {dayOpenTasks.length} open and {dayDoneTasks.length} done task
                {(dayOpenTasks.length + dayDoneTasks.length) === 1 ? "" : "s"}.
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
                        (showArchived ? matchingArchivedProjects.length : 0)}{" "}
                      result
                      {matchingActiveProjects.length +
                        (showArchived ? matchingArchivedProjects.length : 0) ===
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

                  {showArchived && (
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

              {searchSections.map((section) => (
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
                    <div className="space-y-3">
                      {section.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          projectName={
                            task.projectId
                              ? projectById.get(task.projectId)?.name ?? "Unknown"
                              : "Unassigned"
                          }
                          projectArchived={
                            task.projectId
                              ? projectById.get(task.projectId)?.archived ?? false
                              : false
                          }
                          completionPending={completionPendingTaskIds.includes(task.id)}
                          selectMode={selectMode}
                          selected={selectedTaskIds.includes(task.id)}
                          editingTitleTaskId={editingTitleTaskId}
                          editingTitleValue={editingTitleValue}
                          editingCategoryTaskId={editingCategoryTaskId}
                          editingCategoryValue={editingCategoryValue}
                          categorySuggestions={categorySuggestions}
                          onStartTitleEdit={startTitleEdit}
                          onChangeTitleEdit={setEditingTitleValue}
                          onCancelTitleEdit={cancelTitleEdit}
                          onSaveTitleEdit={() => void saveTitleEdit()}
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
                          showSnoozeAction={!isTaskCompleted(task)}
                          snoozeDisabled={bulkSaving}
                          onDelete={requestDeleteTask}
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
            <div className="space-y-4">
              {groupedSections.map((section) => {
                const subtitle = section.project
                  ? [
                      section.project.category ? `Category ${section.project.category}` : null,
                      `Start ${toDateOnly(section.project.startDate)}`,
                      section.project.dueAt ? `Due ${toDateOnly(section.project.dueAt)}` : null,
                      section.project.archived ? "Archived" : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")
                  : "Tasks with no project";

                return (
                  <section
                    key={section.key}
                    id={section.project ? `project-${section.project.id}` : undefined}
                    className={`rounded-xl border p-4 ${
                      section.project?.archived
                        ? "border-amber-300/20 bg-amber-200/5"
                        : "tm-card"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{section.label}</h3>
                          {section.project?.archived && (
                            <span className="rounded-full border border-amber-300/40 bg-amber-100/80 px-2 py-0.5 text-xs text-amber-900">
                              Archived
                            </span>
                          )}
                          <span className={`${smallChipClass} opacity-100`}>
                            {section.openTasks.length} open / {section.doneTasks.length} done
                          </span>
                        </div>
                        <div className="tm-muted mt-1 text-sm">{subtitle}</div>
                        {section.project && (
                          <div className="mt-3 max-w-md">
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

                      <div className="flex flex-wrap items-center gap-2">
                        {section.project && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>

                    {!section.collapsed && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="mb-2 text-sm font-medium opacity-80">Open</div>
                          {section.openTasks.length === 0 ? (
                            <div className="text-sm opacity-50">No open tasks.</div>
                          ) : (
                            <div className="space-y-3">
                              {section.openTasks.map((task) => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  completionPending={completionPendingTaskIds.includes(
                                    task.id
                                  )}
                                  selectMode={selectMode}
                                  selected={selectedTaskIds.includes(task.id)}
                                  editingTitleTaskId={editingTitleTaskId}
                                  editingTitleValue={editingTitleValue}
                                  editingCategoryTaskId={editingCategoryTaskId}
                                  editingCategoryValue={editingCategoryValue}
                                  categorySuggestions={categorySuggestions}
                                  onStartTitleEdit={startTitleEdit}
                                  onChangeTitleEdit={setEditingTitleValue}
                                  onCancelTitleEdit={cancelTitleEdit}
                                  onSaveTitleEdit={() => void saveTitleEdit()}
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
                                  showSnoozeAction
                                  snoozeDisabled={bulkSaving}
                                  onDelete={requestDeleteTask}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="mb-2 text-sm font-medium opacity-80">Done</div>
                          {section.doneTasks.length === 0 ? (
                            <div className="text-sm opacity-50">No done tasks.</div>
                          ) : (
                            <div className="space-y-3">
                              {section.doneTasks.map((task) => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  completionPending={completionPendingTaskIds.includes(
                                    task.id
                                  )}
                                  selectMode={selectMode}
                                  selected={selectedTaskIds.includes(task.id)}
                                  editingTitleTaskId={editingTitleTaskId}
                                  editingTitleValue={editingTitleValue}
                                  editingCategoryTaskId={editingCategoryTaskId}
                                  editingCategoryValue={editingCategoryValue}
                                  categorySuggestions={categorySuggestions}
                                  onStartTitleEdit={startTitleEdit}
                                  onChangeTitleEdit={setEditingTitleValue}
                                  onCancelTitleEdit={cancelTitleEdit}
                                  onSaveTitleEdit={() => void saveTitleEdit()}
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
                                  showSnoozeAction={false}
                                  snoozeDisabled={bulkSaving}
                                  onDelete={requestDeleteTask}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
              {groupedSections.length === 0 && (
                <div className="text-sm opacity-60">No matching tasks for this day.</div>
              )}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          <section className={sectionCardClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--tm-border)] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">Open</h2>
                  <span className="tm-muted text-sm">
                    {openTasks.length} task{openTasks.length === 1 ? "" : "s"} for{" "}
                    {nonDayOpenListLabel}
                  </span>
                </div>
                {openFilter === "today" && (
                  <div className="tm-muted mt-1 text-xs">
                    Today includes tasks that start today or are due today.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                <div className={segmentedTabSetClass}>
                  {OPEN_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={
                        openFilter === option.value
                          ? segmentedActiveTabClass
                          : segmentedTabClass
                      }
                      type="button"
                      onClick={() => setOpenFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-sm opacity-60">Loading tasks…</div>
            ) : openTasks.length === 0 ? (
              <div className="text-sm opacity-60">No matching open tasks.</div>
            ) : (
              <div className="relative max-h-[520px] overflow-y-auto overflow-x-auto">
                <table className="min-w-full table-fixed border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className={`${matrixHeaderCellClass} w-[40%]`}>Task</th>
                      <th className={`${matrixHeaderCellClass} w-[14%]`}>Project</th>
                      <th className={`${matrixHeaderCellClass} w-[14%]`}>Category</th>
                      <th className={`${matrixHeaderCellClass} w-[120px]`}>Due</th>
                      <th className={`${matrixHeaderCellClass} w-[120px]`}>Start</th>
                      <th className={`${matrixHeaderCellClass} w-[72px] text-center`}>Done</th>
                      <th className={`${matrixHeaderCellClass} w-[72px] text-center`}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openTasks.map((task) => (
                      <tr key={task.id} className="tm-table-row border-t align-top">
                        <td className={matrixCellClass}>
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{task.title}</div>
                            <div className="tm-muted mt-1 flex flex-wrap gap-1.5 text-[11px]">
                              {showStartChipInTables && (
                                <span className={smallChipClass}>
                                  Start {formatShortDate(toDateOnly(task.startDate))}
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
                        <td className={`${matrixCellClass} tm-muted`}>
                          {task.category ?? "—"}
                        </td>
                        <td className={matrixCellClass}>{toDateOnly(task.dueAt) || "—"}</td>
                        <td className={matrixCellClass}>{toDateOnly(task.startDate)}</td>
                        <td className={`${matrixCellClass} text-center`}>
                          <input
                            aria-label={`Mark ${task.title} done`}
                            type="checkbox"
                            checked={false}
                            disabled={completionPendingTaskIds.includes(task.id)}
                            onChange={() =>
                              void toggleTaskCompleted(task.id, true).catch(
                                (err: unknown) =>
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Could not update task"
                                  )
                              )
                            }
                          />
                        </td>
                        <td className={`${matrixCellClass} text-center`}>
                          <button
                            aria-label={`Delete ${task.title}`}
                            className={iconButtonClass}
                            type="button"
                            onClick={() => requestDeleteTask(task)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details
            open
            className="rounded-[12px] border border-[color:var(--tm-border)] bg-[rgba(246,240,230,0.68)] p-4"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-3">
                <span className="text-base font-medium text-[color:var(--tm-text)]">Done</span>
                <span className="tm-muted">
                  {doneTasks.length} completed task{doneTasks.length === 1 ? "" : "s"}
                </span>
              </span>
              <label
                className="flex items-center gap-2 text-sm"
                onClick={(e) => e.stopPropagation()}
              >
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
            </summary>

            <div className="mt-4">
              {loading ? (
                <div className="text-sm opacity-60">Loading tasks…</div>
              ) : doneTasks.length === 0 ? (
                <div className="text-sm opacity-60">No completed tasks in this range.</div>
              ) : (
                <div className="relative max-h-[520px] overflow-y-auto overflow-x-auto">
                  <table className="min-w-full table-fixed border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className={`${matrixHeaderCellClass} w-[36%]`}>Task</th>
                        <th className={`${matrixHeaderCellClass} w-[14%]`}>Project</th>
                        <th className={`${matrixHeaderCellClass} w-[14%]`}>Category</th>
                        <th className={`${matrixHeaderCellClass} w-[120px]`}>Due</th>
                        <th className={`${matrixHeaderCellClass} w-[120px]`}>Start</th>
                        <th className={`${matrixHeaderCellClass} w-[120px]`}>Done on</th>
                        <th className={`${matrixHeaderCellClass} w-[72px] text-center`}>
                          Open
                        </th>
                        <th className={`${matrixHeaderCellClass} w-[72px] text-center`}>
                          Delete
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {doneTasks.map((task) => (
                        <tr key={task.id} className="tm-table-row border-t align-top opacity-80">
                          <td className={matrixCellClass}>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{task.title}</div>
                              <div className="tm-muted mt-1 flex flex-wrap gap-1.5 text-[11px]">
                                {showStartChipInTables && (
                                  <span className={smallChipClass}>
                                    Start {formatShortDate(toDateOnly(task.startDate))}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`${matrixCellClass} tm-muted`}>
                            {getTaskProjectLabel(task, projectById)}
                          </td>
                          <td className={`${matrixCellClass} tm-muted`}>
                            {task.category ?? "—"}
                          </td>
                          <td className={matrixCellClass}>{toDateOnly(task.dueAt) || "—"}</td>
                          <td className={matrixCellClass}>{toDateOnly(task.startDate)}</td>
                          <td className={matrixCellClass}>{toDateOnly(task.completedOn)}</td>
                          <td className={`${matrixCellClass} text-center`}>
                            <input
                              aria-label={`Mark ${task.title} open`}
                              type="checkbox"
                              checked
                              disabled={completionPendingTaskIds.includes(task.id)}
                              onChange={() =>
                                void toggleTaskCompleted(task.id, false).catch(
                                  (err: unknown) =>
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "Could not update task"
                                    )
                                )
                              }
                            />
                          </td>
                          <td className={`${matrixCellClass} text-center`}>
                            <button
                              aria-label={`Delete ${task.title}`}
                              className={iconButtonClass}
                              type="button"
                              onClick={() => requestDeleteTask(task)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>

        </div>
      )}

      <details className="rounded-[12px] border border-[color:var(--tm-border)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Advanced add task</summary>
        <div className="mb-3 mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="tm-muted text-sm">Expanded task fields and repeat settings.</div>
          <button
            className={buttonClass}
            type="button"
            onClick={() => setNewProjectOpen(true)}
          >
            + Project
          </button>
        </div>

        <form onSubmit={createTask} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto]">
            <input
              className={inputClass}
              placeholder="+ Task"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
            />
            <DateInput
              className={inputClass}
              value={form.startDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
            <DateInput
              className={inputClass}
              value={form.dueAt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dueAt: e.target.value }))
              }
            />
            <CategoryCombobox
              className={inputClass}
              placeholder="Category"
              suggestions={categorySuggestions}
              value={form.category}
              onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
            />
            <select
              className={inputClass}
              value={form.projectId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, projectId: e.target.value }))
              }
            >
              <option value="" className="text-black">
                Unassigned
              </option>
              {newTaskProjectOptions.map((project) => (
                <option key={project.id} value={project.id} className="text-black">
                  {project.name}
                  {project.archived ? " (Archived)" : ""}
                </option>
              ))}
            </select>
            <button
              className={`${primaryButtonClass} px-4 disabled:opacity-50`}
              disabled={saving}
              type="submit"
            >
              Save
            </button>
          </div>

          <RepeatFields
            form={form}
            defaultDateValue={form.startDate}
            onChange={(updater) => setForm((prev) => updater(prev))}
          />
        </form>
      </details>

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

      <Modal
        open={Boolean(deleteTaskModalTask)}
        title="Delete recurring task"
        onClose={() => {
          if (deleteTaskSaving) return;
          setDeleteTaskModalTask(null);
          setDeleteTaskMode("this");
        }}
      >
        {deleteTaskModalTask && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void deleteTask(deleteTaskModalTask, deleteTaskMode).catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not delete task")
              );
            }}
          >
            <div className="space-y-2">
              <label className={modalChoiceClass}>
                <input
                  checked={deleteTaskMode === "this"}
                  disabled={deleteTaskSaving}
                  name="delete-mode"
                  type="radio"
                  value="this"
                  onChange={() => setDeleteTaskMode("this")}
                />
                <div>
                  <div className="font-medium">This task only</div>
                </div>
              </label>
              <label className={modalChoiceClass}>
                <input
                  checked={deleteTaskMode === "future"}
                  disabled={deleteTaskSaving}
                  name="delete-mode"
                  type="radio"
                  value="future"
                  onChange={() => setDeleteTaskMode("future")}
                />
                <div>
                  <div className="font-medium">This and future tasks</div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-300/50 bg-red-50 p-3">
                <input
                  checked={deleteTaskMode === "series"}
                  disabled={deleteTaskSaving}
                  name="delete-mode"
                  type="radio"
                  value="series"
                  onChange={() => setDeleteTaskMode("series")}
                />
                <div>
                  <div className="font-medium text-red-700">Entire series</div>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className={buttonClass}
                disabled={deleteTaskSaving}
                type="button"
                onClick={() => {
                  setDeleteTaskModalTask(null);
                  setDeleteTaskMode("this");
                }}
              >
                Cancel
              </button>
              <button
                className={`rounded-md px-4 py-2 text-sm disabled:opacity-50 ${
                  deleteTaskMode === "series" ? "tm-button-danger" : "tm-button-primary border"
                }`}
                disabled={deleteTaskSaving}
                type="submit"
              >
                Delete
              </button>
            </div>
          </form>
        )}
      </Modal>

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

      <Modal open={Boolean(editTaskId && editTaskForm)} title="Edit Task" onClose={closeTaskEditor}>
        {editTaskForm && (
          <form className="space-y-3" onSubmit={submitTaskEditor}>
            <input
              className={`w-full ${inputClass}`}
              placeholder="Task title"
              value={editTaskForm.title}
              onChange={(e) =>
                setEditTaskForm((prev) =>
                  prev ? { ...prev, title: e.target.value } : prev
                )
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <div className="tm-muted">Start date</div>
                <DateInput
                  className={`w-full ${inputClass}`}
                  required
                  value={editTaskForm.startDate}
                  onChange={(e) =>
                    setEditTaskForm((prev) =>
                      prev ? { ...prev, startDate: e.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="tm-muted">Due date</div>
                <DateInput
                  className={`w-full ${inputClass}`}
                  value={editTaskForm.dueAt}
                  onChange={(e) =>
                    setEditTaskForm((prev) =>
                      prev ? { ...prev, dueAt: e.target.value } : prev
                    )
                  }
                />
              </label>
            </div>
            <CategoryCombobox
              className={`w-full ${inputClass}`}
              placeholder="Category"
              suggestions={categorySuggestions}
              value={editTaskForm.category}
              onChange={(value) =>
                setEditTaskForm((prev) => (prev ? { ...prev, category: value } : prev))
              }
            />
            <textarea
              className={`min-h-28 w-full ${inputClass}`}
              placeholder="Notes"
              value={editTaskForm.notes}
              onChange={(e) =>
                setEditTaskForm((prev) =>
                  prev ? { ...prev, notes: e.target.value } : prev
                )
              }
            />
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Project</div>
              <select
                className={`w-full ${inputClass}`}
                value={editTaskForm.projectId}
                onChange={(e) =>
                  setEditTaskForm((prev) =>
                    prev ? { ...prev, projectId: e.target.value } : prev
                  )
                }
              >
                <option value="" className="text-black">
                  Unassigned
                </option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id} className="text-black">
                    {project.name}
                    {project.archived ? " (Archived)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <RepeatFields
              form={editTaskForm}
              defaultDateValue={editTaskForm.startDate}
              onChange={(updater) =>
                setEditTaskForm((prev) => (prev ? updater(prev) : prev))
              }
            />
            <button
              className={`${primaryButtonClass} px-4 disabled:opacity-50`}
              disabled={editTaskSaving}
              type="submit"
            >
              Save Task
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}
