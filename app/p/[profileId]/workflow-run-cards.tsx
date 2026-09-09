"use client";

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { DoneTaskButton } from "@/app/components/done-task-button";
import { TaskNotesButton } from "@/app/components/task-notes-button";

type WorkflowRunTask = {
  id: string;
  title: string;
  notes: string | null;
  startDate: string;
  dueAt: string | null;
  completedAt: string | null;
  completedOn: string | null;
  isPriority: boolean;
  noteHistory: Array<{
    content: string;
    waitingOn: string | null;
    createdAt: string;
    user: { name: string; email: string } | null;
  }>;
};

type WorkflowRun = {
  id: string;
  launchName: string;
  workflowNameSnapshot: string;
  categorySnapshot: string | null;
  launchedAt: string;
  tasks: WorkflowRunTask[];
};

function dateOnly(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-AU") : "—";
}

function calendarDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function noteText(task: WorkflowRunTask) {
  const templateNote = task.notes ? [task.notes] : [];
  const historyNotes = task.noteHistory.map((note) => {
    const author = note.user?.name || note.user?.email || "Unknown";
    const timestamp = new Date(note.createdAt).toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return [
      `${author} · ${timestamp}`,
      note.content,
      note.waitingOn ? `Waiting on: ${note.waitingOn}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [...templateNote, ...historyNotes].join("\n\n");
}

const workflowTaskGridColumns =
  "minmax(12rem,1.7fr) minmax(8rem,0.8fr) minmax(5rem,0.5fr) minmax(7rem,0.65fr) minmax(6rem,0.6fr) 4.25rem";
const priorityChipClass =
  "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800";
const updatingChipClass =
  "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100/90 px-2 py-0.5 text-[11px] font-semibold text-slate-800";

export function WorkflowRunCards({ profileId, selectedDay, showDone = false, pendingTaskIds = [], completedTaskIds = [], priorityOverrides = {}, onToggleTask, onTogglePriority, onOpenEditTask, onOpenTaskContextMenu }: { profileId: string; selectedDay: string; showDone?: boolean; pendingTaskIds?: string[]; completedTaskIds?: string[]; priorityOverrides?: Record<string, boolean>; onToggleTask: (taskId: string, completed: boolean) => void; onTogglePriority: (taskId: string, nextValue: boolean) => Promise<void>; onOpenEditTask: (taskId: string) => void; onOpenTaskContextMenu: (event: MouseEvent<HTMLButtonElement>, taskId: string) => void }) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pendingPriorityTaskIds, setPendingPriorityTaskIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/p/${profileId}/workflow-runs`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as WorkflowRun[];
        if (!cancelled) setRuns(data);
      } catch {
        // Polling can overlap with navigation or a dev-server restart; keep it silent and retry.
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [profileId]);

  async function togglePriority(task: WorkflowRunTask) {
    if (pendingPriorityTaskIds.includes(task.id)) return;
    setPendingPriorityTaskIds((current) => [...current, task.id]);
    setRuns((current) => current.map((run) => ({
      ...run,
      tasks: run.tasks.map((item) => item.id === task.id ? { ...item, isPriority: !item.isPriority } : item),
    })));
    try {
      await onTogglePriority(task.id, !task.isPriority);
    } finally {
      setPendingPriorityTaskIds((current) => current.filter((id) => id !== task.id));
    }
  }

  const visibleRuns = runs.filter((run) => {
    const hasVisibleTask = run.tasks.some((task) => {
      if (showDone) return task.completedAt !== null && calendarDate(task.completedOn ?? task.completedAt) === selectedDay;
      return !task.completedAt && !completedTaskIds.includes(task.id) && calendarDate(task.startDate) <= selectedDay;
    });
    return hasVisibleTask;
  });

  if (visibleRuns.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleRuns.map((run) => {
        const visibleTasks = showDone
          ? run.tasks.filter((task) => task.completedAt !== null && calendarDate(task.completedOn ?? task.completedAt) === selectedDay)
          : run.tasks.filter((task) => !task.completedAt && !completedTaskIds.includes(task.id) && calendarDate(task.startDate) <= selectedDay);
        const completed = run.tasks.filter((task) => Boolean(task.completedAt)).length;
        const progress = run.tasks.length === 0 ? 100 : Math.round((completed / run.tasks.length) * 100);
        const isCollapsed = collapsed[run.id] ?? false;

        return (
          <section key={run.id} className="rounded-[12px] border border-[color:var(--tm-border)] bg-white/25 p-3 shadow-sm">
            <div className="border-b border-[color:var(--tm-border)] pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium">{run.launchName} {run.workflowNameSnapshot}</h3>
                    <span className="rounded-full border border-[color:var(--tm-border)] px-2 py-0.5 text-xs">Workflow</span>
                    <span className="rounded-full border border-[color:var(--tm-border)] px-2 py-0.5 text-xs">{run.tasks.length}</span>
                  </div>
                  <div className="mt-3 rounded-[12px] border border-amber-700/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,226,190,0.32))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                    <div className="grid overflow-hidden rounded-[9px] border border-black/10 bg-white/35 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(96px,0.7fr)_minmax(150px,1.2fr)]">
                      <div className="min-w-0 border-b border-black/10 px-3 py-2 sm:border-b-0 sm:border-r">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">Category</div>
                        <div className="mt-1 truncate text-sm font-medium">{run.categorySnapshot || "None"}</div>
                      </div>
                      <div className="min-w-0 border-b border-black/10 px-3 py-2 sm:border-b-0 sm:border-r">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">Started</div>
                        <div className="mt-1 text-sm font-medium">{dateOnly(run.launchedAt)}</div>
                      </div>
                      <div className="min-w-0 border-b border-black/10 px-3 py-2 sm:border-b-0 sm:border-r">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">Tasks</div>
                        <div className="mt-1 text-sm font-medium">{run.tasks.length - completed} open</div>
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
                          <span>Progress</span>
                          <span className="rounded-full border border-amber-800/15 bg-amber-50/70 px-1.5 py-0.5 text-[9px] leading-none text-amber-950">{completed}/{run.tasks.length}</span>
                        </div>
                        <div className="mt-2 overflow-hidden rounded-full border border-amber-900/15 bg-[linear-gradient(180deg,rgba(68,50,27,0.13),rgba(255,255,255,0.45))] p-0.5 shadow-[inset_0_1px_3px_rgba(15,23,42,0.18)]">
                          <div className="tm-progress-fill h-2.5 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_3px_rgba(120,78,24,0.18)]" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="tm-button inline-flex h-9 items-center rounded-[10px] border px-3 text-sm" type="button" onClick={() => setCollapsed((current) => ({ ...current, [run.id]: !isCollapsed }))}>
                  {isCollapsed ? "Expand" : "Collapse"}
                </button>
              </div>
            </div>
            {!isCollapsed && (
              <div className="mt-2 overflow-hidden rounded-md border border-[color:var(--tm-border)]">
                <div className="hidden items-center gap-2 border-b border-[color:var(--tm-border)] bg-white/25 px-2 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[color:var(--tm-muted)] md:grid md:[grid-template-columns:var(--workflow-task-grid-columns)]" style={{ "--workflow-task-grid-columns": workflowTaskGridColumns } as CSSProperties}>
                  <span>Title</span><span className="text-center">Category</span><span className="text-center">Due</span><span className="text-center">Waiting On</span><span className="text-center">Tags / Notes</span><span className="text-right">Actions</span>
                </div>
                {visibleTasks.map((task) => (
                  (() => {
                    const isPriority = priorityOverrides[task.id] ?? task.isPriority;
                    const isPending = pendingPriorityTaskIds.includes(task.id) || pendingTaskIds.includes(task.id);
                    return <div key={task.id} className={`grid items-center gap-2 border-b border-[color:var(--tm-border)] bg-transparent px-2 py-2 text-sm text-[color:var(--tm-text)] transition-all last:border-0 md:[grid-template-columns:var(--workflow-task-grid-columns)] ${isPriority ? "shadow-[inset_4px_0_0_0_rgba(183,122,116,0.78)]" : ""} ${isPending ? "bg-slate-100/80 opacity-75 ring-2 ring-inset ring-slate-200" : ""}`} style={{ "--workflow-task-grid-columns": workflowTaskGridColumns } as CSSProperties}>
                    <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-1.5"><button className="inline-flex max-w-full cursor-pointer truncate rounded border border-transparent px-1 py-0.5 text-left font-medium transition-colors hover:border-amber-700/20 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,226,190,0.36))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] focus:outline-none focus:ring-2 focus:ring-blue-500" type="button" onClick={() => onOpenEditTask(task.id)}><span className={task.completedAt ? "line-through opacity-60" : ""}>{task.title}</span></button>{isPending && <span className={updatingChipClass}><span className="h-1.5 w-1.5 rounded-full bg-current" />Updating...</span>}</div></div>
                    <span className="tm-muted min-w-0 text-center text-xs">{run.categorySnapshot || "None"}</span>
                    <span className="tm-muted min-w-0 text-center text-xs">{dateOnly(task.dueAt ?? task.startDate)}</span>
                    <span className="tm-muted min-w-0 text-center text-xs">—</span>
                    <span className="flex min-w-0 items-center justify-center text-center text-xs">
                      {task.notes || task.noteHistory.length > 0 ? (
                        <TaskNotesButton notes={noteText(task)} />
                      ) : isPriority ? <span className={priorityChipClass}>Priority</span> : "—"}
                    </span>
                    <span className="flex items-center justify-end gap-1">
                      {!showDone && <DoneTaskButton label={`Mark ${task.title} done`} onClick={() => onToggleTask(task.id, true)} />}
                      <button aria-label={`Task actions for ${task.title}`} className="tm-button inline-flex h-8 w-8 items-center justify-center rounded-[10px] border text-sm" type="button" onClick={(event) => onOpenTaskContextMenu(event, task.id)}>⋯</button>
                    </span>
                    </div>;
                  })()
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
