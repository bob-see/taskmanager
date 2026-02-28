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

type TaskFormState = {
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

type EditTaskFormState = {
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
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
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

function matchesTaskSearch(task: Task, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [task.title, task.category ?? "", task.notes ?? ""].some((value) =>
    value.toLowerCase().includes(normalized)
  );
}

function isTaskInArchivedProject(
  task: Task,
  projectById: Map<string, Project>
) {
  if (!task.projectId) return false;

  return projectById.get(task.projectId)?.archived ?? false;
}

function openDateInputPicker(input: HTMLInputElement) {
  const pickerInput = input as HTMLInputElement & {
    showPicker?: () => void;
  };

  pickerInput.showPicker?.();
}

function DateInput(props: React.ComponentPropsWithoutRef<"input">) {
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

function createEmptyProjectForm(): ProjectFormState {
  return {
    name: "",
    startDate: todayInputValue(),
    dueAt: "",
    category: "",
  };
}

function createEditTaskForm(task: Task): EditTaskFormState {
  return {
    title: task.title,
    startDate: toDateOnly(task.startDate) || todayInputValue(),
    dueAt: toDateOnly(task.dueAt),
    category: task.category ?? "",
    notes: task.notes ?? "",
    projectId: task.projectId ?? "",
  };
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
  children: React.ReactNode;
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
  editingTitleTaskId,
  editingTitleValue,
  onStartTitleEdit,
  onChangeTitleEdit,
  onCancelTitleEdit,
  onSaveTitleEdit,
  onOpenEditModal,
  onToggleCompleted,
  onDelete,
}: {
  task: Task;
  projectName?: string;
  projectArchived?: boolean;
  editingTitleTaskId: string | null;
  editingTitleValue: string;
  onStartTitleEdit: (task: Task) => void;
  onChangeTitleEdit: (value: string) => void;
  onCancelTitleEdit: () => void;
  onSaveTitleEdit: () => void;
  onOpenEditModal: (task: Task) => void;
  onToggleCompleted: (task: Task, completed: boolean) => void;
  onDelete: (taskId: string) => void;
}) {
  const isEditing = editingTitleTaskId === task.id;

  return (
    <div
      className={`rounded-lg border p-3 ${
        projectArchived
          ? "border-amber-300/20 bg-amber-200/5"
          : "border-white/10 bg-black/10"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
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
              <span className={task.completedAt ? "line-through opacity-70" : ""}>
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
            <span className="rounded-full border border-white/10 px-2 py-1">
              Category {task.category ?? "—"}
            </span>
            {projectName && (
              <span className="rounded-full border border-white/10 px-2 py-1">
                Project {projectName}
              </span>
            )}
            {task.completedAt && (
              <span className="rounded-full border border-white/10 px-2 py-1">
                Done {toDateOnly(task.completedAt)}
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
              checked={Boolean(task.completedAt)}
              onChange={(e) => onToggleCompleted(task, e.target.checked)}
            />
            <span>{task.completedAt ? "Done" : "Open"}</span>
          </label>
          <button
            className="rounded-md border border-white/10 px-3 py-1 text-sm"
            type="button"
            onClick={() => onDelete(task.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function TrackerClient({
  profileId,
  profileName,
}: TrackerClientProps) {
  const router = useRouter();
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
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectSaving, setNewProjectSaving] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [form, setForm] = useState<TaskFormState>({
    title: "",
    startDate: todayInputValue(),
    dueAt: "",
    category: "",
    projectId: "",
  });
  const [newProjectForm, setNewProjectForm] = useState<ProjectFormState>(
    createEmptyProjectForm
  );
  const [editTaskForm, setEditTaskForm] = useState<EditTaskFormState | null>(null);

  const refreshData = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
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

      setProfiles(profilesData);
      setTasks(tasksData);
      setProjects(projectsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tracker data");
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
      projectId: "",
    });
    setNewProjectForm(createEmptyProjectForm());
    setEditTaskForm(null);
    setEditTaskId(null);
    setEditingTitleTaskId(null);
    setEditingTitleValue("");
    setSelectedDay(todayInputValue());
    setViewMode("day");
    setOpenFilter("all-active");
    setDoneRange("today");
    setSearchQuery("");
    setShowArchived(false);
    setNewProjectOpen(false);
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

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const searchActive = searchQuery.trim().length > 0;
  const visibleProjects = projects.filter((project) => showArchived || !project.archived);
  const assignableProjects = projects.filter(
    (project) => showArchived || !project.archived
  );

  function isTaskVisibleInDayView(task: Task) {
    if (!task.projectId) return true;

    const project = projectById.get(task.projectId);
    return project ? showArchived || !project.archived : true;
  }

  const dayOpenTasks = openTasks.filter(
    (task) => isTaskVisibleInDayView(task) && matchesTaskSearch(task, searchQuery)
  );
  const dayDoneTasks = doneTasks.filter(
    (task) => isTaskVisibleInDayView(task) && matchesTaskSearch(task, searchQuery)
  );
  const searchResults = tasks.filter((task) => {
    if (!matchesTaskSearch(task, searchQuery)) return false;
    if (showArchived) return true;

    return !isTaskInArchivedProject(task, projectById);
  });
  const searchSections: SearchSection[] = [
    {
      key: "active",
      label: "Active",
      tasks: searchResults.filter(
        (task) => !task.completedAt && toDateOnly(task.startDate) <= selectedDay
      ),
    },
    {
      key: "upcoming",
      label: "Upcoming",
      tasks: searchResults.filter(
        (task) => !task.completedAt && toDateOnly(task.startDate) > selectedDay
      ),
    },
    {
      key: "complete",
      label: "Complete",
      tasks: searchResults.filter((task) => Boolean(task.completedAt)),
    },
  ];
  const searchResultCount = searchSections.reduce(
    (count, section) => count + section.tasks.length,
    0
  );

  function clearSearch() {
    setSearchQuery("");
  }

  const weekDays = buildCalendarDays(tasks, weekStart, weekEnd, selectedDate.getMonth());
  const monthDays = buildCalendarDays(
    tasks,
    getStartOfMonthGrid(selectedDate),
    getEndOfMonthGrid(selectedDate),
    selectedDate.getMonth()
  );

  const groupedSections = [
    ...visibleProjects.map((project) => ({
      key: project.id,
      label: project.name,
      project,
      collapsed: project.collapsed,
      openTasks: dayOpenTasks.filter((task) => task.projectId === project.id),
      doneTasks: dayDoneTasks.filter((task) => task.projectId === project.id),
      progressTotal: tasks.filter(
        (task) => task.projectId === project.id && isTaskActiveOnDate(task, selectedDay)
      ).length,
      progressCompleted: tasks.filter(
        (task) =>
          task.projectId === project.id &&
          Boolean(task.completedAt) &&
          isTaskActiveOnDate(task, selectedDay)
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
        projectId: "",
      });
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

    const task = (await res.json()) as Task;
    setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
    return task;
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

  function startTitleEdit(task: Task) {
    setEditingTitleTaskId(task.id);
    setEditingTitleValue(task.title);
  }

  function cancelTitleEdit() {
    setEditingTitleTaskId(null);
    setEditingTitleValue("");
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
          className="grid gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto]"
        >
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
          <input
            className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            placeholder="Category"
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

          {loading ? (
            <div className="text-sm opacity-60">Loading tasks…</div>
          ) : searchActive ? (
            <div className="space-y-4">
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
                          editingTitleTaskId={editingTitleTaskId}
                          editingTitleValue={editingTitleValue}
                          onStartTitleEdit={startTitleEdit}
                          onChangeTitleEdit={setEditingTitleValue}
                          onCancelTitleEdit={cancelTitleEdit}
                          onSaveTitleEdit={() => void saveTitleEdit()}
                          onOpenEditModal={openTaskEditor}
                          onToggleCompleted={(nextTask, completed) =>
                            void updateTask(nextTask.id, { completed }).catch(
                              (err: unknown) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not update task"
                                )
                            )
                          }
                          onDelete={(taskId) =>
                            void deleteTask(taskId).catch((err: unknown) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not delete task"
                              )
                            )
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
                                  editingTitleTaskId={editingTitleTaskId}
                                  editingTitleValue={editingTitleValue}
                                  onStartTitleEdit={startTitleEdit}
                                  onChangeTitleEdit={setEditingTitleValue}
                                  onCancelTitleEdit={cancelTitleEdit}
                                  onSaveTitleEdit={() => void saveTitleEdit()}
                                  onOpenEditModal={openTaskEditor}
                                  onToggleCompleted={(nextTask, completed) =>
                                    void updateTask(nextTask.id, { completed }).catch(
                                      (err: unknown) =>
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : "Could not update task"
                                        )
                                    )
                                  }
                                  onDelete={(taskId) =>
                                    void deleteTask(taskId).catch((err: unknown) =>
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : "Could not delete task"
                                      )
                                    )
                                  }
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
                                  editingTitleTaskId={editingTitleTaskId}
                                  editingTitleValue={editingTitleValue}
                                  onStartTitleEdit={startTitleEdit}
                                  onChangeTitleEdit={setEditingTitleValue}
                                  onCancelTitleEdit={cancelTitleEdit}
                                  onSaveTitleEdit={() => void saveTitleEdit()}
                                  onOpenEditModal={openTaskEditor}
                                  onToggleCompleted={(nextTask, completed) =>
                                    void updateTask(nextTask.id, { completed }).catch(
                                      (err: unknown) =>
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : "Could not update task"
                                        )
                                    )
                                  }
                                  onDelete={(taskId) =>
                                    void deleteTask(taskId).catch((err: unknown) =>
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : "Could not delete task"
                                      )
                                    )
                                  }
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
      )}

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
            <input
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
              placeholder="Category"
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
