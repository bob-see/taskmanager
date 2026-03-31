"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ProjectEditorModal,
  TaskEditorModal,
  createEditTaskForm,
  createProjectForm,
  type EditTaskFormState,
  type ProjectFormState,
  type RepeatPattern,
} from "@/app/components/editors";

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
  repeatDays: number | null;
  repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null;
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
};

type ReorderResponseProfile = {
  id: string;
};

type TaskDraftState = {
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

const cardClass = "tm-card rounded-[12px] border p-4 shadow-sm md:p-5";
const inputClass =
  "tm-input h-9 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button-primary inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50";
const ORDER_GAP = 10;
const modalChoiceClass = "tm-choice flex cursor-pointer items-start gap-3 rounded-lg border p-3";
const segmentedTabSetClass = "tm-tabset inline-flex rounded-full border p-1 text-sm";
const segmentedTabClass = "tm-tab rounded-full px-3 py-1.5";
const segmentedActiveTabClass = "tm-tab-active rounded-full px-3 py-1.5";

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateOnly(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
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

function createEmptyTaskDraftState(): TaskDraftState {
  return {
    title: "",
    category: "",
    projectId: "",
    startDate: todayInputValue(),
    dueAt: "",
  };
}

function createEmptyProjectDraftState(): ProjectDraftState {
  return createProjectForm();
}

function isTaskOverdue(dueAt: string) {
  if (!dueAt) return false;
  return dueAt < todayInputValue();
}

function matchesOverviewTaskFilter(
  task: OverviewTask,
  filter: OverviewTaskFilter,
  today: string
) {
  const startsToday = task.startDate === today;
  const dueToday = task.dueAt === today;
  const overdue = Boolean(task.dueAt) && task.dueAt < today;
  const startsInFuture = task.startDate > today;
  const dueInFuture = Boolean(task.dueAt) && task.dueAt > today;
  const activeOpen = !startsInFuture;
  const upcoming = startsInFuture || (dueInFuture && !activeOpen);

  if (filter === "today") {
    return startsToday || dueToday;
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
  return Boolean(task.recurrenceSeriesId);
}

function getOverviewTaskGroupKey(task: OverviewTask) {
  if (isRecurringOverviewTask(task)) {
    return "recurring";
  }

  return task.projectId ? `project:${task.projectId}` : "unassigned";
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
  selectedFilter: OverviewTaskFilter;
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
  selectedFilter,
  draggable = false,
  dragActive = false,
  dragOverPosition = null,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ProfileCardProps) {
  const router = useRouter();
  const [openTasks, setOpenTasks] = useState(profile.openTasks);
  const [projects, setProjects] = useState(profile.projects);
  const [counts, setCounts] = useState(profile.counts);
  const [taskDraft, setTaskDraft] = useState<TaskDraftState>(createEmptyTaskDraftState);
  const [projectDraft, setProjectDraft] = useState<ProjectDraftState>(createEmptyProjectDraftState);
  const [saving, setSaving] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<EditTaskFormState | null>(null);
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editProjectForm, setEditProjectForm] = useState<ProjectFormState | null>(null);
  const [editProjectSaving, setEditProjectSaving] = useState(false);
  const [taskReordering, setTaskReordering] = useState(false);
  const [projectReordering, setProjectReordering] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [deleteTaskSaving, setDeleteTaskSaving] = useState(false);
  const [deleteTaskModalTask, setDeleteTaskModalTask] = useState<OverviewTask | null>(null);
  const [deleteTaskMode, setDeleteTaskMode] = useState<DeleteMode>("this");
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
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
  const today = todayInputValue();
  const filteredOpenTasks = useMemo(
    () => openTasks.filter((task) => matchesOverviewTaskFilter(task, selectedFilter, today)),
    [openTasks, selectedFilter, today]
  );

  const taskCountByGroupKey = useMemo(() => {
    const countsByGroup = new Map<string, number>();

    for (const task of filteredOpenTasks) {
      const groupKey = getOverviewTaskGroupKey(task);
      countsByGroup.set(groupKey, (countsByGroup.get(groupKey) ?? 0) + 1);
    }

    return countsByGroup;
  }, [filteredOpenTasks]);

  const tasksByGroupKey = useMemo(() => {
    const groups = new Map<string, OverviewTask[]>();

    for (const task of [...filteredOpenTasks].sort(compareTasksForManualSort)) {
      const groupKey = getOverviewTaskGroupKey(task);
      const existing = groups.get(groupKey);

      if (existing) {
        existing.push(task);
      } else {
        groups.set(groupKey, [task]);
      }
    }

    return groups;
  }, [filteredOpenTasks]);

  const orderedProjectGroups = useMemo(() => {
    const groups: TaskGroup[] = [];
    const recurringTasks = tasksByGroupKey.get("recurring") ?? [];
    const unassignedTasks = tasksByGroupKey.get("unassigned") ?? [];

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
  }, [orderedProjects, projectNameById, taskCountByGroupKey, tasksByGroupKey]);

  const groupedVisibleTasks = useMemo(() => {
    const orderedTaskIds = orderedProjectGroups.flatMap((group) => group.tasks.map((task) => task.id));
    const visibleTaskIds = new Set(
      (showAll ? orderedTaskIds : orderedTaskIds.slice(0, profile.initialTaskLimit)).map((id) => id)
    );

    return orderedProjectGroups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => visibleTaskIds.has(task.id)),
      }))
      .filter((group) => group.tasks.length > 0);
  }, [orderedProjectGroups, profile.initialTaskLimit, showAll]);

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setTaskDraft(createEmptyTaskDraftState());
  }

  function closeProjectDialog() {
    if (projectSaving) return;
    setProjectDialogOpen(false);
    setProjectDraft(createEmptyProjectDraftState());
  }

  function closeTaskEditor() {
    if (editTaskSaving) return;
    setEditTaskId(null);
    setEditTaskForm(null);
  }

  function closeProjectEditor() {
    if (editProjectSaving) return;
    setEditProjectId(null);
    setEditProjectForm(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = taskDraft.title.trim();
    if (!title || saving) return;

    setSaving(true);

    try {
      const res = await fetch(`/api/p/${profile.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startDate: taskDraft.startDate || todayInputValue(),
          dueAt: taskDraft.dueAt || null,
          category: taskDraft.category.trim() || null,
          projectId: taskDraft.projectId || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create task");
      }

      const createdTask = (await res.json()) as {
        id: string;
        title: string;
        notes?: string | null;
        startDate: string;
        dueAt: string | null;
        category: string | null;
        createdAt: string;
        orderIndex: number | null;
        recurrenceSeriesId: string | null;
        projectId: string | null;
      };

      const projectName = createdTask.projectId
        ? projects.find((projectOption) => projectOption.id === createdTask.projectId)
            ?.name ?? null
        : null;

      const nextTask: OverviewTask = {
        id: createdTask.id,
        title: createdTask.title,
        notes: createdTask.notes ?? null,
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
        repeatEnabled: false,
        repeatPattern: null,
        repeatDays: null,
        repeatWeeklyDay: null,
        repeatMonthlyDay: null,
      };

      setOpenTasks((prev) => [...prev, nextTask].sort(compareTasksForManualSort));
      setCounts((prev) => ({
        ...prev,
        open: prev.open + 1,
        overdue: prev.overdue + (isTaskOverdue(nextTask.dueAt) ? 1 : 0),
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
      setTaskDraft(createEmptyTaskDraftState());
      router.refresh();
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

    setProjectSaving(true);

    try {
      const res = await fetch(`/api/p/${profile.id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate: projectDraft.startDate || todayInputValue(),
          dueAt: projectDraft.dueAt || null,
          category: projectDraft.category.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create project");
      }

      setProjectDialogOpen(false);
      setProjectDraft(createEmptyProjectDraftState());
      router.refresh();
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
    const group = orderedProjectGroups.find((item) => item.key === groupKey);
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

    const visibleProjectIds = orderedProjectGroups
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
      task?: {
        id: string;
        title: string;
        startDate: string;
        dueAt: string | null;
        category: string | null;
        notes: string | null;
        createdAt: string;
        orderIndex: number | null;
        projectId: string | null;
        completedOn: string | null;
        recurrenceSeriesId: string | null;
        repeatEnabled: boolean;
        repeatPattern: RepeatPattern | null;
        repeatDays: number | null;
        repeatWeeklyDay: number | null;
        repeatMonthlyDay: number | null;
        isPriority: boolean;
      };
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

  function removeTaskFromCard(task: OverviewTask) {
    setOpenTasks((prev) => prev.filter((item) => item.id !== task.id));
    setCounts((prev) => ({
      ...prev,
      open: Math.max(0, prev.open - 1),
      overdue: Math.max(0, prev.overdue - (isTaskOverdue(task.dueAt) ? 1 : 0)),
    }));
  }

  function requestDeleteTask(task: OverviewTask) {
    setContextMenu(null);

    if (!task.recurrenceSeriesId) {
      void handleDeleteTask(task);
      return;
    }

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

    setEditTaskSaving(true);

    try {
      const response = await patchTask(editTaskId, {
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
      const savedTask = response.task;

      if (savedTask) {
        setOpenTasks((prev) =>
          prev.map((item) =>
            item.id === editTaskId
              ? {
                  ...item,
                  title: savedTask.title,
                  notes: savedTask.notes,
                  category: savedTask.category,
                  startDate: toDateOnly(savedTask.startDate),
                  dueAt: toDateOnly(savedTask.dueAt),
                  orderIndex: savedTask.orderIndex,
                  projectId: savedTask.projectId,
                  projectName: savedTask.projectId
                    ? projectNameById.get(savedTask.projectId) ?? item.projectName
                    : null,
                  recurrenceSeriesId: savedTask.recurrenceSeriesId,
                  repeatEnabled: savedTask.repeatEnabled,
                  repeatPattern: savedTask.repeatPattern,
                  repeatDays: savedTask.repeatDays,
                  repeatWeeklyDay: savedTask.repeatWeeklyDay,
                  repeatMonthlyDay: savedTask.repeatMonthlyDay,
                  isPriority: savedTask.isPriority,
                  completedOn: toDateOnly(savedTask.completedOn),
                }
              : item
          )
        );
      }

      closeTaskEditor();
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update task");
    } finally {
      setEditTaskSaving(false);
    }
  }

  async function handleToggleTask(task: OverviewTask, completed: boolean) {
    setContextMenu(null);
    setBusyAction(true);

    try {
      await patchTask(task.id, {
        completed,
        completedOn: completed ? todayInputValue() : null,
      });

      if (completed) {
        setOpenTasks((prev) => prev.filter((item) => item.id !== task.id));
        setCounts((prev) => ({
          ...prev,
          open: Math.max(0, prev.open - 1),
          done: prev.done + 1,
          overdue: Math.max(0, prev.overdue - (isTaskOverdue(task.dueAt) ? 1 : 0)),
        }));
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update task");
    } finally {
      setBusyAction(false);
    }
  }

  async function handleDeleteTask(task: OverviewTask) {
    setBusyAction(true);

    try {
      if (!window.confirm(`Delete task "${task.title}"?`)) {
        return;
      }

      await deleteTask(task.id);
      removeTaskFromCard(task);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete task");
    } finally {
      setBusyAction(false);
    }
  }

  async function handleDeleteRecurringTask(task: OverviewTask, mode: DeleteMode) {
    setDeleteTaskSaving(true);

    try {
      await deleteTask(task.id, mode);
      if (mode === "this") {
        removeTaskFromCard(task);
      }
      setDeleteTaskModalTask(null);
      setDeleteTaskMode("this");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete task");
    } finally {
      setDeleteTaskSaving(false);
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
      router.refresh();
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
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not archive project");
    } finally {
      setBusyAction(false);
    }
  }

  async function handleToggleTaskPriority(task: OverviewTask) {
    setContextMenu(null);
    setBusyAction(true);

    try {
      await patchTask(task.id, { isPriority: !task.isPriority });
      setOpenTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, isPriority: !item.isPriority } : item
        )
      );
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update task");
    } finally {
      setBusyAction(false);
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
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update project");
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <article
      className={`${cardClass} h-full transition ${
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{profile.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--tm-muted)]">
            <span className="tm-chip rounded-full border px-2 py-0.5">Open {counts.open}</span>
            <span className="tm-chip rounded-full border px-2 py-0.5">Done {counts.done}</span>
            <span className="tm-chip rounded-full border px-2 py-0.5">
              Overdue {counts.overdue}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
            onClick={() => setDialogOpen(true)}
          >
            Add Task
          </button>
          <button
            type="button"
            className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
            onClick={() => setProjectDialogOpen(true)}
          >
            Add Project
          </button>
          <button
            type="button"
            className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <Link
            href={`/p/${profile.id}`}
            className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
          >
            Open tracker
          </Link>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {groupedVisibleTasks.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-sm text-[color:var(--tm-muted)]" colSpan={4}>
                      {selectedFilter === "all-open" ? "No open tasks." : "No matching tasks"}
                    </td>
                  </tr>
                ) : (
                  groupedVisibleTasks.map((group) => {
                    const isGroupCollapsed = collapsedGroups[group.key] ?? false;
                    const isProjectGroup = !group.isUnassigned && Boolean(group.projectId);
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
                          <td colSpan={4} className="px-2 py-2">
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
                              <span className="text-[color:var(--tm-muted)]">({group.taskCount})</span>
                            </button>
                          </td>
                        </tr>
                        {!isGroupCollapsed &&
                          group.tasks.map((task) => (
                            <tr
                              key={task.id}
                              className={`tm-table-row border-b border-[color:var(--tm-border)] align-top ${
                                task.isPriority
                                  ? "bg-[rgba(243,225,220,0.82)] shadow-[inset_4px_0_0_0_rgba(183,122,116,0.78)]"
                                  : ""
                              } ${
                                taskReordering ? "cursor-grabbing" : "cursor-grab"
                              } ${
                                draggedTaskId === task.id ? "opacity-60" : ""
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
                              <td className="group relative px-2 py-2.5 font-medium">
                                <span>{task.title}</span>
                                {task.notes?.trim() && (
                                  <div className="pointer-events-none absolute left-2 top-full z-20 mt-1 hidden max-h-48 w-[min(320px,calc(100vw-3rem))] overflow-hidden whitespace-pre-wrap rounded-[12px] border border-[color:var(--tm-border)] bg-[color:var(--tm-card)] px-3 py-2 text-xs font-normal leading-5 text-[color:var(--tm-text)] shadow-xl group-hover:block">
                                    {task.notes.trim()}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-[color:var(--tm-muted)]">
                                {task.category ?? "—"}
                              </td>
                              <td className="px-2 py-2.5 text-[color:var(--tm-muted)]">
                                {task.startDate}
                              </td>
                              <td className="px-2 py-2.5 text-[color:var(--tm-muted)]">
                                {task.dueAt || "—"}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredOpenTasks.length > profile.initialTaskLimit && (
            <div className="mt-3">
              <button
                type="button"
                className="tm-button inline-flex h-8 items-center justify-center rounded-[10px] border px-3 text-sm"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll
                  ? "Show less"
                  : `Show more (${filteredOpenTasks.length - profile.initialTaskLimit})`}
              </button>
            </div>
          )}
        </>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
          onClick={closeDialog}
        >
          <div
            className="tm-card w-full max-w-lg rounded-[16px] border p-5 shadow-xl md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Add Task</h3>
                <p className="mt-1 text-sm text-[color:var(--tm-muted)]">{profile.name}</p>
              </div>
              <button
                type="button"
                className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor={`overview-task-title-${profile.id}`}>
                  Title
                </label>
                <input
                  id={`overview-task-title-${profile.id}`}
                  className={`${inputClass} w-full`}
                  placeholder="Task title"
                  value={taskDraft.title}
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor={`overview-task-category-${profile.id}`}>
                  Category
                </label>
                <input
                  id={`overview-task-category-${profile.id}`}
                  className={`${inputClass} w-full`}
                  placeholder="Optional category"
                  list={`overview-categories-${profile.id}`}
                  value={taskDraft.category}
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, category: event.target.value }))
                  }
                />
                <datalist id={`overview-categories-${profile.id}`}>
                  {categorySuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor={`overview-task-project-${profile.id}`}>
                  Project
                </label>
                <select
                  id={`overview-task-project-${profile.id}`}
                  className={`${inputClass} w-full`}
                  value={taskDraft.projectId}
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, projectId: event.target.value }))
                  }
                >
                  <option value="">No project</option>
                  {orderedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.archived ? " (Archived)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor={`overview-task-start-${profile.id}`}>
                    Start date
                  </label>
                  <input
                    id={`overview-task-start-${profile.id}`}
                    type="date"
                    className={`${inputClass} w-full`}
                    value={taskDraft.startDate}
                    onChange={(event) =>
                      setTaskDraft((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor={`overview-task-due-${profile.id}`}>
                    Due date
                  </label>
                  <input
                    id={`overview-task-due-${profile.id}`}
                    type="date"
                    className={`${inputClass} w-full`}
                    value={taskDraft.dueAt}
                    onChange={(event) =>
                      setTaskDraft((prev) => ({ ...prev, dueAt: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                  onClick={closeDialog}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={buttonClass}
                  disabled={saving || !taskDraft.title.trim()}
                >
                  {saving ? "Saving…" : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      <TaskEditorModal
        open={Boolean(editTaskId && editTaskForm)}
        form={editTaskForm}
        saving={editTaskSaving}
        categorySuggestions={categorySuggestions}
        projectOptions={projectOptions}
        onClose={closeTaskEditor}
        onSubmit={submitTaskEditor}
        onFormChange={(updater) =>
          setEditTaskForm((prev) => (prev ? updater(prev) : prev))
        }
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

      {deleteTaskModalTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
          onClick={() => {
            if (deleteTaskSaving) return;
            setDeleteTaskModalTask(null);
            setDeleteTaskMode("this");
          }}
        >
          <div
            className="tm-card w-full max-w-lg rounded-[16px] border p-5 shadow-xl md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Delete recurring task</h3>
              <button
                type="button"
                className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                onClick={() => {
                  if (deleteTaskSaving) return;
                  setDeleteTaskModalTask(null);
                  setDeleteTaskMode("this");
                }}
                disabled={deleteTaskSaving}
              >
                Close
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleDeleteRecurringTask(deleteTaskModalTask, deleteTaskMode);
              }}
            >
              <div className="space-y-2">
                <label className={modalChoiceClass}>
                  <input
                    checked={deleteTaskMode === "this"}
                    disabled={deleteTaskSaving}
                    name={`overview-delete-mode-${profile.id}`}
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
                    name={`overview-delete-mode-${profile.id}`}
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
                    name={`overview-delete-mode-${profile.id}`}
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
                  type="button"
                  className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                  onClick={() => {
                    if (deleteTaskSaving) return;
                    setDeleteTaskModalTask(null);
                    setDeleteTaskMode("this");
                  }}
                  disabled={deleteTaskSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`rounded-[10px] border px-3 text-sm disabled:opacity-50 ${
                    deleteTaskMode === "series" ? "tm-button-danger" : "tm-button-primary"
                  } inline-flex h-9 items-center justify-center`}
                  disabled={deleteTaskSaving}
                >
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contextMenu && (
        (() => {
          const maxX =
            typeof window === "undefined" ? contextMenu.x : Math.max(12, window.innerWidth - 196);
          const maxY =
            typeof window === "undefined" ? contextMenu.y : Math.max(12, window.innerHeight - 160);

          return (
        <div
          className="fixed z-[60] min-w-[180px] rounded-[12px] border border-[color:var(--tm-border)] bg-[color:var(--tm-bg)] p-1.5 shadow-xl"
          style={{
            left: Math.min(contextMenu.x, maxX),
            top: Math.min(contextMenu.y, maxY),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.type === "task" ? (
            <>
              <button
                type="button"
                className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm hover:bg-white/60 disabled:opacity-50"
                onClick={() => openTaskEditor(contextMenu.task)}
                disabled={busyAction || editTaskSaving || editProjectSaving}
              >
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm hover:bg-white/60 disabled:opacity-50"
                onClick={() =>
                  void handleToggleTask(contextMenu.task, !Boolean(contextMenu.task.completedOn))
                }
                disabled={busyAction}
              >
                {contextMenu.task.completedOn ? "Open" : "Done"}
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                onClick={() => requestDeleteTask(contextMenu.task)}
                disabled={busyAction}
              >
                Delete
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm hover:bg-white/60 disabled:opacity-50"
                onClick={() => void handleToggleTaskPriority(contextMenu.task)}
                disabled={busyAction}
              >
                {contextMenu.task.isPriority ? "Unprioritise" : "Prioritise"}
              </button>
            </>
          ) : (
            <>
              {contextMenu.group.projectId && (
                <button
                  type="button"
                  className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm hover:bg-white/60 disabled:opacity-50"
                  onClick={() => openProjectEditor(contextMenu.group)}
                  disabled={busyAction || editTaskSaving || editProjectSaving}
                >
                  Edit
                </button>
              )}
              {!contextMenu.group.isUnassigned && (
                <button
                  type="button"
                  className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm hover:bg-white/60 disabled:opacity-50"
                  onClick={() => void handleArchiveProject(contextMenu.group)}
                  disabled={busyAction}
                >
                  Archive
                </button>
              )}
              {contextMenu.group.projectId && (
                <button
                  type="button"
                  className="flex w-full items-center rounded-[10px] px-3 py-2 text-left text-sm hover:bg-white/60 disabled:opacity-50"
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

export function OverviewClient({ profiles }: OverviewClientProps) {
  const [orderedProfiles, setOrderedProfiles] = useState(profiles);
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<OverviewTaskFilter>("all-open");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const filterOptions: Array<{ value: OverviewTaskFilter; label: string }> = [
    { value: "all-open", label: "All open" },
    { value: "today", label: "Today" },
    { value: "overdue", label: "Overdue" },
    { value: "upcoming", label: "Upcoming" },
  ];

  useEffect(() => {
    setOrderedProfiles(profiles);
  }, [profiles]);

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
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 xl:px-8 2xl:px-10 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Overview</h1>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              All profiles and their active tasks in one place.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
            >
              Profiles
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className={segmentedTabSetClass}>
            {filterOptions.map((option) => {
              const active = selectedFilter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={active ? segmentedActiveTabClass : segmentedTabClass}
                  onClick={() => setSelectedFilter(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <input
            className={`${inputClass} w-full lg:max-w-sm`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter profiles by name"
          />
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfiles.length === 0 ? (
            <div className="tm-card rounded-[12px] border p-4 text-sm text-[color:var(--tm-muted)] md:col-span-2 xl:col-span-3">
              No profiles match this filter.
            </div>
          ) : (
            filteredProfiles.map((profile, index) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                selectedFilter={selectedFilter}
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
