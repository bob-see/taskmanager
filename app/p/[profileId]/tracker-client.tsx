"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  name: string;
};

type Task = {
  id: string;
  title: string;
  startDate: string;
  dueAt: string | null;
  completedAt: string | null;
  category: string | null;
  notes: string | null;
  projectId: string | null;
  createdAt: string;
};

type TrackerClientProps = {
  profileId: string;
  profileName: string;
};

type TaskFormState = {
  title: string;
  startDate: string;
  dueAt: string;
  category: string;
};

type ViewMode = "day" | "week" | "month";
type OpenFilter = "all-active" | "today" | "upcoming" | "overdue";
type DoneRange = "today" | "week" | "month" | "all";

type CalendarDay = {
  key: string;
  date: Date;
  dateValue: string;
  isCurrentMonth: boolean;
  openActiveCount: number;
  openNewCount: number;
  openDueCount: number;
};

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const normalizedMonth =
    ((targetMonthIndex % 12) + 12) % 12;
  const maxDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(dayOfMonth, maxDay));
}

function toDateOnly(value: string | null) {
  return value ? dateInputValue(new Date(value)) : "";
}

function formatLongDate(value: string) {
  return parseDateOnly(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getStartOfWeek(date: Date) {
  const currentDay = date.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  return addDays(date, diff);
}

function getEndOfWeek(date: Date) {
  return addDays(getStartOfWeek(date), 6);
}

function getStartOfMonthGrid(date: Date) {
  return getStartOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
}

function getEndOfMonthGrid(date: Date) {
  return addDays(
    getStartOfWeek(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    6
  );
}

function isTaskActiveOnDate(task: Task, dateValue: string) {
  return toDateOnly(task.startDate) <= dateValue;
}

function isOpenActiveOnDate(task: Task, dateValue: string) {
  return !task.completedAt && isTaskActiveOnDate(task, dateValue);
}

function isOpenTaskNewOnDate(task: Task, dateValue: string) {
  return !task.completedAt && toDateOnly(task.startDate) === dateValue;
}

function isOpenTaskDueOnDate(task: Task, dateValue: string) {
  return !task.completedAt && toDateOnly(task.dueAt) === dateValue;
}

function buildCalendarDays(tasks: Task[], start: Date, end: Date, month: number) {
  const days: CalendarDay[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const dateValue = dateInputValue(cursor);
    days.push({
      key: dateValue,
      date: new Date(cursor),
      dateValue,
      isCurrentMonth: cursor.getMonth() === month,
      openActiveCount: tasks.filter((task) => isOpenActiveOnDate(task, dateValue))
        .length,
      openNewCount: tasks.filter((task) => isOpenTaskNewOnDate(task, dateValue)).length,
      openDueCount: tasks.filter((task) => isOpenTaskDueOnDate(task, dateValue)).length,
    });
  }

  return days;
}

export function TrackerClient({
  profileId,
  profileName,
}: TrackerClientProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(todayInputValue);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [openFilter, setOpenFilter] = useState<OpenFilter>("all-active");
  const [doneRange, setDoneRange] = useState<DoneRange>("today");
  const [form, setForm] = useState<TaskFormState>({
    title: "",
    startDate: todayInputValue(),
    dueAt: "",
    category: "",
  });

  const refreshData = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      const [profilesRes, tasksRes] = await Promise.all([
        fetch("/api/profiles", { cache: "no-store" }),
        fetch(`/api/p/${profileId}/tasks`, { cache: "no-store" }),
      ]);

      if (!profilesRes.ok) {
        const body = await profilesRes.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not load profiles");
      }

      if (!tasksRes.ok) {
        const body = await tasksRes.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not load tasks");
      }

      const [profilesData, tasksData] = (await Promise.all([
        profilesRes.json(),
        tasksRes.json(),
      ])) as [Profile[], Task[]];

      setProfiles(profilesData);
      setTasks(tasksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tasks");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void refreshData();
  }, [profileId]);

  useEffect(() => {
    setForm({
      title: "",
      startDate: todayInputValue(),
      dueAt: "",
      category: "",
    });
    setSelectedDay(todayInputValue());
    setViewMode("day");
    setOpenFilter("all-active");
    setDoneRange("today");
  }, [profileId]);

  const currentProfileName =
    profiles.find((profile) => profile.id === profileId)?.name ?? profileName;
  const selectedDate = parseDateOnly(selectedDay);
  const weekStart = getStartOfWeek(selectedDate);
  const weekEnd = getEndOfWeek(selectedDate);
  const weekStartValue = dateInputValue(weekStart);
  const weekEndValue = dateInputValue(weekEnd);
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
  const monthStartValue = dateInputValue(monthStart);
  const monthEndValue = dateInputValue(monthEnd);

  const progressTotal = tasks.filter((task) => isTaskActiveOnDate(task, selectedDay)).length;
  const progressCompleted = tasks.filter(
    (task) => task.completedAt && isTaskActiveOnDate(task, selectedDay)
  ).length;
  const progressPercent =
    progressTotal === 0 ? 0 : Math.round((progressCompleted / progressTotal) * 100);

  const openTasks = tasks.filter((task) => {
    if (task.completedAt) return false;

    const startDate = toDateOnly(task.startDate);
    const dueDate = toDateOnly(task.dueAt);

    switch (openFilter) {
      case "all-active":
        return isTaskActiveOnDate(task, selectedDay);
      case "today":
        return startDate === selectedDay || dueDate === selectedDay;
      case "upcoming":
        return dueDate !== "" && dueDate > selectedDay;
      case "overdue":
        return dueDate !== "" && dueDate < selectedDay;
      default:
        return false;
    }
  });

  const doneTasks = tasks.filter((task) => {
    if (!task.completedAt) return false;

    const completedDate = toDateOnly(task.completedAt);

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

  const weekDays = buildCalendarDays(tasks, weekStart, weekEnd, selectedDate.getMonth());
  const monthDays = buildCalendarDays(
    tasks,
    getStartOfMonthGrid(selectedDate),
    getEndOfMonthGrid(selectedDate),
    selectedDate.getMonth()
  );

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
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create task");
      }

      const task = (await res.json()) as Task;
      setTasks((prev) => [task, ...prev]);
      setForm({
        title: "",
        startDate: todayInputValue(),
        dueAt: "",
        category: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
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

    const task = (await res.json()) as Task;
    setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
  }

  async function deleteTask(taskId: string) {
    setError(null);

    const res = await fetch(`/api/p/${profileId}/tasks/${taskId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not delete task");
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
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
            <input
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              type="date"
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

      <form
        onSubmit={createTask}
        className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      >
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          placeholder="+ Task"
          value={form.title}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, title: e.target.value }))
          }
        />
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          type="date"
          value={form.startDate}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, startDate: e.target.value }))
          }
        />
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          type="date"
          value={form.dueAt}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, dueAt: e.target.value }))
          }
        />
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          placeholder="Category"
          value={form.category}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, category: e.target.value }))
          }
        />
        <button
          className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          Save
        </button>
      </form>

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
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      )}

      {viewMode === "week" && (
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
      )}

      {viewMode === "month" && (
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
      )}

      <div className="space-y-6">
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
            {formatLongDate(selectedDay)}
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
                      <td className="py-3 pr-4">{task.title}</td>
                      <td className="py-3 pr-4">{task.category ?? "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.dueAt) || "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.startDate)}</td>
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() =>
                            void updateTask(task.id, { completed: true }).catch(
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
                          onClick={() =>
                            void deleteTask(task.id).catch((err: unknown) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not delete task"
                              )
                            )
                          }
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
                  <option key={option.value} value={option.value} className="text-black">
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
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Due</th>
                    <th className="pb-2 pr-4 font-medium">Start</th>
                    <th className="pb-2 pr-4 font-medium">Done At</th>
                    <th className="pb-2 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {doneTasks.map((task) => (
                    <tr key={task.id} className="border-t border-white/10 opacity-80">
                      <td className="py-3 pr-4">{task.title}</td>
                      <td className="py-3 pr-4">{task.category ?? "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.dueAt) || "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.startDate)}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.completedAt)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked
                            onChange={() =>
                              void updateTask(task.id, { completed: false }).catch(
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
                            onClick={() =>
                              void deleteTask(task.id).catch((err: unknown) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not delete task"
                                )
                              )
                            }
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
    </section>
  );
}
