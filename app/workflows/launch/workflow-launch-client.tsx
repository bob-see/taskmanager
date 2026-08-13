"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { calculateWorkflowDates } from "@/app/lib/workflow-dates";
import { getBrisbaneDate } from "@/app/lib/date-time";

type WorkflowTask = {
  id: string;
  title: string;
  notes: string | null;
  startOffsetDays: number;
  dueRule: "NONE" | "START_DATE" | "WORKFLOW_DATE" | "OFFSET";
  dueOffsetDays: number | null;
  isPriority: boolean;
};

type Workflow = {
  id: string;
  name: string;
  status?: string;
  category: string | null;
  tasks: WorkflowTask[];
};

type Profile = { id: string; name: string };
type Override = { startDate: string; dueDate: string; notes: string; isPriority: boolean };

function createOverrides(workflow: Workflow, date: string): Record<string, Override> {
  return Object.fromEntries(workflow.tasks.map((task) => {
    const dates = calculateWorkflowDates(date, task);
    return [task.id, { startDate: dates.startDate, dueDate: dates.dueDate ?? "", notes: task.notes ?? "", isPriority: task.isPriority }];
  }));
}

export function WorkflowLaunchClient() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get("workflowId");
  const requestedProfileId = searchParams.get("profileId");
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [availableWorkflows, setAvailableWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(workflowId ?? "");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [workflowDate, setWorkflowDate] = useState(() => getBrisbaneDate(new Date()));
  const [launchName, setLaunchName] = useState("");
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; launchName: string; workflowNameSnapshot: string; tasks: { title: string; startDate: string; dueAt: string | null }[] } | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/profiles", { cache: "no-store" }).then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Profiles could not be loaded");
        return body as Profile[];
      }),
      fetch(workflowId ? `/api/workflows/${workflowId}` : "/api/workflows", { cache: "no-store" }).then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Workflows could not be loaded");
        return body as Workflow | Workflow[];
      }),
    ]).then(([loadedProfiles, loadedWorkflowData]) => {
      const loadedWorkflows = Array.isArray(loadedWorkflowData) ? loadedWorkflowData : [loadedWorkflowData];
      const loadedWorkflow = workflowId
        ? loadedWorkflows[0]
        : loadedWorkflows.find((item) => item.status === "ACTIVE") ?? null;
      setAvailableWorkflows(loadedWorkflows);
      setWorkflow(loadedWorkflow);
      setSelectedWorkflowId(loadedWorkflow?.id ?? "");
      setProfiles(loadedProfiles);
      setProfileId(loadedProfiles.some((profile) => profile.id === requestedProfileId) ? requestedProfileId! : loadedProfiles[0]?.id ?? "");
      if (loadedWorkflow) {
        setOverrides(createOverrides(loadedWorkflow, getBrisbaneDate(new Date())));
        setSelectedTaskIds(loadedWorkflow.tasks.map((task) => task.id));
      }
    }).catch((err) => setError(err instanceof Error ? err.message : "Could not load launch details")).finally(() => setLoading(false));
  }, [workflowId, requestedProfileId]);

  const preview = useMemo(() => {
    if (!workflow) return [];
    return workflow.tasks.map((task) => {
      const defaults = calculateWorkflowDates(workflowDate, task);
      const override = overrides[task.id];
      return {
        ...task,
        startDate: override?.startDate || defaults.startDate,
        dueDate: override?.dueDate || defaults.dueDate || "",
        notes: override?.notes ?? task.notes ?? "",
        isPriority: override?.isPriority ?? task.isPriority,
      };
    });
  }, [workflow, workflowDate, overrides]);

  function updateOverride(taskId: string, update: Partial<Override>) {
    setOverrides((current) => ({ ...current, [taskId]: { ...current[taskId], ...update } }));
  }

  function setAllTasksSelected(selected: boolean) {
    setSelectedTaskIds(selected ? preview.map((task) => task.id) : []);
  }

  async function launch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflow || !profileId) return;
    if (selectedTaskIds.length === 0) {
      setError("Select at least one task to launch this Workflow");
      return;
    }
    setLaunching(true);
    setError("");
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          workflowDate,
          launchName,
          idempotencyKey: crypto.randomUUID(),
          selectedTaskIds,
          taskOverrides: Object.fromEntries(preview.map((task) => [task.id, { startDate: task.startDate, dueDate: task.dueDate || null, notes: task.notes, isPriority: task.isPriority }])),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not launch Workflow");
      setResult(body.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch Workflow");
    } finally {
      setLaunching(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-[color:var(--tm-muted)]">Loading Workflow…</main>;
  if (result) return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8">
      <p className="tm-kicker">Workflow launched</p>
      <h1 className="mt-2 text-3xl font-semibold text-[color:var(--tm-text)]">{result.launchName} {result.workflowNameSnapshot}</h1>
      <p className="mt-3 text-sm text-[color:var(--tm-muted)]">The tasks have been added to the selected Profile as ordinary TaskManager tasks.</p>
      <ol className="tm-card mt-6 space-y-2 rounded-2xl p-5">
        {result.tasks.map((task) => <li key={`${task.title}-${task.startDate}`} className="flex justify-between gap-4 border-b border-[color:var(--tm-border)] py-2 text-sm last:border-0"><span>{task.title}</span><span className="text-[color:var(--tm-muted)]">{task.startDate}{task.dueAt ? ` → ${task.dueAt.slice(0, 10)}` : ""}</span></li>)}
      </ol>
      <div className="mt-5 flex gap-2"><Link href="/workflows" className="tm-button-primary inline-flex items-center rounded-[10px] border px-4 py-2 text-sm">Back to Workflows</Link><button type="button" className="tm-button-secondary" onClick={() => setResult(null)}>Launch again</button></div>
    </main>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/workflows" className="text-sm text-[color:var(--tm-muted)] hover:underline">← Workflows</Link>
      <p className="tm-kicker mt-6">Preview and launch</p>
      <h1 className="mt-2 text-3xl font-semibold text-[color:var(--tm-text)]">{workflow?.name ?? "Workflow"}</h1>
      {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <form className="mt-6 space-y-5" onSubmit={launch}>
        <section className={`tm-card grid gap-4 rounded-2xl p-5 ${workflowId ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
          {!workflowId ? <label className="text-sm font-medium">Workflow<select required className="tm-input mt-2 w-full rounded-[10px] border px-3 py-2" value={selectedWorkflowId} onChange={(event) => { const value = event.target.value; const next = availableWorkflows.find((item) => item.id === value) ?? null; setSelectedWorkflowId(value); setWorkflow(next); if (next) { setOverrides(createOverrides(next, workflowDate)); setSelectedTaskIds(next.tasks.map((task) => task.id)); } }}>{availableWorkflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          <label className="text-sm font-medium">Run name<span className="ml-1 text-red-600">*</span><input required className="tm-input mt-2 w-full rounded-[10px] border px-3 py-2" placeholder="e.g. Ruby10.1 or Gran24" value={launchName} onChange={(event) => setLaunchName(event.target.value)} /><span className="tm-muted mt-1 block text-xs">A short name to distinguish this run from others using the same Workflow.</span></label>
          <label className="text-sm font-medium">Profile<select required className="tm-input mt-2 w-full rounded-[10px] border px-3 py-2" value={profileId} onChange={(event) => setProfileId(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          <label className="text-sm font-medium">Workflow Date<input required className="tm-input mt-2 w-full rounded-[10px] border px-3 py-2" type="date" value={workflowDate} onChange={(event) => { const value = event.target.value; setWorkflowDate(value); if (workflow) setOverrides(createOverrides(workflow, value)); }} /></label>
        </section>
        <section className="space-y-3">
          <div className="tm-card flex items-center justify-between gap-4 rounded-2xl px-5 py-3">
            <div><p className="text-sm font-semibold text-[color:var(--tm-text)]">Tasks to include</p><p className="mt-1 text-xs text-[color:var(--tm-muted)]">Choose which tasks apply to this Workflow run.</p></div>
            <label className="flex shrink-0 items-center gap-2 text-sm text-[color:var(--tm-text)]"><input type="checkbox" checked={preview.length > 0 && selectedTaskIds.length === preview.length} onChange={(event) => setAllTasksSelected(event.target.checked)} /> Select all</label>
          </div>
          {preview.map((task) => (
            <article key={task.id} className={`tm-card rounded-2xl p-4 ${selectedTaskIds.includes(task.id) ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3"><label className="flex items-start gap-2 pt-1 text-xs text-[color:var(--tm-muted)]"><input aria-label={`Include ${task.title}`} type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={(event) => setSelectedTaskIds((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} /></label><div className="min-w-0 flex-1"><h2 className="font-semibold text-[color:var(--tm-text)]">{task.title}</h2><p className="mt-1 text-xs text-[color:var(--tm-muted)]">{workflow?.category || "No category"}</p></div><label className="flex items-center gap-2 text-xs text-[color:var(--tm-muted)]"><input type="checkbox" checked={task.isPriority} onChange={(event) => updateOverride(task.id, { isPriority: event.target.checked })} /> Priority</label></div>
              <div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-xs text-[color:var(--tm-muted)]">Start date<input className="tm-input mt-1 w-full rounded-[10px] border px-3 py-2" type="date" value={task.startDate} onChange={(event) => updateOverride(task.id, { startDate: event.target.value })} /></label><label className="text-xs text-[color:var(--tm-muted)]">Due date<input className="tm-input mt-1 w-full rounded-[10px] border px-3 py-2" type="date" value={task.dueDate} onChange={(event) => updateOverride(task.id, { dueDate: event.target.value })} /></label><label className="text-xs text-[color:var(--tm-muted)]">Task note/instruction<textarea className="tm-input mt-1 min-h-10 w-full rounded-[10px] border px-3 py-2" value={task.notes} onChange={(event) => updateOverride(task.id, { notes: event.target.value })} /></label></div>
            </article>
          ))}
        </section>
        <button type="submit" className="tm-button-primary inline-flex min-h-11 w-full items-center justify-center rounded-[10px] border px-4 text-sm font-semibold" disabled={launching}>{launching ? "Launching…" : `Launch ${launchName || "Workflow"}`}</button>
      </form>
    </main>
  );
}
