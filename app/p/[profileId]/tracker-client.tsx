"use client";

import {
  useEffect,
  useId,
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_TOGGLE_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const REPEAT_PATTERN_OPTIONS: Array<{ value: RepeatPattern; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const ALL_REPEAT_DAYS_MASK = 0b1111111;

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
  ...props
}: ComponentPropsWithoutRef<"input"> & { suggestions: string[] }) {
  const listId = useId();

  return (
    <>
      <input {...props} list={listId} />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </>
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
    <div className="space-y-3 rounded-md border border-white/10 p-3">
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
            <div className="opacity-70">Pattern</div>
            <select
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
              <div className="opacity-70">
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
                        selected
                          ? "border-white bg-white text-black"
                          : "border-white/15 bg-transparent text-white/75"
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
              <div className="opacity-70">Day of month</div>
              <select
                className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-neutral-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            className="rounded-md border border-white/10 px-3 py-1 text-sm"
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
  onDelete,
}: {
  task: Task;
  projectName?: string;
  projectArchived?: boolean;
  completionPending?: boolean;
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
  onDelete: (task: Task) => void;
}) {
  const isEditing = editingTitleTaskId === task.id;
  const isEditingCategory = editingCategoryTaskId === task.id;
  const repeatSummary = getRepeatSummary(task);

  return (
    <div
      className={`rounded-lg border p-3 ${
        projectArchived
          ? "border-amber-300/20 bg-amber-200/5"
          : "border-white/10 bg-black/10"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {selectMode && (
          <label className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm">
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
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
              className="min-w-0 text-left text-base font-medium hover:opacity-80"
              type="button"
              onClick={() => onStartTitleEdit(task)}
            >
              <span className={isTaskCompleted(task) ? "line-through opacity-70" : ""}>
                {task.title}
              </span>
            </button>
          )}
          {task.notes && <p className="mt-2 text-sm opacity-70">{task.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-70">
            {projectArchived && (
              <span className="rounded-full border border-amber-200/20 bg-amber-100/10 px-2 py-1 text-amber-100/90">
                Archived
              </span>
            )}
            <span className="rounded-full border border-white/10 px-2 py-1">
              Start {toDateOnly(task.startDate)}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-1">
              Due {toDateOnly(task.dueAt) || "—"}
            </span>
            {isEditingCategory ? (
              <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 px-2 py-1">
                <CategoryCombobox
                  autoFocus
                  className="min-w-40 bg-transparent outline-none"
                  placeholder="Category"
                  suggestions={categorySuggestions}
                  value={editingCategoryValue}
                  onChange={(e) => onChangeCategoryEdit(e.target.value)}
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
                  className="rounded-md border border-white/10 px-2 py-0.5"
                  type="button"
                  onClick={onSaveCategoryEdit}
                >
                  Save
                </button>
                <button
                  className="rounded-md border border-white/10 px-2 py-0.5"
                  type="button"
                  onClick={onCancelCategoryEdit}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="rounded-full border border-white/10 px-2 py-1 text-left transition-colors hover:bg-white/10"
                type="button"
                onClick={() => onStartCategoryEdit(task)}
              >
                Category {task.category ?? "—"}
              </button>
            )}
            {projectName && (
              <span className="rounded-full border border-white/10 px-2 py-1">
                Project {projectName}
              </span>
            )}
            {repeatSummary && (
              <span className="rounded-full border border-white/10 px-2 py-1">
                {repeatSummary}
              </span>
            )}
            {task.completedOn && (
              <span className="rounded-full border border-white/10 px-2 py-1">
                Done {toDateOnly(task.completedOn)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-white/10 px-3 py-1 text-sm"
            type="button"
            onClick={() => onOpenEditModal(task)}
          >
            Edit
          </button>
          <label className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-1 text-sm">
            <input
              type="checkbox"
              checked={isTaskCompleted(task)}
              disabled={completionPending}
              onChange={(e) => onToggleCompleted(task, e.target.checked)}
            />
            <span>{isTaskCompleted(task) ? "Done" : "Open"}</span>
          </label>
          <button
            className="rounded-md border border-white/10 px-3 py-1 text-sm"
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
      className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-white/10 ${
        project.archived
          ? "border-amber-300/20 bg-amber-200/5"
          : "border-white/10 bg-black/10"
      }`}
      type="button"
      onClick={() => onClick(project)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">{project.name}</div>
            {project.archived && (
              <span className="rounded-full border border-amber-200/20 bg-amber-100/10 px-2 py-0.5 text-xs text-amber-100/90">
                Archived
              </span>
            )}
          </div>
          <div className="mt-1 text-xs opacity-60">{subtitle || "No project metadata"}</div>
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
    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
      <div className="text-xs uppercase tracking-wide opacity-50">{label}</div>
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
    <div className="rounded-xl border border-white/10 bg-black/10 p-4">
      <div className="mb-3 text-sm font-medium opacity-80">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm opacity-50">No completed tasks in this period.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${title}-${item.label}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate opacity-80">{item.label}</span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs">
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
  profileId,
  profileName,
}: TrackerClientProps) {
  const router = useRouter();
  const completionPendingTaskIdsRef = useRef<Set<string>>(new Set());
  const preferenceSyncProfileIdRef = useRef<string | null>(null);
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
  const hasRecurringSelection = selectedTasks.some((task) => Boolean(task.recurrenceSeriesId));

  useEffect(() => {
    if (viewMode !== "day") {
      setSelectMode(false);
      setSelectedTaskIds([]);
    }
  }, [viewMode]);

  useEffect(() => {
  setSelectedTaskIds((prev) => {
    const next = prev.filter((taskId) =>
      visibleDayTaskIds.includes(taskId)
    );

    if (
      next.length === prev.length &&
      next.every((id, i) => id === prev[i])
    ) {
      return prev;
    }

    return next;
  });
}, [visibleDayTaskIds]);

  const editTask = editTaskId ? tasks.find((task) => task.id === editTaskId) ?? null : null;
  const projectOptions = projects.filter(
    (project) =>
      !project.archived || showArchived || project.id === (editTask?.projectId ?? "")
  );
  const newTaskProjectOptions = assignableProjects;

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
      setSelectedTaskIds([]);
      setBulkActionScope("this");
      setBulkScopeAction(null);
      setBulkProjectModalOpen(false);
      setBulkCategoryModalOpen(false);
      setBulkDateModal(null);
      setBulkProjectValue("");
      setBulkCategoryValue("");
      setBulkDateValue("");
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

    if (
      hasRecurringSelection &&
      (input.action === "mark-done" ||
        input.action === "mark-open" ||
        input.action === "delete")
    ) {
      setBulkScopeAction(request);
      setBulkActionScope("this");
      return;
    }

    void executeBulkAction({ ...request, scope: "this" }).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not run bulk action")
    );
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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-4">
        <div>
          <div className="text-sm opacity-70">Current profile</div>
          <div className="text-lg font-semibold">{currentProfileName}</div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="opacity-70">Switch profile</span>
          <select
            className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            value={profileId}
            onChange={(e) => router.push(`/p/${e.target.value}`)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id} className="text-black">
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="opacity-70">View</span>
            <select
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              {VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="text-black">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="opacity-70">Selected day</span>
            <DateInput
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm"
            type="button"
            onClick={() => shiftSelectedDay(-1)}
          >
            Prev
          </button>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm"
            type="button"
            onClick={() => shiftSelectedDay(1)}
          >
            Next
          </button>
        </div>
      </div>

      <section className="rounded-md border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Add Task</h2>
            <div className="text-sm opacity-70">Quick capture for the current profile.</div>
          </div>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm"
            type="button"
            onClick={() => setNewProjectOpen(true)}
          >
            + Project
          </button>
        </div>

        <form
          onSubmit={createTask}
          className="space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto]">
            <input
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              placeholder="+ Task"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
            />
            <DateInput
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              value={form.startDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
            <DateInput
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              value={form.dueAt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dueAt: e.target.value }))
              }
            />
            <CategoryCombobox
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              placeholder="Category"
              suggestions={categorySuggestions}
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
            />
            <select
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
              className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
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
      </section>

      {error && (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {viewMode === "day" && (
        <section className="rounded-md border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Day Progress</h2>
              <div className="text-sm opacity-70">{formatLongDate(selectedDay)}</div>
            </div>
            <div className="text-sm opacity-70">
              {progressCompleted} / {progressTotal} completed
            </div>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InsightMetric label="Completed Today" value={dayInsights.completedToday} />
            <InsightMetric label="Created Today" value={dayInsights.createdToday} />
            <InsightMetric label="Open Today" value={dayInsights.openToday} />
            <InsightMetric label="Rolled Over" value={dayInsights.rolledOver} />
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              key={selectedDay}
              className="h-full rounded-full bg-white transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      )}

      {viewMode === "week" && (
        <div className="space-y-4">
          <section className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Week Summary</h2>
                <div className="text-sm opacity-70">
                  {formatLongDate(weekStartValue)} to {formatLongDate(weekEndValue)}
                </div>
              </div>
              <div className="text-right text-sm opacity-70">Week starts Monday</div>
            </div>
            <div className="mb-4 text-sm opacity-70">
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

          <section className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Week</h2>
                <div className="text-sm opacity-70">
                  {formatLongDate(weekStartValue)} to {formatLongDate(weekEndValue)}
                </div>
              </div>
              <div className="text-right text-sm opacity-70">
                <div>Week starts Monday</div>
                <div className="text-xs opacity-70">
                  Legend: X active • +Y new • Z due
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="grid min-w-[42rem] grid-cols-7 gap-3">
                {weekDays.map((day, index) => (
                  <button
                    key={day.key}
                    className={`rounded-md border bg-black/10 p-3 text-left hover:bg-white/10 ${
                      day.openNewCount > 0
                        ? "border-emerald-300/40"
                        : day.openDueCount > 0
                          ? "border-amber-300/40"
                          : "border-white/10"
                    }`}
                    type="button"
                    onClick={() => jumpToDay(day.dateValue)}
                  >
                    <div className="text-xs uppercase tracking-wide opacity-60">
                      {WEEKDAY_LABELS[index]}
                    </div>
                    <div className="mt-2 text-lg font-semibold">{day.date.getDate()}</div>
                    <div className="mt-3 text-sm opacity-70">
                      {day.openActiveCount} active
                    </div>
                    {day.openNewCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-100">
                        +{day.openNewCount} new
                      </div>
                    )}
                    {day.openDueCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
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

      {viewMode === "month" && (
        <div className="space-y-4">
          <section className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Month Summary</h2>
                <div className="text-sm opacity-70">{formatMonthTitle(selectedDate)}</div>
              </div>
              <div className="text-right text-sm opacity-70">Week starts Monday</div>
            </div>
            <div className="mb-4 text-sm opacity-70">
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

          <section className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Month</h2>
                <div className="text-sm opacity-70">{formatMonthTitle(selectedDate)}</div>
              </div>
              <div className="text-right text-sm opacity-70">
                <div>Week starts Monday</div>
                <div className="text-xs opacity-70">
                  Legend: X active • +Y new • Z due
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="mb-3 grid min-w-[42rem] grid-cols-7 gap-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="px-2 text-xs uppercase tracking-wide opacity-60"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid min-w-[42rem] grid-cols-7 gap-2">
                {monthDays.map((day) => (
                  <button
                    key={day.key}
                    className={`min-h-24 rounded-md border p-3 text-left hover:bg-white/10 ${
                      day.openNewCount > 0
                        ? "border-emerald-300/40"
                        : day.openDueCount > 0
                          ? "border-amber-300/40"
                          : "border-white/10"
                    } ${day.isCurrentMonth ? "bg-black/10" : "bg-black/5 opacity-50"}`}
                    type="button"
                    onClick={() => jumpToDay(day.dateValue)}
                  >
                    <div className="text-sm font-semibold">{day.date.getDate()}</div>
                    <div className="mt-3 text-sm opacity-70">
                      {day.openActiveCount} active
                    </div>
                    {day.openNewCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-100">
                        +{day.openNewCount} new
                      </div>
                    )}
                    {day.openDueCount > 0 && (
                      <div className="mt-1 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
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
        <section className="rounded-md border border-white/10 bg-white/5 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tasks</h2>
              <div className="text-sm opacity-70">
                {searchActive
                  ? `Profile-wide search anchored to ${formatLongDate(selectedDay)}`
                  : `Grouped by project for ${formatLongDate(selectedDay)}`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="opacity-70">Search</span>
                <div className="relative">
                  <input
                    className="rounded-md border border-white/10 bg-transparent px-3 py-2 pr-9 outline-none"
                    placeholder="Title, category, notes"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm px-1 text-sm opacity-70 transition-opacity hover:opacity-100"
                      type="button"
                      onClick={clearSearch}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={showArchived}
                  type="checkbox"
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                <span>{searchActive ? "Include archived" : "Show archived"}</span>
              </label>
              <button
                className={`rounded-md border px-3 py-2 text-sm ${
                  selectMode ? "border-white bg-white text-black" : "border-white/10"
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
                {selectMode ? "Done Selecting" : "Select"}
              </button>
            </div>
          </div>

          {searchActive ? (
            <div className="mb-4 text-sm opacity-70">
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
                      openFilter === option.value
                        ? "border-white bg-white text-black"
                        : "border-white/10"
                    }`}
                    type="button"
                    onClick={() => setOpenFilter(option.value)}
                  >
                    Open: {option.label}
                  </button>
                ))}
                <select
                  className="rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm outline-none"
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

              <div className="mb-4 text-sm opacity-70">
                Showing {dayOpenTasks.length} open and {dayDoneTasks.length} done task
                {(dayOpenTasks.length + dayDoneTasks.length) === 1 ? "" : "s"}.
              </div>
            </>
          )}

          {selectMode && (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm opacity-70">
                  {selectedTaskIds.length === 0
                    ? "Select tasks to apply bulk actions."
                    : `${selectedTaskIds.length} task${selectedTaskIds.length === 1 ? "" : "s"} selected.`}
                </div>
                {selectedTaskIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-white/10 px-3 py-1 text-sm"
                      disabled={bulkSaving}
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
                      className="rounded-md border border-white/10 px-3 py-1 text-sm"
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => requestBulkAction({ action: "mark-open" })}
                    >
                      Mark open
                    </button>
                    <button
                      className="rounded-md border border-white/10 px-3 py-1 text-sm"
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => {
                        setBulkProjectValue("");
                        setBulkProjectModalOpen(true);
                      }}
                    >
                      Move to project
                    </button>
                    <button
                      className="rounded-md border border-white/10 px-3 py-1 text-sm"
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
                      className="rounded-md border border-white/10 px-3 py-1 text-sm"
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => {
                        setBulkDateValue(selectedDay);
                        setBulkDateModal("startDate");
                      }}
                    >
                      Set start date
                    </button>
                    <button
                      className="rounded-md border border-white/10 px-3 py-1 text-sm"
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => {
                        setBulkDateValue(selectedDay);
                        setBulkDateModal("dueAt");
                      }}
                    >
                      Set due date
                    </button>
                    <button
                      className="rounded-md border border-white/10 px-3 py-1 text-sm"
                      disabled={bulkSaving}
                      type="button"
                      onClick={() => requestBulkAction({ action: "clear-due-date" })}
                    >
                      Clear due date
                    </button>
                    <button
                      className="rounded-md border border-red-500/30 px-3 py-1 text-sm text-red-200"
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
              <section className="rounded-xl border border-white/10 bg-black/10 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Projects</h3>
                    <div className="text-sm opacity-60">
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
                    <div className="mb-2 text-sm font-medium opacity-80">Active Projects</div>
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
                      <div className="mb-2 text-sm font-medium opacity-80">
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
                  className="rounded-xl border border-white/10 bg-black/10 p-4"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{section.label}</h3>
                      <div className="text-sm opacity-60">
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
                        : "border-white/10 bg-black/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{section.label}</h3>
                          {section.project?.archived && (
                            <span className="rounded-full border border-amber-200/20 bg-amber-100/10 px-2 py-0.5 text-xs text-amber-100/90">
                              Archived
                            </span>
                          )}
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs opacity-70">
                            {section.openTasks.length} open / {section.doneTasks.length} done
                          </span>
                        </div>
                        <div className="mt-1 text-sm opacity-60">{subtitle}</div>
                        {section.project && (
                          <div className="mt-3 max-w-md">
                            <div className="mb-2 flex items-center justify-between text-xs opacity-70">
                              <span>Day progress</span>
                              <span>
                                {section.progressCompleted} / {section.progressTotal}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full transition-[width] ${
                                  section.project.archived ? "bg-amber-100/70" : "bg-white"
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
                              className="rounded-md border border-white/10 px-3 py-1 text-sm"
                              type="button"
                              onClick={() => void toggleProjectCollapsed(section.project)}
                            >
                              {section.project.collapsed ? "Expand" : "Collapse"}
                            </button>
                            <button
                              className="rounded-md border border-white/10 px-3 py-1 text-sm"
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
        <div className="space-y-6">
          <section className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">View Options</h2>
                <div className="text-sm opacity-70">
                  Calendar indicators and task lists use the same archived filter.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="opacity-70">Average basis</span>
                  <select
                    className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={showArchived}
                    type="checkbox"
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  <span>Show archived</span>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Open</h2>
              <div className="flex flex-wrap gap-2">
                {OPEN_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-md border px-3 py-1 text-sm ${
                      openFilter === option.value
                        ? "border-white bg-white text-black"
                        : "border-white/10"
                    }`}
                    type="button"
                    onClick={() => setOpenFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 text-sm opacity-70">
              Showing {openTasks.length} task{openTasks.length === 1 ? "" : "s"} for{" "}
              {nonDayOpenListLabel}
            </div>
            {openFilter === "today" && (
              <div className="mb-3 text-xs opacity-60">
                Today includes tasks that start today or are due today.
              </div>
            )}

            {loading ? (
              <div className="text-sm opacity-60">Loading tasks…</div>
            ) : openTasks.length === 0 ? (
              <div className="text-sm opacity-60">No matching open tasks.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left opacity-70">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Task</th>
                      <th className="pb-2 pr-4 font-medium">Project</th>
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium">Due</th>
                      <th className="pb-2 pr-4 font-medium">Start</th>
                      <th className="pb-2 pr-4 font-medium">Done</th>
                      <th className="pb-2 font-medium">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openTasks.map((task) => (
                      <tr key={task.id} className="border-t border-white/10">
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{task.title}</span>
                            {showStartChipInTables && (
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs opacity-70">
                                Start: {formatShortDate(toDateOnly(task.startDate))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">{getTaskProjectLabel(task, projectById)}</td>
                        <td className="py-3 pr-4">{task.category ?? "—"}</td>
                        <td className="py-3 pr-4">{toDateOnly(task.dueAt) || "—"}</td>
                        <td className="py-3 pr-4">{toDateOnly(task.startDate)}</td>
                        <td className="py-3 pr-4">
                          <input
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
                        <td className="py-3">
                          <button
                            className="rounded-md border border-white/10 px-3 py-1"
                            type="button"
                            onClick={() => requestDeleteTask(task)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Done</h2>
              <label className="flex items-center gap-2 text-sm">
                <span className="opacity-70">Range</span>
                <select
                  className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
                  value={doneRange}
                  onChange={(e) => setDoneRange(e.target.value as DoneRange)}
                >
                  {DONE_RANGE_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="text-black"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <div className="text-sm opacity-60">Loading tasks…</div>
            ) : doneTasks.length === 0 ? (
              <div className="text-sm opacity-60">No completed tasks in this range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left opacity-70">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Task</th>
                      <th className="pb-2 pr-4 font-medium">Project</th>
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium">Due</th>
                      <th className="pb-2 pr-4 font-medium">Start</th>
                      <th className="pb-2 pr-4 font-medium">Done On</th>
                      <th className="pb-2 font-medium">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doneTasks.map((task) => (
                      <tr key={task.id} className="border-t border-white/10 opacity-80">
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{task.title}</span>
                            {showStartChipInTables && (
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs opacity-70">
                                Start: {formatShortDate(toDateOnly(task.startDate))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">{getTaskProjectLabel(task, projectById)}</td>
                        <td className="py-3 pr-4">{task.category ?? "—"}</td>
                        <td className="py-3 pr-4">{toDateOnly(task.dueAt) || "—"}</td>
                        <td className="py-3 pr-4">{toDateOnly(task.startDate)}</td>
                        <td className="py-3 pr-4">{toDateOnly(task.completedOn)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <input
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
                            <button
                              className="rounded-md border border-white/10 px-3 py-1"
                              type="button"
                              onClick={() => requestDeleteTask(task)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

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
            <div className="text-sm opacity-70">
              Recurring tasks are selected. Choose how broadly this action should apply.
            </div>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3">
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
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3">
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
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <input
                  checked={bulkActionScope === "series"}
                  disabled={bulkSaving}
                  name="bulk-scope"
                  type="radio"
                  value="series"
                  onChange={() => setBulkActionScope("series")}
                />
                <div className="font-medium text-red-200">Entire series</div>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-white/10 px-4 py-2 text-sm"
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
                className="rounded-md bg-white px-4 py-2 text-sm text-black disabled:opacity-50"
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
            <div className="opacity-70">Project</div>
            <select
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
            className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
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
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            placeholder="Category"
            suggestions={categorySuggestions}
            value={bulkCategoryValue}
            onChange={(e) => setBulkCategoryValue(e.target.value)}
          />
          <button
            className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
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
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              required
              value={bulkDateValue}
              onChange={(e) => setBulkDateValue(e.target.value)}
            />
            <button
              className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
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
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3">
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
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3">
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
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <input
                  checked={deleteTaskMode === "series"}
                  disabled={deleteTaskSaving}
                  name="delete-mode"
                  type="radio"
                  value="series"
                  onChange={() => setDeleteTaskMode("series")}
                />
                <div>
                  <div className="font-medium text-red-200">Entire series</div>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-white/10 px-4 py-2 text-sm"
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
                  deleteTaskMode === "series"
                    ? "bg-red-500 text-white"
                    : "bg-white text-black"
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
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            placeholder="Project name"
            value={newProjectForm.name}
            onChange={(e) =>
              setNewProjectForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <DateInput
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              value={newProjectForm.startDate}
              onChange={(e) =>
                setNewProjectForm((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
            <DateInput
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              value={newProjectForm.dueAt}
              onChange={(e) =>
                setNewProjectForm((prev) => ({ ...prev, dueAt: e.target.value }))
              }
            />
          </div>
          <input
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            placeholder="Category"
            value={newProjectForm.category}
            onChange={(e) =>
              setNewProjectForm((prev) => ({ ...prev, category: e.target.value }))
            }
          />
          <button
            className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
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
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
                <div className="opacity-70">Start date</div>
                <DateInput
                  className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
                <div className="opacity-70">Due date</div>
                <DateInput
                  className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              placeholder="Category"
              suggestions={categorySuggestions}
              value={editTaskForm.category}
              onChange={(e) =>
                setEditTaskForm((prev) =>
                  prev ? { ...prev, category: e.target.value } : prev
                )
              }
            />
            <textarea
              className="min-h-28 w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              placeholder="Notes"
              value={editTaskForm.notes}
              onChange={(e) =>
                setEditTaskForm((prev) =>
                  prev ? { ...prev, notes: e.target.value } : prev
                )
              }
            />
            <label className="space-y-1 text-sm">
              <div className="opacity-70">Project</div>
              <select
                className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
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
              className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
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
