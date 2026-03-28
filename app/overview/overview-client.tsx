"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

type OverviewProject = {
  id: string;
  name: string;
  archived: boolean;
};

type OverviewTask = {
  id: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  category: string | null;
  startDate: string;
  dueAt: string;
  createdAt: string;
  orderIndex: number | null;
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

type QuickAddState = {
  title: string;
  category: string;
  projectId: string;
};

type TaskGroup = {
  key: string;
  label: string;
  taskCount: number;
  tasks: OverviewTask[];
};

const cardClass = "tm-card rounded-[12px] border p-4 shadow-sm md:p-5";
const inputClass =
  "tm-input h-9 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button-primary inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50";

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

function createEmptyQuickAddState(): QuickAddState {
  return {
    title: "",
    category: "",
    projectId: "",
  };
}

function isTaskOverdue(dueAt: string) {
  if (!dueAt) return false;
  return dueAt < todayInputValue();
}

function ProfileCard({ profile }: { profile: OverviewProfileData }) {
  const [openTasks, setOpenTasks] = useState(profile.openTasks);
  const [counts, setCounts] = useState(profile.counts);
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(createEmptyQuickAddState);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [categorySuggestions, setCategorySuggestions] = useState(profile.categorySuggestions);
  const projectNameById = useMemo(
    () => new Map(profile.projects.map((project) => [project.id, project.name])),
    [profile.projects]
  );

  const visibleTasks = useMemo(() => {
    if (showAll) return openTasks;
    return openTasks.slice(0, profile.initialTaskLimit);
  }, [openTasks, profile.initialTaskLimit, showAll]);

  const taskCountByGroupKey = useMemo(() => {
    const countsByGroup = new Map<string, number>();

    for (const task of openTasks) {
      const groupKey = task.projectId ? `project:${task.projectId}` : "unassigned";
      countsByGroup.set(groupKey, (countsByGroup.get(groupKey) ?? 0) + 1);
    }

    return countsByGroup;
  }, [openTasks]);

  const groupedVisibleTasks = useMemo(() => {
    const groups = new Map<string, TaskGroup>();

    for (const task of visibleTasks) {
      const groupKey = task.projectId ? `project:${task.projectId}` : "unassigned";
      const label = task.projectId
        ? task.projectName ?? projectNameById.get(task.projectId) ?? "Unknown project"
        : "Unassigned";

      const existing = groups.get(groupKey);
      if (existing) {
        existing.tasks.push(task);
        continue;
      }

      groups.set(groupKey, {
        key: groupKey,
        label,
        taskCount: taskCountByGroupKey.get(groupKey) ?? 0,
        tasks: [task],
      });
    }

    return Array.from(groups.values());
  }, [projectNameById, taskCountByGroupKey, visibleTasks]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = quickAdd.title.trim();
    if (!title || saving) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/p/${profile.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startDate: todayInputValue(),
          category: quickAdd.category.trim() || null,
          projectId: quickAdd.projectId || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create task");
      }

      const createdTask = (await res.json()) as {
        id: string;
        title: string;
        startDate: string;
        dueAt: string | null;
        category: string | null;
        createdAt: string;
        orderIndex: number | null;
        projectId: string | null;
      };

      const projectName = createdTask.projectId
        ? profile.projects.find((projectOption) => projectOption.id === createdTask.projectId)
            ?.name ?? null
        : null;

      const nextTask: OverviewTask = {
        id: createdTask.id,
        title: createdTask.title,
        projectId: createdTask.projectId,
        projectName,
        category: createdTask.category,
        startDate: toDateOnly(createdTask.startDate),
        dueAt: toDateOnly(createdTask.dueAt),
        createdAt: createdTask.createdAt,
        orderIndex: createdTask.orderIndex,
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

      setQuickAdd(createEmptyQuickAddState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={cardClass}>
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
          <form onSubmit={onSubmit} className="mt-4 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              className={inputClass}
              placeholder="Add task title"
              value={quickAdd.title}
              onChange={(e) => setQuickAdd((prev) => ({ ...prev, title: e.target.value }))}
            />

            <>
              <input
                className={inputClass}
                placeholder="Category"
                list={`overview-categories-${profile.id}`}
                value={quickAdd.category}
                onChange={(e) => setQuickAdd((prev) => ({ ...prev, category: e.target.value }))}
              />
              <datalist id={`overview-categories-${profile.id}`}>
                {categorySuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </>

            <select
              className={inputClass}
              value={quickAdd.projectId}
              onChange={(e) => setQuickAdd((prev) => ({ ...prev, projectId: e.target.value }))}
            >
              <option value="">No project</option>
              {profile.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.archived ? " (Archived)" : ""}
                </option>
              ))}
            </select>

            <button type="submit" className={buttonClass} disabled={saving || !quickAdd.title.trim()}>
              {saving ? "Adding…" : "Add"}
            </button>
          </form>

          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

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
                      No open tasks.
                    </td>
                  </tr>
                ) : (
                  groupedVisibleTasks.map((group) => {
                    const isGroupCollapsed = collapsedGroups[group.key] ?? false;

                    return (
                      <Fragment key={group.key}>
                        <tr className="border-b border-[color:var(--tm-border)] bg-white/30">
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
                              className="tm-table-row border-b border-[color:var(--tm-border)] align-top"
                            >
                              <td className="px-2 py-2.5 font-medium">{task.title}</td>
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

          {openTasks.length > profile.initialTaskLimit && (
            <div className="mt-3">
              <button
                type="button"
                className="tm-button inline-flex h-8 items-center justify-center rounded-[10px] border px-3 text-sm"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll ? "Show less" : `Show more (${openTasks.length - profile.initialTaskLimit})`}
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export function OverviewClient({ profiles }: OverviewClientProps) {
  const [query, setQuery] = useState("");

  const filteredProfiles = useMemo(() => {
    const trimmedQuery = query.trim().toLocaleLowerCase();
    if (!trimmedQuery) return profiles;

    return profiles.filter((profile) =>
      profile.name.toLocaleLowerCase().includes(trimmedQuery)
    );
  }, [profiles, query]);

  return (
    <main className="min-h-screen bg-[color:var(--tm-bg)] text-[color:var(--tm-text)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
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

        <div className="mt-4">
          <input
            className={`${inputClass} w-full md:max-w-sm`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter profiles by name"
          />
        </div>

        <section className="mt-6 space-y-4">
          {filteredProfiles.length === 0 ? (
            <div className="tm-card rounded-[12px] border p-4 text-sm text-[color:var(--tm-muted)]">
              No profiles match this filter.
            </div>
          ) : (
            filteredProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
          )}
        </section>
      </div>
    </main>
  );
}
