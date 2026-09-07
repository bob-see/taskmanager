"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatAustralianDate } from "@/app/lib/date-time";
import { useBrisbaneBoundaryRefresh } from "@/app/lib/use-brisbane-boundary-refresh";
import {
  DEFAULT_WEEKLY_SUMMARY_SETTINGS, weeklyProgressCopy, weeklyWorkloadCopy,
  type SummaryBuckets, type SummaryMetric, type WeeklySummary, type WeeklySummarySettings,
} from "@/app/lib/weekly-summary";

type SummaryResponse = { settings: WeeklySummarySettings; summary: WeeklySummary | null };
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const smallButton = "rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 disabled:opacity-50";
const dateLabel = (date: string) => formatAustralianDate(date, { day: "numeric", month: "short" });

function metricLabels(summary: WeeklySummary): Record<SummaryMetric, string> {
  const previousWeek = summary.period.today > summary.period.weekEnd;
  return {
    completed: previousWeek ? "Completed that week" : "Completed this week",
    completedPrevious: previousWeek ? "Completed preceding week" : "Completed last week",
    starting: previousWeek ? "Started that week" : "Starting this week",
    startingNext: "Starting next week", active: "Active now",
    due: previousWeek ? "Still due from that week" : "Due this week", overdue: "Overdue",
    atStart: "On your starting list", added: previousWeek ? "Added for that week" : "Added for this week", plannedAhead: "Added for later",
    remaining: previousWeek ? "Still on that week's list" : "Still on this week's list", completedFromStart: "Completed from your starting list",
    repeatCompleted: previousWeek ? "Repeats completed that week" : "Repeats completed this week",
    repeatCompletedPrevious: previousWeek ? "Repeats completed preceding week" : "Repeats completed last week",
    repeatScheduled: "Repeat occurrences scheduled", repeatOutstanding: "Repeat occurrences outstanding",
  };
}

const explanations: Partial<Record<SummaryMetric, string>> = {
  active: "Incomplete tasks whose start date has arrived, including overdue tasks.",
  due: "Incomplete tasks with a due date in the reporting week.",
  overdue: "Incomplete tasks with a due date before today. Dates are here to help you decide what needs attention.",
  atStart: "Tasks already on your list before Monday, still open then, with a start or due date no later than Sunday. Based on the task records available now.",
  added: "Tasks created during the reporting week, with a start or due date no later than Sunday.",
  plannedAhead: "Tasks added during the reporting week whose start and any due date are after Sunday. Planning ahead is separate from this week's workload.",
  remaining: "Incomplete tasks with a start or due date no later than Sunday, including work carried forward.",
  repeatScheduled: "Saved occurrences plus estimates from the latest open occurrence's schedule. Estimates are planning context, not extra outstanding tasks. Paused dates are excluded; completing late or changing a schedule can change the estimate.",
  repeatOutstanding: "Saved, incomplete repeat occurrences whose start date has arrived. Each occurrence counts once, however long it has been open. Currently paused occurrences are excluded.",
};

export function WeeklySummaryCard({
  data, saving, onSettings, onDismiss,
}: {
  data: SummaryResponse; saving: boolean;
  onSettings: () => void; onDismiss: (key: string | null) => void;
}) {
  const [selection, setSelection] = useState<{ buckets: SummaryBuckets; metric: SummaryMetric; scope: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const summary = data.summary;
  const hidden = !data.settings.enabled || (summary && data.settings.dismissedKey === summary.period.key);

  if (hidden || !summary) {
    return <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
      <span>Your week · {!data.settings.enabled ? "off" : "hidden for now"}</span>
      <div>
        {data.settings.enabled && <button className={smallButton} disabled={saving} onClick={() => onDismiss(null)}>Show summary</button>}
        <button className={smallButton} onClick={onSettings}>Weekly summary settings</button>
      </div>
    </div>;
  }

  const labels = metricLabels(summary);
  const { period, total, profiles } = summary;
  const completeMetric = period.phase === "start" ? "completedPrevious" : "completed";
  const repeatCompleteMetric = period.phase === "start" ? "repeatCompletedPrevious" : "repeatCompleted";
  const startMetric = period.phase === "start" ? "starting" : "startingNext";
  const counters: SummaryMetric[] = [startMetric, "active", "due", "overdue"];
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));

  function openTasks(buckets: SummaryBuckets, metric: SummaryMetric, scope: string) {
    setSelection({ buckets, metric, scope });
    dialog.current?.showModal();
  }

  function counter(buckets: SummaryBuckets, metric: SummaryMetric, scope: string, compact = false) {
    return <button key={metric} onClick={() => openTasks(buckets, metric, scope)}
      aria-label={`${labels[metric]}: ${buckets[metric].length}${scope ? `, ${scope}` : ""}. View tasks`}
      className={`min-w-0 rounded-xl text-left transition hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 ${compact ? "px-2 py-2" : "border border-gray-200/70 bg-white/50 px-3 py-3"}`}>
      <span className={`block font-mono font-semibold tabular-nums text-gray-800 ${compact ? "text-lg" : "text-2xl"}`}>{buckets[metric].length}</span>
      <span className="mt-1 block text-xs leading-5 text-gray-600">{labels[metric]}</span>
    </button>;
  }

  return <section aria-labelledby="weekly-summary-title" className="tm-card rounded-2xl border border-gray-200 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 id="weekly-summary-title" className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">Your week · {period.today > period.weekEnd ? "A look back" : period.phase === "start" ? "A look ahead" : "Week so far"}</h2>
        <p className="mt-1 text-xs text-gray-500">{dateLabel(period.weekStart)} – {dateLabel(period.weekEnd)} · {period.today > period.weekEnd ? "Week complete" : `Through ${dateLabel(period.asOf)}`}</p>
      </div>
      <div className="flex gap-1">
        <button className={smallButton} onClick={onSettings} aria-label="Weekly summary settings">Settings</button>
        <button className={smallButton} onClick={() => onDismiss(period.key)} disabled={saving}>Dismiss this summary</button>
      </div>
    </div>

    <button onClick={() => openTasks(total, completeMetric, "All profiles")} className="mt-4 rounded-lg text-left text-xl font-semibold tracking-tight text-[#315c43] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-700 sm:text-2xl">
      {weeklyProgressCopy(total, period)}
    </button>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{weeklyWorkloadCopy(total, period)}</p>

    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {counters.map((metric) => counter(total, metric, "All profiles"))}
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-300/50 pt-3 text-sm">
      <span className="font-medium text-gray-700">Repeat tasks</span>
      {([
        [repeatCompleteMetric, `${total[repeatCompleteMetric].length} completed ${period.phase === "start" ? period.today > period.weekEnd ? "in the preceding week" : "last week" : period.today > period.weekEnd ? "that week" : "this week"}`],
        ["repeatScheduled", `${total.repeatScheduled.length} scheduled`],
        ["repeatOutstanding", `${total.repeatOutstanding.length} outstanding now`],
      ] as [SummaryMetric, string][]).map(([metric, label]) => <button key={metric} className={`${smallButton} underline decoration-gray-300 underline-offset-4`} onClick={() => openTasks(total, metric, "All profiles")}>{label}</button>)}
    </div>

    <details className="mt-4 border-t border-gray-300/50 pt-3">
      <summary className="cursor-pointer rounded text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-4">Workload detail{profiles.length > 1 ? " and profiles" : ""}</summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["atStart", "added", "completed", "remaining"] as SummaryMetric[]).map((metric) => counter(total, metric, "All profiles", true))}
      </div>
      {total.plannedAhead.length > 0 && <button className={`${smallButton} mt-2 underline underline-offset-4`} onClick={() => openTasks(total, "plannedAhead", "All profiles")}>{total.plannedAhead.length} {total.plannedAhead.length === 1 ? "task added" : "tasks added"} for later — planning ahead</button>}
      {profiles.length > 1 && <div className="mt-4 space-y-3">
        {profiles.map((profile) => <section key={profile.id} className="rounded-xl border border-gray-200 bg-white/40 p-3">
          <Link className="font-semibold text-gray-800 underline decoration-gray-300 underline-offset-4" href={`/p/${encodeURIComponent(profile.id)}`}>{profile.name}</Link>
          <p className="mt-1 text-sm text-gray-600">{weeklyProgressCopy(profile.buckets, period)}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{weeklyWorkloadCopy(profile.buckets, period)}</p>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">{[completeMetric, ...counters, "added", repeatCompleteMetric, "repeatOutstanding"].map((metric) => counter(profile.buckets, metric as SummaryMetric, profile.name, true))}</div>
          <button className={`${smallButton} underline underline-offset-4`} onClick={() => openTasks(profile.buckets, "repeatScheduled", profile.name)}>{profile.buckets.repeatScheduled.length} repeat occurrences scheduled</button>
        </section>)}
      </div>}
      <p className="mt-4 text-xs leading-5 text-gray-500">Active, starting and due counts can overlap. Repeat tasks are counted separately. Counts reflect current task records: rescheduling, reopening or deleting tasks can change the picture of the week. Task counts describe volume, not the effort each task takes.</p>
    </details>

    <dialog ref={dialog} aria-labelledby="weekly-task-list-title" className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-xl backdrop:bg-black/30">
      {selection && <>
        <div className="flex items-start justify-between gap-3">
          <div><h3 id="weekly-task-list-title" className="text-lg font-semibold">{labels[selection.metric]} · {selection.buckets[selection.metric].length}</h3><p className="mt-1 text-sm text-gray-500">{selection.scope}</p></div>
          <button className={smallButton} onClick={() => dialog.current?.close()}>Close</button>
        </div>
        {explanations[selection.metric] && <p className="mt-3 text-sm leading-6 text-gray-600">{explanations[selection.metric]}</p>}
        {selection.buckets[selection.metric].length === 0 ? <p className="py-6 text-sm text-gray-500">No tasks in this group.</p> : <ul className="mt-4 divide-y divide-gray-100">
          {selection.buckets[selection.metric].map((task, index) => <li key={`${task.id}:${task.startDate}:${index}`} className="py-3">
            <p className="break-words font-medium">{task.title}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">{task.projected ? "Schedule estimate" : task.completedOn ? `Completed ${dateLabel(task.completedOn)}` : `Starts ${dateLabel(task.startDate)}`}{task.dueAt ? ` · Due ${dateLabel(task.dueAt)}` : ""}{task.projected ? ` · ${dateLabel(task.startDate)}` : ""}</p>
            <Link className="mt-1 inline-block text-sm underline decoration-gray-300 underline-offset-4" href={`/p/${encodeURIComponent(task.profileId)}`}>Open {profileNames.get(task.profileId) ?? "profile"}</Link>
          </li>)}
        </ul>}
      </>}
    </dialog>
  </section>;
}

export function WeeklySummaryPanel() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState({ ...DEFAULT_WEEKLY_SUMMARY_SETTINGS });
  const requestNumber = useRef(0);
  const savingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestNumber.current += 1; };
  }, []);

  const refresh = useCallback(async () => {
    if (savingRef.current) return;
    const number = ++requestNumber.current;
    try {
      const response = await fetch("/api/weekly-summary", { cache: "no-store" });
      if (!response.ok) throw new Error("Your weekly summary couldn't be loaded. Please try again.");
      const next = await response.json() as SummaryResponse;
      if (mounted.current && number === requestNumber.current) { setData(next); setError(""); }
    } catch (cause) {
      if (mounted.current && number === requestNumber.current) setError(cause instanceof Error ? cause.message : "Could not load your summary.");
    }
  }, []);
  useBrisbaneBoundaryRefresh(() => { void refresh(); });

  async function save(settings: WeeklySummarySettings) {
    if (savingRef.current) return;
    savingRef.current = true;
    ++requestNumber.current;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/weekly-summary", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      if (!response.ok) throw new Error("Your settings couldn't be saved. Please try again.");
      if (!mounted.current) return;
      setData((previous) => ({ settings, summary: previous?.summary ?? null }));
      setSettingsOpen(false);
      savingRef.current = false;
      await refresh();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not save your settings.");
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <div className="mt-4 w-full max-w-4xl sm:mt-5">
    {error && <div role="alert" className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">{error} {!saving && <button className={`${smallButton} underline`} onClick={() => void refresh()}>Retry loading</button>}</div>}
    {!data && !error && <p role="status" className="py-2 text-sm text-gray-500">Loading your week…</p>}
    {data && <WeeklySummaryCard data={data} saving={saving} onSettings={() => { setDraft(data.settings); setSettingsOpen((open) => !open); }} onDismiss={(dismissedKey) => void save({ ...data.settings, dismissedKey })} />}
    {settingsOpen && <form className="mt-3 rounded-xl border border-gray-200 bg-white p-4" onSubmit={(event) => { event.preventDefault(); void save({ ...draft, dismissedKey: null }); }}>
      <h3 className="font-semibold text-gray-800">Weekly summary settings</h3>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Show my weekly summary on the home page</label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["startDay", "endDay"] as const).map((key) => <label key={key} className="text-sm text-gray-600">{key === "startDay" ? "Week-ahead summary" : "Week-in-review summary"}<select className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-800" value={draft[key]} disabled={saving} onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}>{days.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">Weeks run Monday–Sunday in Brisbane time. Your latest summary stays available until the next one. Settings apply across your devices.</p>
      {draft.startDay === draft.endDay && <p role="alert" className="mt-2 text-sm text-gray-600">Choose different days for the two summaries.</p>}
      <div className="mt-4 flex gap-2"><button className="tm-button tm-button-primary rounded-lg px-3 py-2 text-sm disabled:opacity-50" disabled={saving || draft.startDay === draft.endDay}>{saving ? "Saving…" : "Save settings"}</button><button type="button" className={smallButton} disabled={saving} onClick={() => setSettingsOpen(false)}>Cancel</button></div>
    </form>}
  </div>;
}
