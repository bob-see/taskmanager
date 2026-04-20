"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  calculateLoggedMinutes,
  formatDuration,
  formatHours,
  getWeekDays,
  parseDateOnly,
  startOfWeek,
  toDateOnly,
  toTimeInputValue,
  type TimesheetRoundingMode,
  type TimesheetSource,
} from "@/app/timesheets/timesheet-utils";

type TimesheetProfile = {
  id: string;
  name: string;
};

type TimesheetEntry = {
  id: string;
  profileId: string;
  profileName: string;
  entryDate: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  loggedMinutes: number | null;
  roundingMode: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

type DetailSelection =
  | {
      profileId: string;
      dayKey: string | "week";
    }
  | null;

type ManualEntryFormState = {
  id: string | null;
  profileId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
};

type TimerFormState = {
  profileId: string;
  notes: string;
};

type TimesheetsClientProps = {
  initialWeekStart: string;
  initialProfiles: TimesheetProfile[];
  initialEntries: TimesheetEntry[];
  initialActiveTimer: TimesheetEntry | null;
};

const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";
const primaryButtonClass =
  "tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50";
const segmentClass = "tm-tabset inline-flex rounded-full border p-1 text-sm";
const segmentButtonClass = "tm-tab rounded-full px-3 py-1.5";
const segmentButtonActiveClass = "tm-tab-active rounded-full px-3 py-1.5";
const WEEK_STORAGE_KEY = "tm-timesheets-week-start";
const ROUNDING_STORAGE_KEY = "tm-timesheets-rounding-mode";

function createManualEntryForm(profiles: TimesheetProfile[], dateValue: string): ManualEntryFormState {
  return {
    id: null,
    profileId: profiles[0]?.id ?? "",
    date: dateValue,
    startTime: "09:00",
    endTime: "17:00",
    notes: "",
  };
}

function createTimerForm(profiles: TimesheetProfile[]): TimerFormState {
  return {
    profileId: profiles[0]?.id ?? "",
    notes: "",
  };
}

function getEffectiveLoggedMinutes(entry: TimesheetEntry, roundingMode: TimesheetRoundingMode) {
  if (!entry.endTime) return 0;
  if (entry.roundingMode === roundingMode && entry.loggedMinutes !== null) {
    return entry.loggedMinutes;
  }

  return calculateLoggedMinutes(
    new Date(entry.startTime),
    new Date(entry.endTime),
    roundingMode
  ).loggedMinutes;
}

function getActualDurationMinutes(entry: TimesheetEntry) {
  if (!entry.endTime) return 0;
  if (entry.durationMinutes !== null) {
    return entry.durationMinutes;
  }

  return calculateLoggedMinutes(new Date(entry.startTime), new Date(entry.endTime), "exact")
    .durationMinutes;
}

function formatDateHeading(value: string) {
  return parseDateOnly(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TimesheetsClient({
  initialWeekStart,
  initialProfiles,
  initialEntries,
  initialActiveTimer,
}: TimesheetsClientProps) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [entries, setEntries] = useState(initialEntries);
  const [activeTimer, setActiveTimer] = useState<TimesheetEntry | null>(initialActiveTimer);
  const [selectedWeekStart, setSelectedWeekStart] = useState(initialWeekStart);
  const [roundingMode, setRoundingMode] = useState<TimesheetRoundingMode>("nearest-15");
  const [detailSelection, setDetailSelection] = useState<DetailSelection>(null);
  const [manualForm, setManualForm] = useState(() =>
    createManualEntryForm(initialProfiles, initialWeekStart)
  );
  const [timerForm, setTimerForm] = useState(() => createTimerForm(initialProfiles));
  const [loading, setLoading] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [savingTimer, setSavingTimer] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const weekDays = useMemo(() => getWeekDays(selectedWeekStart), [selectedWeekStart]);
  const roundingOptions: Array<{ value: TimesheetRoundingMode; label: string }> = [
    { value: "exact", label: "Exact" },
    { value: "nearest-15", label: "Nearest 15 min" },
    { value: "up-15", label: "Round up to 15 min" },
  ];

  useEffect(() => {
    const storedWeek = window.localStorage.getItem(WEEK_STORAGE_KEY);
    const storedRounding = window.localStorage.getItem(ROUNDING_STORAGE_KEY);

    if (storedRounding === "exact" || storedRounding === "nearest-15" || storedRounding === "up-15") {
      setRoundingMode(storedRounding);
    }

    if (storedWeek) {
      const normalizedWeek = toDateOnly(startOfWeek(parseDateOnly(storedWeek)));
      if (normalizedWeek !== initialWeekStart) {
        void loadWeekData(normalizedWeek);
      }
      setSelectedWeekStart(normalizedWeek);
      setManualForm((prev) => ({ ...prev, date: normalizedWeek }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WEEK_STORAGE_KEY, selectedWeekStart);
  }, [selectedWeekStart]);

  useEffect(() => {
    window.localStorage.setItem(ROUNDING_STORAGE_KEY, roundingMode);
  }, [roundingMode]);

  useEffect(() => {
    if (!activeTimer) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeTimer]);

  async function loadWeekData(weekStart: string) {
    setLoading(true);

    try {
      const res = await fetch(`/api/timesheets?weekStart=${weekStart}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not load timesheets");
      }

      const data = (await res.json()) as {
        weekStart: string;
        profiles: TimesheetProfile[];
        entries: TimesheetEntry[];
        activeTimer: TimesheetEntry | null;
      };

      setProfiles(data.profiles);
      setEntries(data.entries);
      setActiveTimer(data.activeTimer);
      setSelectedWeekStart(data.weekStart);
      setTimerForm((prev) => ({
        ...prev,
        profileId: prev.profileId || data.profiles[0]?.id || "",
      }));
      setManualForm((prev) => ({
        ...prev,
        profileId: prev.profileId || data.profiles[0]?.id || "",
        date: prev.id ? prev.date : data.weekStart,
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not load timesheets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTimerForm((prev) => ({
      ...prev,
      profileId: prev.profileId || profiles[0]?.id || "",
    }));
    setManualForm((prev) => ({
      ...prev,
      profileId: prev.profileId || profiles[0]?.id || "",
    }));
  }, [profiles]);

  const entriesByProfileDay = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();

    for (const entry of entries) {
      const key = `${entry.profileId}:${entry.entryDate}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(key, [entry]);
      }
    }

    for (const item of map.values()) {
      item.sort((left, right) => left.startTime.localeCompare(right.startTime));
    }

    return map;
  }, [entries]);

  const entriesByProfileWeek = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();

    for (const entry of entries) {
      const existing = map.get(entry.profileId);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(entry.profileId, [entry]);
      }
    }

    for (const item of map.values()) {
      item.sort((left, right) => left.startTime.localeCompare(right.startTime));
    }

    return map;
  }, [entries]);

  const profileTotals = useMemo(() => {
    return new Map(
      profiles.map((profile) => [
        profile.id,
        weekDays.reduce((sum, day) => {
          const dayEntries = entriesByProfileDay.get(`${profile.id}:${day.key}`) ?? [];
          return (
            sum +
            dayEntries.reduce(
              (entrySum, entry) => entrySum + getEffectiveLoggedMinutes(entry, roundingMode),
              0
            )
          );
        }, 0),
      ])
    );
  }, [entriesByProfileDay, profiles, roundingMode, weekDays]);

  const dayTotals = useMemo(() => {
    return new Map(
      weekDays.map((day) => [
        day.key,
        profiles.reduce((sum, profile) => {
          const dayEntries = entriesByProfileDay.get(`${profile.id}:${day.key}`) ?? [];
          return (
            sum +
            dayEntries.reduce(
              (entrySum, entry) => entrySum + getEffectiveLoggedMinutes(entry, roundingMode),
              0
            )
          );
        }, 0),
      ])
    );
  }, [entriesByProfileDay, profiles, roundingMode, weekDays]);

  const overallWeekTotal = useMemo(
    () => Array.from(dayTotals.values()).reduce((sum, value) => sum + value, 0),
    [dayTotals]
  );

  const selectedEntries = useMemo(() => {
    if (!detailSelection) {
      return [];
    }

    return detailSelection.dayKey === "week"
      ? entriesByProfileWeek.get(detailSelection.profileId) ?? []
      : entriesByProfileDay.get(`${detailSelection.profileId}:${detailSelection.dayKey}`) ?? [];
  }, [detailSelection, entriesByProfileDay, entriesByProfileWeek]);

  const selectedProfileName = detailSelection
    ? profiles.find((profile) => profile.id === detailSelection.profileId)?.name ?? "Profile"
    : "";

  async function goToWeek(weekStart: string) {
    if (weekStart === selectedWeekStart) return;
    setDetailSelection(null);
    await loadWeekData(weekStart);
  }

  async function handleStartTimer() {
    if (!timerForm.profileId || savingTimer) return;

    setSavingTimer(true);
    try {
      const res = await fetch("/api/timesheets/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(timerForm),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not start timer");
      }

      const started = (await res.json()) as TimesheetEntry;
      setActiveTimer(started);
      setTimerForm((prev) => ({ ...prev, notes: "" }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not start timer");
    } finally {
      setSavingTimer(false);
    }
  }

  async function handleStopTimer() {
    if (!activeTimer || savingTimer) return;

    setSavingTimer(true);
    try {
      const res = await fetch("/api/timesheets/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundingMode,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not stop timer");
      }

      setActiveTimer(null);
      await loadWeekData(selectedWeekStart);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not stop timer");
    } finally {
      setSavingTimer(false);
    }
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualForm.profileId || savingManual) return;

    setSavingManual(true);
    try {
      const endpoint = manualForm.id
        ? `/api/timesheets/entries/${manualForm.id}`
        : "/api/timesheets/entries";
      const method = manualForm.id ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: manualForm.profileId,
          date: manualForm.date,
          startTime: manualForm.startTime,
          endTime: manualForm.endTime,
          notes: manualForm.notes || null,
          roundingMode,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not save time entry");
      }

      setManualForm(createManualEntryForm(profiles, selectedWeekStart));
      await loadWeekData(selectedWeekStart);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save time entry");
    } finally {
      setSavingManual(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (deletingEntryId || !window.confirm("Delete this time entry?")) {
      return;
    }

    setDeletingEntryId(entryId);
    try {
      const res = await fetch(`/api/timesheets/entries/${entryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not delete time entry");
      }

      await loadWeekData(selectedWeekStart);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete time entry");
    } finally {
      setDeletingEntryId(null);
    }
  }

  function editEntry(entry: TimesheetEntry) {
    setManualForm({
      id: entry.id,
      profileId: entry.profileId,
      date: entry.entryDate,
      startTime: toTimeInputValue(new Date(entry.startTime)),
      endTime: entry.endTime ? toTimeInputValue(new Date(entry.endTime)) : "17:00",
      notes: entry.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeTimerElapsed = activeTimer
    ? calculateLoggedMinutes(new Date(activeTimer.startTime), new Date(now), "exact").durationMinutes
    : 0;

  return (
    <main className="min-h-screen bg-[color:var(--tm-bg)] text-[color:var(--tm-text)]">
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:py-10 xl:px-8 2xl:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Timesheets</h1>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              Log time by profile with a live timer or manual entry, then review the week at a glance.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => void goToWeek(toDateOnly(addDays(parseDateOnly(selectedWeekStart), -7)))}
            >
              Previous week
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => void goToWeek(toDateOnly(startOfWeek(new Date())))}
            >
              This week
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => void goToWeek(toDateOnly(addDays(parseDateOnly(selectedWeekStart), 7)))}
            >
              Next week
            </button>
            <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/70 px-3 py-2 text-sm">
              Week of {formatDateHeading(selectedWeekStart)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
              Rounding
            </span>
            <div className={segmentClass}>
              {roundingOptions.map((option) => {
                const active = roundingMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={active ? segmentButtonActiveClass : segmentButtonClass}
                    onClick={() => setRoundingMode(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <article className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Live timer</h2>
                <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                  Only one timer can run at a time across the app.
                </p>
              </div>
              {activeTimer && (
                <div className="rounded-full border border-[color:var(--tm-border)] bg-white/70 px-3 py-1 text-sm font-medium">
                  Running {formatDuration(activeTimerElapsed)}
                </div>
              )}
            </div>

            {activeTimer ? (
              <div className="mt-4 rounded-[12px] border border-[color:var(--tm-border)] bg-white/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{activeTimer.profileName}</div>
                    <div className="mt-1 text-sm text-[color:var(--tm-muted)]">
                      Started {new Date(activeTimer.startTime).toLocaleString()}
                    </div>
                    {activeTimer.notes && (
                      <div className="mt-2 text-sm text-[color:var(--tm-muted)]">
                        {activeTimer.notes}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => void handleStopTimer()}
                    disabled={savingTimer}
                  >
                    {savingTimer ? "Stopping…" : "Stop timer"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                <select
                  className={inputClass}
                  value={timerForm.profileId}
                  onChange={(event) =>
                    setTimerForm((prev) => ({ ...prev, profileId: event.target.value }))
                  }
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <input
                  className={inputClass}
                  placeholder="Optional notes"
                  value={timerForm.notes}
                  onChange={(event) =>
                    setTimerForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => void handleStartTimer()}
                  disabled={savingTimer || !timerForm.profileId}
                >
                  {savingTimer ? "Starting…" : "Start timer"}
                </button>
              </div>
            )}
          </article>

          <article className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {manualForm.id ? "Edit time entry" : "Manual entry"}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                  Real times are stored, and displayed totals follow the current rounding mode.
                </p>
              </div>
              {manualForm.id && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setManualForm(createManualEntryForm(profiles, selectedWeekStart))}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleManualSubmit}>
              <select
                className={inputClass}
                value={manualForm.profileId}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, profileId: event.target.value }))
                }
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className={inputClass}
                value={manualForm.date}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, date: event.target.value }))
                }
              />
              <input
                type="time"
                className={inputClass}
                value={manualForm.startTime}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, startTime: event.target.value }))
                }
              />
              <input
                type="time"
                className={inputClass}
                value={manualForm.endTime}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, endTime: event.target.value }))
                }
              />
              <textarea
                className="tm-input min-h-24 rounded-[10px] border px-3 py-2 text-sm outline-none transition-colors md:col-span-2"
                placeholder="Optional notes"
                value={manualForm.notes}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={savingManual || !manualForm.profileId}
                >
                  {savingManual ? "Saving…" : manualForm.id ? "Save changes" : "Add entry"}
                </button>
              </div>
            </form>
          </article>
        </section>

        <section className="mt-6 tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Weekly totals</h2>
              <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                {loading ? "Refreshing week…" : "Click a day or weekly total to inspect the underlying entries."}
              </p>
            </div>
            <div className="rounded-full border border-[color:var(--tm-border)] bg-white/70 px-3 py-1 text-sm font-medium">
              Overall {formatHours(overallWeekTotal)}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                  <th className="px-3 py-2">Profile</th>
                  {weekDays.map((day) => (
                    <th key={day.key} className="px-3 py-2">
                      <div>{day.label}</div>
                      <div className="mt-1 normal-case tracking-normal">{day.shortDate}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2">Weekly total</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-[color:var(--tm-border)]">
                    <td className="px-3 py-3 font-medium">{profile.name}</td>
                    {weekDays.map((day) => {
                      const minutes = (entriesByProfileDay.get(`${profile.id}:${day.key}`) ?? []).reduce(
                        (sum, entry) => sum + getEffectiveLoggedMinutes(entry, roundingMode),
                        0
                      );

                      return (
                        <td key={day.key} className="px-3 py-3">
                          <button
                            type="button"
                            className={`w-full rounded-[10px] px-2 py-2 text-left transition ${
                              detailSelection?.profileId === profile.id &&
                              detailSelection?.dayKey === day.key
                                ? "bg-white shadow-sm ring-1 ring-[color:var(--tm-border)]"
                                : "hover:bg-white/70"
                            }`}
                            onClick={() =>
                              setDetailSelection((prev) =>
                                prev?.profileId === profile.id && prev?.dayKey === day.key
                                  ? null
                                  : { profileId: profile.id, dayKey: day.key }
                              )
                            }
                          >
                            <span className={minutes > 0 ? "font-medium" : "text-[color:var(--tm-muted)]"}>
                              {minutes > 0 ? formatHours(minutes) : "—"}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className={`w-full rounded-[10px] px-2 py-2 text-left transition ${
                          detailSelection?.profileId === profile.id &&
                          detailSelection?.dayKey === "week"
                            ? "bg-white shadow-sm ring-1 ring-[color:var(--tm-border)]"
                            : "hover:bg-white/70"
                        }`}
                        onClick={() =>
                          setDetailSelection((prev) =>
                            prev?.profileId === profile.id && prev?.dayKey === "week"
                              ? null
                              : { profileId: profile.id, dayKey: "week" }
                          )
                        }
                      >
                        <span
                          className={
                            (profileTotals.get(profile.id) ?? 0) > 0
                              ? "font-semibold"
                              : "text-[color:var(--tm-muted)]"
                          }
                        >
                          {(profileTotals.get(profile.id) ?? 0) > 0
                            ? formatHours(profileTotals.get(profile.id) ?? 0)
                            : "—"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-white/40">
                  <td className="px-3 py-3 font-semibold">Totals</td>
                  {weekDays.map((day) => (
                    <td key={day.key} className="px-3 py-3 font-semibold">
                      {dayTotals.get(day.key) ? formatHours(dayTotals.get(day.key) ?? 0) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-3 font-semibold">{formatHours(overallWeekTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {detailSelection && (
            <div className="mt-4 rounded-[12px] border border-[color:var(--tm-border)] bg-white/55 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">
                    {selectedProfileName}{" "}
                    {detailSelection.dayKey === "week"
                      ? "for the week"
                      : `on ${formatDateHeading(detailSelection.dayKey)}`}
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                    {selectedEntries.length} {selectedEntries.length === 1 ? "entry" : "entries"}
                  </p>
                </div>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setDetailSelection(null)}
                >
                  Close
                </button>
              </div>

              {selectedEntries.length === 0 ? (
                <div className="mt-3 text-sm text-[color:var(--tm-muted)]">
                  No entries for this selection.
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {selectedEntries.map((entry) => {
                    const actualMinutes = getActualDurationMinutes(entry);
                    const roundedMinutes = getEffectiveLoggedMinutes(entry, roundingMode);

                    return (
                      <div
                        key={entry.id}
                        className="rounded-[12px] border border-[color:var(--tm-border)] bg-[color:var(--tm-card)]/65 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              {formatDateTime(entry.startTime)} to{" "}
                              {entry.endTime ? formatDateTime(entry.endTime) : "Running"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-[color:var(--tm-muted)]">
                              <span className="tm-chip rounded-full border px-2 py-0.5">
                                {entry.source as TimesheetSource}
                              </span>
                              <span className="tm-chip rounded-full border px-2 py-0.5">
                                Actual {formatDuration(actualMinutes)}
                              </span>
                              <span className="tm-chip rounded-full border px-2 py-0.5">
                                Logged {formatDuration(roundedMinutes)}
                              </span>
                              <span className="tm-chip rounded-full border px-2 py-0.5">
                                {roundingMode}
                              </span>
                            </div>
                            {entry.notes && (
                              <div className="mt-2 text-sm text-[color:var(--tm-muted)]">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={buttonClass}
                              onClick={() => editEntry(entry)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={buttonClass}
                              onClick={() => void handleDeleteEntry(entry.id)}
                              disabled={deletingEntryId === entry.id}
                            >
                              {deletingEntryId === entry.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
