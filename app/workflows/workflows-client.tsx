"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type DueRule = "NONE" | "START_DATE" | "WORKFLOW_DATE" | "OFFSET";

type WorkflowTask = {
  id?: string;
  title: string;
  notes: string | null;
  startOffsetDays: number;
  dueRule: DueRule;
  dueOffsetDays: number | null;
  isPriority: boolean;
};

type Workflow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  tasks: WorkflowTask[];
  runs?: Array<{
    id: string;
    completedAt: string | null;
    launchedAt: string;
    profile?: { name: string };
    tasks: Array<{ completedAt: string | null }>;
  }>;
};

const emptyTask = (): WorkflowTask => ({
  title: "",
  notes: null,
  startOffsetDays: 0,
  dueRule: "NONE",
  dueOffsetDays: null,
  isPriority: false,
});

const workflowModalInputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";

function dateRuleLabel(offset: number, kind: "start" | "due") {
  if (kind === "due" && offset === 0) return "On Workflow Date";
  if (offset === 0) return "On Workflow Date";
  return `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} ${offset < 0 ? "before" : "after"}`;
}

function isRunComplete(run: { completedAt: string | null; tasks: Array<{ completedAt: string | null }> }) {
  return run.tasks.length > 0 && run.tasks.every((task) => Boolean(task.completedAt));
}

export function WorkflowsClient({ workflowId }: { workflowId?: string }) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newWorkflowModalOpen, setNewWorkflowModalOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ name: "", category: "", description: "" });
  const [editingDefinitionDetails, setEditingDefinitionDetails] = useState(workflowId === "new");
  const [workflowActionsOpen, setWorkflowActionsOpen] = useState(false);
  const [workflowListActionsOpen, setWorkflowListActionsOpen] = useState<string | null>(null);
  const [workflowDetailsModalOpen, setWorkflowDetailsModalOpen] = useState(false);
  const [workflowTaskActionsOpen, setWorkflowTaskActionsOpen] = useState<number | null>(null);
  const [workflowTaskModalIndex, setWorkflowTaskModalIndex] = useState<number | null>(null);
  const [workflowNewTaskModalOpen, setWorkflowNewTaskModalOpen] = useState(false);
  const [workflowNewTask, setWorkflowNewTask] = useState<WorkflowTask>(emptyTask());
  const [draggedWorkflowTaskIndex, setDraggedWorkflowTaskIndex] = useState<number | null>(null);
  const [dragOverWorkflowTaskIndex, setDragOverWorkflowTaskIndex] = useState<number | null>(null);

  async function loadWorkflows(nextArchived = archived) {
    setLoading(true);
    setError("");
    try {
      if (workflowId === "new") {
        setWorkflows([]);
        return;
      }
      const res = await fetch(
        workflowId && workflowId !== "new"
          ? `/api/workflows/${workflowId}`
          : `/api/workflows?status=${nextArchived ? "ARCHIVED" : "ACTIVE"}`,
        { cache: "no-store" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not load Workflows");
      const nextWorkflows = workflowId && workflowId !== "new" ? [body] : body;
      setWorkflows(nextWorkflows);
      if (workflowId && workflowId !== "new") {
        setEditing(body);
        setEditingDefinitionDetails(false);
        setWorkflowActionsOpen(false);
        setWorkflowDetailsModalOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Workflows");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkflows();
  }, [archived, workflowId]);

  useEffect(() => {
    if (workflowId === "new") {
      setEditing({ id: "", name: "", description: null, category: null, status: "ACTIVE", tasks: [emptyTask()] });
      setWorkflows([]);
      setEditingDefinitionDetails(true);
    }
  }, [workflowId]);

  const detailMode = Boolean(workflowId);
  const detailWorkflow = workflows[0] ?? null;
  const pageTitle = workflowId === "new" ? "New Workflow" : detailMode ? detailWorkflow?.name ?? "Workflow" : archived ? "Archived Workflows" : "Workflows";

  async function saveWorkflow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(editing.id ? `/api/workflows/${editing.id}` : "/api/workflows", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not save Workflow");
      if (!detailMode) setEditing(null);
      setEditingDefinitionDetails(false);
      setWorkflowDetailsModalOpen(false);
      setNotice(editing.id ? "Workflow updated." : "Workflow created.");
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Workflow");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(workflow: Workflow, action: "archive" | "restore") {
    setError("");
    setNotice("");
    const res = await fetch(`/api/workflows/${workflow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "Could not update Workflow");
      return;
    }
    setNotice(action === "archive" ? "Workflow archived." : "Workflow restored.");
    await loadWorkflows();
  }

  async function createWorkflow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newWorkflow, tasks: [] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not create Workflow");
      setNewWorkflowModalOpen(false);
      setNewWorkflow({ name: "", category: "", description: "" });
      router.push(`/workflows/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create Workflow");
    } finally {
      setSaving(false);
    }
  }

  const taskCountLabel = useMemo(() => `${workflows.length} ${workflows.length === 1 ? "Workflow" : "Workflows"}`, [workflows.length]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="tm-kicker">Tools / repeatable processes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--tm-text)]">{pageTitle}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--tm-muted)]">{detailMode ? "Configure tasks, dates, notes, and launch behaviour for this repeatable process." : "Build reusable task bundles for processes such as Auction Prep, Price Change, and New Listing."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detailMode ? <Link href="/workflows" className="tm-button-secondary inline-flex h-10 items-center rounded-[10px] border px-3 text-sm">← Workflows</Link> : null}
          {!detailMode ? <button type="button" className="tm-button-secondary" onClick={() => setArchived((value) => !value)}>
            {archived ? "Active Workflows" : "Archived Workflows"}
          </button> : null}
          {!archived && !detailMode ? (
            <button type="button" className="tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm" onClick={() => setNewWorkflowModalOpen(true)}>
              New Workflow
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}

      <div className={`mt-8 grid gap-5 ${detailMode ? "grid-cols-1" : "grid-cols-1"}`}>
        {!detailMode ? <section className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[color:var(--tm-muted)]">
            <span>{taskCountLabel}</span>
            <span>{loading ? "Loading…" : ""}</span>
          </div>
          {!loading && workflows.length === 0 ? (
            <div className="tm-card rounded-2xl p-6 text-sm text-[color:var(--tm-muted)]">
              {archived
                ? "No archived Workflows."
                : error
                  ? "Workflows could not be loaded yet. Once Workflow storage is available, you can create your first Workflow here."
                  : "Create your first Workflow to turn a repeatable process into a ready-to-launch task bundle."}
            </div>
          ) : null}
          {workflows.map((workflow) => (
            <article key={workflow.id} className="tm-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/workflows/${workflow.id}`} className="inline-block min-w-0 cursor-pointer rounded border border-transparent px-1 py-0.5 text-left text-lg font-semibold text-[color:var(--tm-text)] transition-colors hover:border-amber-700/20 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,226,190,0.36))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[color:var(--tm-card)]">{workflow.name}</Link>
                  <p className="mt-1 text-sm text-[color:var(--tm-muted)]">{workflow.category || "No category"} · {workflow.tasks.length} tasks</p>
                </div>
                <div className="relative">
                  <button type="button" aria-haspopup="menu" aria-expanded={workflowListActionsOpen === workflow.id} className="tm-button inline-flex h-9 items-center rounded-[10px] border px-3 text-sm" onClick={() => setWorkflowListActionsOpen((current) => current === workflow.id ? null : workflow.id)}>Actions</button>
                  {workflowListActionsOpen === workflow.id ? <div role="menu" className="tm-menu absolute right-0 top-11 z-20 min-w-36 overflow-hidden rounded-lg border py-1 text-left shadow-2xl">
                    <Link href={`/workflows/${workflow.id}`} role="menuitem" className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/70" onClick={() => setWorkflowListActionsOpen(null)}>Open</Link>
                    {!archived ? <Link href={`/workflows/launch?workflowId=${workflow.id}`} role="menuitem" className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/70" onClick={() => setWorkflowListActionsOpen(null)}>Launch</Link> : null}
                    <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/70" onClick={() => { setWorkflowListActionsOpen(null); void changeStatus(workflow, archived ? "restore" : "archive"); }}>
                      {archived ? "Restore" : "Archive"}
                    </button>
                  </div> : null}
                </div>
              </div>
              {workflow.description ? <p className="mt-3 text-sm leading-6 text-[color:var(--tm-muted)]">{workflow.description}</p> : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[color:var(--tm-border)] bg-white/35 px-3 py-2"><div className="text-xs text-[color:var(--tm-muted)]">Active runs</div><div className="mt-1 text-lg font-semibold">{workflow.runs?.filter((run) => !isRunComplete(run)).length ?? "—"}</div></div>
                <div className="rounded-xl border border-[color:var(--tm-border)] bg-white/35 px-3 py-2"><div className="text-xs text-[color:var(--tm-muted)]">Completed runs</div><div className="mt-1 text-lg font-semibold">{workflow.runs?.filter((run) => isRunComplete(run)).length ?? "—"}</div></div>
                <div className="rounded-xl border border-[color:var(--tm-border)] bg-white/35 px-3 py-2"><div className="text-xs text-[color:var(--tm-muted)]">Tasks</div><div className="mt-1 text-lg font-semibold">{workflow.tasks.length}</div></div>
              </div>
            </article>
          ))}
        </section> : null}

        {detailMode && detailWorkflow && detailWorkflow.runs ? (() => {
          const runs = detailWorkflow.runs;
          const completedRuns = runs.filter((run) => isRunComplete(run)).length;
          const tasksCreated = runs.reduce((total, run) => total + run.tasks.length, 0);
          const tasksCompleted = runs.reduce((total, run) => total + run.tasks.filter((task) => Boolean(task.completedAt)).length, 0);
          const profileCounts = Array.from(runs.filter((run) => !isRunComplete(run)).reduce((counts, run) => { const name = run.profile?.name ?? "Unknown profile"; counts.set(name, (counts.get(name) ?? 0) + 1); return counts; }, new Map<string, number>()).entries()).sort((left, right) => right[1] - left[1]);
          return (
            <section className="tm-card rounded-2xl p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="tm-kicker">Workflow usage</p><h2 className="mt-1 text-xl font-semibold text-[color:var(--tm-text)]">Activity and completion</h2></div>
                <span className="text-sm text-[color:var(--tm-muted)]">{runs.length} total launch{runs.length === 1 ? "" : "es"}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Active runs", runs.length - completedRuns],
                  ["Completed runs", completedRuns],
                  ["Tasks created", tasksCreated],
                  ["Tasks completed", tasksCompleted],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-[color:var(--tm-border)] bg-white/35 p-3"><div className="text-xs text-[color:var(--tm-muted)]">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div><h3 className="font-semibold">Active use by profile</h3>{profileCounts.length === 0 ? <p className="mt-2 text-sm text-[color:var(--tm-muted)]">No launches yet.</p> : <div className="mt-2 space-y-2">{profileCounts.map(([name, count]) => <div key={name} className="flex items-center justify-between rounded-lg border border-[color:var(--tm-border)] px-3 py-2 text-sm"><span>{name}</span><span className="font-semibold">{count}</span></div>)}</div>}</div>
                <div><h3 className="font-semibold">What the numbers mean</h3><p className="mt-2 text-sm leading-6 text-[color:var(--tm-muted)]">Completed runs are workflows where every generated task is complete. Tasks completed counts individual generated tasks across all launches, including runs that are still active.</p></div>
              </div>
            </section>
          );
        })() : null}

        {editing ? (
          <form className="tm-card h-fit w-full rounded-2xl p-5" onSubmit={saveWorkflow}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="tm-kicker">Workflow definition</p>
                <h2 className="mt-1 text-xl font-semibold text-[color:var(--tm-text)]">{editing.id ? editing.name : "New Workflow"}</h2>
              </div>
              <div className="flex items-center gap-2">
                {editing.id ? <div className="relative">
                  <button type="button" aria-expanded={workflowActionsOpen} className="tm-button inline-flex h-9 items-center rounded-[10px] border px-3 text-sm" onClick={() => setWorkflowActionsOpen((value) => !value)}>Actions</button>
                  {workflowActionsOpen ? <div className="tm-menu absolute right-0 top-11 z-20 min-w-36 overflow-hidden rounded-lg border py-1 text-left shadow-2xl">
                    <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-white/50" onClick={() => { setWorkflowActionsOpen(false); setWorkflowDetailsModalOpen(true); }}>Edit</button>
                  </div> : null}
                </div> : null}
                {!editing.id ? <button type="button" className="text-sm text-[color:var(--tm-muted)]" onClick={() => setEditing(null)}>Close</button> : null}
              </div>
            </div>
            {editing.id ? (
              <div className="mt-4 rounded-[12px] border border-amber-700/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,226,190,0.32))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <div className="grid overflow-hidden rounded-[9px] border border-black/10 bg-white/35 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                  <div className="min-w-0 border-b border-black/10 px-3 py-2 sm:border-b-0 sm:border-r">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">Category</div>
                    <div className="mt-1 text-sm font-medium">{editing.category || "None"}</div>
                  </div>
                  <div className="min-w-0 px-3 py-2">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">Tasks</div>
                    <div className="mt-1 text-sm font-medium">{editing.tasks.length}</div>
                  </div>
                </div>
                {editing.description ? <p className="mt-3 text-sm leading-6 text-[color:var(--tm-muted)]">{editing.description}</p> : null}
              </div>
            ) : null}
            {!editing.id && editingDefinitionDetails ? <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-[color:var(--tm-text)]">Workflow name
                <input className="tm-input mt-2 w-full" required maxLength={191} placeholder="e.g. Auction Prep" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-[color:var(--tm-text)]">Category
                <span className="mt-1 block text-xs font-normal text-[color:var(--tm-muted)]">Applied to every generated task</span>
                <input className="tm-input mt-2 w-full" placeholder="e.g. Auction" value={editing.category ?? ""} onChange={(event) => setEditing({ ...editing, category: event.target.value || null })} />
              </label>
              <label className="text-sm font-medium text-[color:var(--tm-text)] md:col-span-2">Description
                <span className="mt-1 block text-xs font-normal text-[color:var(--tm-muted)]">Optional instructions about when or why to use this workflow</span>
                <textarea className="tm-input mt-2 min-h-20 w-full" placeholder="Describe this repeatable process" value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value || null })} />
              </label>
            </div> : null}
            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-semibold text-[color:var(--tm-text)]">Tasks</h3>
              {detailMode ? <button type="button" className="tm-button inline-flex h-9 items-center rounded-[10px] border px-3 text-sm" onClick={() => { setWorkflowNewTask(emptyTask()); setWorkflowNewTaskModalOpen(true); }}>+ Task</button> : <button type="button" className="tm-button-secondary text-xs" onClick={() => setEditing({ ...editing, tasks: [...editing.tasks, emptyTask()] })}>Add task</button>}
            </div>
            {detailMode ? <div className="mt-3 overflow-hidden rounded-md border border-[color:var(--tm-border)]">
              <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(8rem,1fr)_4.5rem] items-center gap-2 border-b border-[color:var(--tm-border)] bg-white/25 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tm-muted)]">
                <span>Title</span><span className="text-center">Category</span><span className="text-center">Start</span><span className="text-center">Due</span><span className="text-center">Tags / Notes</span><span className="text-right">Actions</span>
              </div>
              {editing.tasks.map((task, index) => <div key={task.id ?? index} draggable className={`grid grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(8rem,1fr)_4.5rem] items-center gap-2 border-b border-[color:var(--tm-border)] px-3 py-2.5 text-sm last:border-0 cursor-grab active:cursor-grabbing ${dragOverWorkflowTaskIndex === index ? "bg-white/60" : ""}`} onDragStart={(event) => { setDraggedWorkflowTaskIndex(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverWorkflowTaskIndex(index); }} onDrop={(event) => { event.preventDefault(); const from = draggedWorkflowTaskIndex ?? Number(event.dataTransfer.getData("text/plain")); if (!Number.isInteger(from) || from === index || from < 0 || from >= editing.tasks.length) { setDraggedWorkflowTaskIndex(null); setDragOverWorkflowTaskIndex(null); return; } const nextTasks = [...editing.tasks]; const [movedTask] = nextTasks.splice(from, 1); nextTasks.splice(index, 0, movedTask); setEditing({ ...editing, tasks: nextTasks }); setDraggedWorkflowTaskIndex(null); setDragOverWorkflowTaskIndex(null); }} onDragEnd={() => { setDraggedWorkflowTaskIndex(null); setDragOverWorkflowTaskIndex(null); }}>
                <span className="min-w-0 truncate font-medium text-[color:var(--tm-text)]">{task.title}</span>
                <span className="text-center text-xs text-[color:var(--tm-muted)]">{editing.category || "—"}</span>
                <span className="text-center text-xs text-[color:var(--tm-muted)]">{dateRuleLabel(task.startOffsetDays, "start")}</span>
                <span className="text-center text-xs text-[color:var(--tm-muted)]">{task.dueRule === "NONE" ? "—" : task.dueRule === "START_DATE" ? "Same day as Start" : task.dueRule === "WORKFLOW_DATE" ? "Workflow Date" : `${task.dueOffsetDays ?? 0} days`}</span>
                <span className="flex items-center justify-center gap-2 text-xs text-[color:var(--tm-muted)]">{task.notes ? <span className="truncate" title={task.notes}>📝</span> : "—"}{task.isPriority ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">Priority</span> : null}</span>
                <span className="relative flex justify-end"><button type="button" aria-label={`Template task actions for ${task.title}`} aria-haspopup="menu" aria-expanded={workflowTaskActionsOpen === index} className="tm-button inline-flex h-8 w-8 items-center justify-center rounded-[10px] border text-sm" onClick={() => setWorkflowTaskActionsOpen((current) => current === index ? null : index)}>⋯</button>{workflowTaskActionsOpen === index ? <div role="menu" className="tm-menu absolute right-0 top-10 z-20 min-w-32 overflow-hidden rounded-lg border py-1 text-left shadow-2xl"><button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-sm hover:bg-white/50" onClick={() => { setWorkflowTaskActionsOpen(null); setWorkflowTaskModalIndex(index); }}>Edit</button></div> : null}</span>
              </div>)}
            </div> : <div className="mt-3 space-y-3">
              {editing.tasks.map((task, index) => (
                <div key={task.id ?? index} className="rounded-xl border border-[color:var(--tm-border)] bg-white/35 p-3">
                  <div className="flex gap-2">
                    <span className="pt-2 font-mono text-xs text-[color:var(--tm-muted)]">{index + 1}</span>
                    <input className="tm-input flex-1" required placeholder="Task title" value={task.title} onChange={(event) => setEditing({ ...editing, tasks: editing.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} />
                    <button type="button" className="px-2 text-sm text-red-600" disabled={editing.tasks.length === 1} onClick={() => setEditing({ ...editing, tasks: editing.tasks.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
                  </div>
                  <textarea className="tm-input mt-2 min-h-12" placeholder="Reusable instruction/note" value={task.notes ?? ""} onChange={(event) => setEditing({ ...editing, tasks: editing.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value || null } : item) })} />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-[color:var(--tm-muted)]">Start days from Workflow Date
                      <input className="tm-input mt-1" type="number" min={-3650} max={3650} value={task.startOffsetDays} onChange={(event) => setEditing({ ...editing, tasks: editing.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, startOffsetDays: Number(event.target.value) } : item) })} />
                    </label>
                    <label className="text-xs text-[color:var(--tm-muted)]">Due rule
                      <select className="tm-input mt-1" value={task.dueRule} onChange={(event) => setEditing({ ...editing, tasks: editing.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, dueRule: event.target.value as DueRule } : item) })}>
                        <option value="NONE">No due date</option>
                        <option value="START_DATE">Same day as Start</option>
                        <option value="WORKFLOW_DATE">On Workflow Date</option>
                        <option value="OFFSET">Specific days from Workflow Date</option>
                      </select>
                    </label>
                  </div>
                  {task.dueRule === "OFFSET" ? <input className="tm-input mt-2" type="number" min={-3650} max={3650} placeholder="Due days from Workflow Date" value={task.dueOffsetDays ?? ""} onChange={(event) => setEditing({ ...editing, tasks: editing.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, dueOffsetDays: event.target.value === "" ? null : Number(event.target.value) } : item) })} /> : null}
                  <label className="mt-2 flex items-center gap-2 text-xs text-[color:var(--tm-muted)]"><input type="checkbox" checked={task.isPriority} onChange={(event) => setEditing({ ...editing, tasks: editing.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, isPriority: event.target.checked } : item) })} /> Priority by default</label>
                </div>
              ))}
            </div>}
            <button type="submit" className="tm-button-primary mt-5 min-h-11 w-full rounded-[10px] border-2 border-[color:var(--tm-text)] px-4 font-semibold shadow-[3px_3px_0_var(--tm-text)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none" disabled={saving}>{saving ? "Saving…" : "Save Workflow"}</button>
          </form>
        ) : null}
        {workflowNewTaskModalOpen ? (
          <div className="tm-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="tm-card flex max-h-[calc(100vh-48px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl p-0 shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--tm-border)] px-5 py-4"><h2 className="text-lg font-semibold">New Workflow Task</h2><button aria-label="Close New Workflow Task" className="tm-button inline-flex h-9 w-9 items-center justify-center rounded-[10px] border text-lg leading-none" type="button" onClick={() => setWorkflowNewTaskModalOpen(false)}>×</button></div>
              <div className="min-h-0 overflow-y-auto px-5 py-4"><div className="space-y-3">
                <label className="space-y-1 text-sm"><div className="tm-muted">Task title</div><input className={`w-full ${workflowModalInputClass}`} required value={workflowNewTask.title} onChange={(event) => setWorkflowNewTask({ ...workflowNewTask, title: event.target.value })} /></label>
                <label className="space-y-1 text-sm"><div className="tm-muted">Instruction / note</div><textarea className={`min-h-28 w-full ${workflowModalInputClass}`} value={workflowNewTask.notes ?? ""} onChange={(event) => setWorkflowNewTask({ ...workflowNewTask, notes: event.target.value || null })} /></label>
                <label className="space-y-1 text-sm"><div className="tm-muted">Start days from Workflow Date</div><input className={`w-full ${workflowModalInputClass}`} type="number" min={-3650} max={3650} value={workflowNewTask.startOffsetDays} onChange={(event) => setWorkflowNewTask({ ...workflowNewTask, startOffsetDays: Number(event.target.value) })} /></label>
                <label className="space-y-1 text-sm"><div className="tm-muted">Due rule</div><select className={`w-full ${workflowModalInputClass}`} value={workflowNewTask.dueRule} onChange={(event) => setWorkflowNewTask({ ...workflowNewTask, dueRule: event.target.value as DueRule })}><option value="NONE">No due date</option><option value="START_DATE">Same day as Start</option><option value="WORKFLOW_DATE">On Workflow Date</option><option value="OFFSET">Specific days from Workflow Date</option></select></label>
                {workflowNewTask.dueRule === "OFFSET" ? <label className="space-y-1 text-sm"><div className="tm-muted">Due days from Workflow Date</div><input className={`w-full ${workflowModalInputClass}`} type="number" min={-3650} max={3650} value={workflowNewTask.dueOffsetDays ?? ""} onChange={(event) => setWorkflowNewTask({ ...workflowNewTask, dueOffsetDays: event.target.value === "" ? null : Number(event.target.value) })} /></label> : null}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={workflowNewTask.isPriority} onChange={(event) => setWorkflowNewTask({ ...workflowNewTask, isPriority: event.target.checked })} /><span>Priority by default</span></label>
              </div><div className="mt-6 flex justify-end gap-2 border-t border-[color:var(--tm-border)] pt-4"><button type="button" className="tm-button-secondary" onClick={() => setWorkflowNewTaskModalOpen(false)}>Cancel</button><button type="button" className="tm-button-secondary" disabled={!workflowNewTask.title.trim()} onClick={() => { setEditing(editing ? { ...editing, tasks: [...editing.tasks, { ...workflowNewTask, title: workflowNewTask.title.trim() }] } : editing); setWorkflowNewTaskModalOpen(false); setWorkflowNewTask(emptyTask()); }}>Save & Close</button></div></div>
            </div>
          </div>
        ) : null}
        {workflowTaskModalIndex !== null && editing?.tasks[workflowTaskModalIndex] ? (() => {
          const index = workflowTaskModalIndex;
          const task = editing.tasks[index];
          const updateTask = (changes: Partial<WorkflowTask>) => setEditing({ ...editing, tasks: editing.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) });
          return <div className="tm-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="tm-card flex max-h-[calc(100vh-48px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl p-0 shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--tm-border)] px-5 py-4"><h2 className="text-lg font-semibold">Edit Workflow Task</h2><button aria-label="Close Edit Workflow Task" className="tm-button inline-flex h-9 w-9 items-center justify-center rounded-[10px] border text-lg leading-none" type="button" onClick={() => setWorkflowTaskModalIndex(null)}>×</button></div>
              <div className="min-h-0 overflow-y-auto px-5 py-4"><div className="space-y-3">
                <label className="space-y-1 text-sm"><div className="tm-muted">Task title</div><input className={`w-full ${workflowModalInputClass}`} value={task.title} onChange={(event) => updateTask({ title: event.target.value })} /></label>
                <label className="space-y-1 text-sm"><div className="tm-muted">Instruction / note</div><textarea className={`min-h-28 w-full ${workflowModalInputClass}`} value={task.notes ?? ""} onChange={(event) => updateTask({ notes: event.target.value || null })} /></label>
                <label className="space-y-1 text-sm"><div className="tm-muted">Start days from Workflow Date</div><input className={`w-full ${workflowModalInputClass}`} type="number" min={-3650} max={3650} value={task.startOffsetDays} onChange={(event) => updateTask({ startOffsetDays: Number(event.target.value) })} /></label>
                <label className="space-y-1 text-sm"><div className="tm-muted">Due rule</div><select className={`w-full ${workflowModalInputClass}`} value={task.dueRule} onChange={(event) => updateTask({ dueRule: event.target.value as DueRule })}><option value="NONE">No due date</option><option value="START_DATE">Same day as Start</option><option value="WORKFLOW_DATE">On Workflow Date</option><option value="OFFSET">Specific days from Workflow Date</option></select></label>
                {task.dueRule === "OFFSET" ? <label className="space-y-1 text-sm"><div className="tm-muted">Due days from Workflow Date</div><input className={`w-full ${workflowModalInputClass}`} type="number" min={-3650} max={3650} value={task.dueOffsetDays ?? ""} onChange={(event) => updateTask({ dueOffsetDays: event.target.value === "" ? null : Number(event.target.value) })} /></label> : null}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={task.isPriority} onChange={(event) => updateTask({ isPriority: event.target.checked })} /><span>Priority by default</span></label>
              </div><div className="mt-6 flex justify-end gap-2 border-t border-[color:var(--tm-border)] pt-4"><button type="button" className="tm-button-secondary" onClick={() => setWorkflowTaskModalIndex(null)}>Save & Close</button></div></div>
            </div>
          </div>;
        })() : null}
        {workflowDetailsModalOpen && editing?.id ? (
          <div className="tm-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="tm-card flex max-h-[calc(100vh-48px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl p-0 shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--tm-border)] px-5 py-4">
                <h2 className="text-lg font-semibold">Edit Workflow</h2>
                <button aria-label="Close Edit Workflow" className="tm-button inline-flex h-9 w-9 items-center justify-center rounded-[10px] border text-lg leading-none" type="button" onClick={() => setWorkflowDetailsModalOpen(false)}>×</button>
              </div>
              <form className="min-h-0 overflow-y-auto px-5 py-4" onSubmit={saveWorkflow}>
                <div className="space-y-3">
                  <label className="space-y-1 text-sm">
                    <div className="tm-muted">Workflow name</div>
                    <input className={`w-full ${workflowModalInputClass}`} required maxLength={191} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="tm-muted">Category</div>
                    <div className="tm-muted text-xs">Applied to every generated task</div>
                    <input className={`w-full ${workflowModalInputClass}`} value={editing.category ?? ""} onChange={(event) => setEditing({ ...editing, category: event.target.value || null })} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="tm-muted">Description</div>
                    <div className="tm-muted text-xs">Optional instructions about when or why to use this workflow</div>
                    <textarea className={`min-h-28 w-full ${workflowModalInputClass}`} value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value || null })} />
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-2 border-t border-[color:var(--tm-border)] pt-4">
                  <button type="button" className="tm-button-secondary" onClick={() => setWorkflowDetailsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="tm-button-secondary" disabled={saving}>{saving ? "Saving…" : "Save & Close"}</button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {newWorkflowModalOpen && !detailMode ? (
          <div className="tm-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="tm-card flex max-h-[calc(100vh-48px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl p-0 shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--tm-border)] px-5 py-4">
                <h2 className="text-lg font-semibold">New Workflow</h2>
                <button aria-label="Close New Workflow" className="tm-button inline-flex h-9 w-9 items-center justify-center rounded-[10px] border text-lg leading-none" type="button" onClick={() => setNewWorkflowModalOpen(false)}>×</button>
              </div>
              <form className="min-h-0 overflow-y-auto px-5 py-4" onSubmit={createWorkflow}>
                <div className="space-y-3">
                  <label className="space-y-1 text-sm">
                    <div className="tm-muted">Workflow name</div>
                    <input className={`w-full ${workflowModalInputClass}`} required maxLength={191} placeholder="e.g. Auction Prep" value={newWorkflow.name} onChange={(event) => setNewWorkflow({ ...newWorkflow, name: event.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="tm-muted">Category</div>
                    <div className="tm-muted text-xs">Applied to every generated task</div>
                    <input className={`w-full ${workflowModalInputClass}`} placeholder="e.g. Auction" value={newWorkflow.category} onChange={(event) => setNewWorkflow({ ...newWorkflow, category: event.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="tm-muted">Description</div>
                    <div className="tm-muted text-xs">Optional instructions about when or why to use this workflow</div>
                    <textarea className={`min-h-28 w-full ${workflowModalInputClass}`} placeholder="Describe this repeatable process" value={newWorkflow.description} onChange={(event) => setNewWorkflow({ ...newWorkflow, description: event.target.value })} />
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-2 border-t border-[color:var(--tm-border)] pt-4">
                  <button type="button" className="tm-button-secondary" onClick={() => setNewWorkflowModalOpen(false)}>Cancel</button>
                  <button type="submit" className="tm-button-secondary" disabled={saving}>{saving ? "Saving…" : "Save & Continue"}</button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
