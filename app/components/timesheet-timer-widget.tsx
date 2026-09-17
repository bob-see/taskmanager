"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDuration, type TimesheetRoundingMode } from "@/app/timesheets/timesheet-utils";

type Profile = { id: string; name: string };

type ActiveTimer = {
  id: string;
  profileId: string;
  profileName: string;
  startTime: string;
};

const ROUNDING_STORAGE_KEY = "tm-timesheets-rounding-mode";
const TIMER_CHANGE_EVENT = "taskmanager:timesheet-timer-changed";

function getStoredRoundingMode(): TimesheetRoundingMode {
  const stored = window.localStorage.getItem(ROUNDING_STORAGE_KEY);
  return stored === "exact" || stored === "up-15" || stored === "nearest-15"
    ? stored
    : "nearest-15";
}

function notifyTimerChanged() {
  window.dispatchEvent(new Event(TIMER_CHANGE_EVENT));
}

export function TimesheetTimerWidget({ profiles }: { profiles: Profile[] }) {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id ?? "");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadActiveTimer = useCallback(async () => {
    try {
      const response = await fetch("/api/timesheets/timer", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not load timer");
      setActiveTimer(data.activeTimer ?? null);
      if (data.activeTimer?.profileId) setSelectedProfileId(data.activeTimer.profileId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load timer");
    }
  }, []);

  useEffect(() => {
    void loadActiveTimer();
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    const refreshId = window.setInterval(() => void loadActiveTimer(), 10_000);
    const refresh = () => void loadActiveTimer();
    window.addEventListener(TIMER_CHANGE_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(refreshId);
      window.removeEventListener(TIMER_CHANGE_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadActiveTimer]);

  const elapsed = useMemo(
    () => activeTimer ? Math.max(0, Math.floor((now - new Date(activeTimer.startTime).getTime()) / 60_000)) : 0,
    [activeTimer, now]
  );

  async function startTimer() {
    if (!selectedProfileId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/timesheets/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selectedProfileId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not start timer");
      setActiveTimer(data);
      notifyTimerChanged();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start timer");
      await loadActiveTimer();
    } finally {
      setBusy(false);
    }
  }

  async function stopTimer() {
    if (!activeTimer || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/timesheets/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundingMode: getStoredRoundingMode() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not stop timer");
      setActiveTimer(null);
      notifyTimerChanged();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Could not stop timer");
      await loadActiveTimer();
    } finally {
      setBusy(false);
    }
  }

  async function switchProfile(profileId: string) {
    setSelectedProfileId(profileId);
    if (!activeTimer || activeTimer.profileId === profileId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/timesheets/timer/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, roundingMode: getStoredRoundingMode() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not switch timer profile");
      setActiveTimer(data.activeTimer);
      notifyTimerChanged();
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Could not switch timer profile");
      await loadActiveTimer();
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-[14px] border border-amber-700/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,226,190,0.36))] p-3 shadow-[0_14px_36px_rgba(65,48,22,0.22)] backdrop-blur md:bottom-6 md:right-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--tm-muted)]">Timer</span>
        {activeTimer ? <span className="font-mono text-lg font-semibold tabular-nums">{formatDuration(elapsed)}</span> : <span className="text-sm text-[color:var(--tm-muted)]">Ready</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select
          aria-label="Timer profile"
          className="tm-input min-w-0 flex-1 rounded-[10px] border px-2 py-2 text-sm"
          value={activeTimer?.profileId ?? selectedProfileId}
          disabled={busy || profiles.length === 0}
          onChange={(event) => void switchProfile(event.target.value)}
        >
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
        <button
          type="button"
          className={`tm-button-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border disabled:opacity-50 ${activeTimer ? "text-2xl" : "text-sm"}`}
          disabled={busy || (!activeTimer && !selectedProfileId)}
          onClick={() => void (activeTimer ? stopTimer() : startTimer())}
          aria-label={activeTimer ? "Stop timer" : "Start timer"}
          title={activeTimer ? "Stop timer" : "Start timer"}
        >
          {busy ? "…" : activeTimer ? "■" : "▶"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </aside>
  );
}
