"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  calculateLoggedMinutes,
  formatDuration,
  formatHours,
  getWeekDays,
  parseDateOnly,
  toDateOnly,
  toTimeInputValue,
  type TimesheetRoundingMode,
  type TimesheetSource,
} from "@/app/timesheets/timesheet-utils";
import {
  advanceDateIfCurrent,
  formatAustralianDate,
  formatBrisbaneTimestamp,
  getBrisbaneDate,
  getMondayWeekStart,
} from "@/app/lib/date-time";
import { useBrisbaneBoundaryRefresh } from "@/app/lib/use-brisbane-boundary-refresh";

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
  initialDate: string;
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
const ROUNDING_STORAGE_KEY = "tm-timesheets-rounding-mode";
const ACTIVITY_COLLAPSE_THRESHOLD = 8;
const profileColourPalette = [
  { bar: "rgba(74, 124, 89, 0.72)", surface: "rgba(74, 124, 89, 0.1)", border: "rgba(74, 124, 89, 0.24)" },
  { bar: "rgba(184, 123, 46, 0.72)", surface: "rgba(184, 123, 46, 0.1)", border: "rgba(184, 123, 46, 0.24)" },
  { bar: "rgba(64, 112, 155, 0.72)", surface: "rgba(64, 112, 155, 0.1)", border: "rgba(64, 112, 155, 0.24)" },
  { bar: "rgba(130, 91, 145, 0.68)", surface: "rgba(130, 91, 145, 0.1)", border: "rgba(130, 91, 145, 0.22)" },
  { bar: "rgba(116, 117, 70, 0.72)", surface: "rgba(116, 117, 70, 0.1)", border: "rgba(116, 117, 70, 0.24)" },
];

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
  return formatAustralianDate(value, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return formatBrisbaneTimestamp(value, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimerStarted(value: string) {
  return formatBrisbaneTimestamp(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatActivityRange(entry: TimesheetEntry) {
  return `${formatDateTime(entry.startTime)} - ${
    entry.endTime ? formatDateTime(entry.endTime) : "now"
  }`;
}

function getProfileColour(profileId: string) {
  let hash = 0;

  for (const char of profileId) {
    hash = (hash * 31 + char.charCodeAt(0)) % profileColourPalette.length;
  }

  return profileColourPalette[hash];
}

function getEntryDayKey(entry: TimesheetEntry) {
  return toDateOnly(new Date(entry.startTime));
}

export function TimesheetsClient({
  initialDate,
  initialWeekStart,
  initialProfiles,
  initialEntries,
  initialActiveTimer,
}: TimesheetsClientProps) {
  const [currentDateValue, setCurrentDateValue] = useState(initialDate);
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
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [activityExpansionOverride, setActivityExpansionOverride] = useState<
    "expanded" | "collapsed" | null
  >(null);
  const initialDateRefreshRef = useRef(true);
  const currentDateValueRef = useRef(initialDate);

  const weekDays = useMemo(() => getWeekDays(selectedWeekStart), [selectedWeekStart]);
  const roundingOptions: Array<{ value: TimesheetRoundingMode; label: string }> = [
    { value: "exact", label: "Exact" },
    { value: "nearest-15", label: "Nearest 15 min" },
    { value: "up-15", label: "Round up to 15 min" },
  ];

  useEffect(() => {
    const storedRounding = window.localStorage.getItem(ROUNDING_STORAGE_KEY);

    if (storedRounding === "exact" || storedRounding === "nearest-15" || storedRounding === "up-15") {
      setRoundingMode(storedRounding);
    }
  }, []);

  useBrisbaneBoundaryRefresh((now) => {
    const clientDate = getBrisbaneDate(now);
    const previousDate = currentDateValueRef.current;
    currentDateValueRef.current = clientDate;
    setCurrentDateValue(clientDate);

    const currentWeekStart = getMondayWeekStart(clientDate);
    if (initialDateRefreshRef.current) {
      initialDateRefreshRef.current = false;
      if (selectedWeekStart !== currentWeekStart) {
        setDetailSelection(null);
        void loadWeekData(currentWeekStart);
      }
      return;
    }

    const previousWeekStart = getMondayWeekStart(previousDate);
    const nextSelectedWeek = advanceDateIfCurrent(
      selectedWeekStart,
      previousWeekStart,
      currentWeekStart
    );
    if (nextSelectedWeek !== selectedWeekStart) {
      setDetailSelection(null);
      void loadWeekData(nextSelectedWeek);
    }
  });

  useEffect(() => {
    window.localStorage.setItem(ROUNDING_STORAGE_KEY, roundingMode);
  }, [roundingMode]);

  useEffect(() => {
    setActivityExpansionOverride(null);
  }, [selectedWeekStart]);

  useEffect(() => {
    if (!activeTimer) {
      setNow(null);
      return;
    }

    setNow(Date.now());

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
      const key = `${entry.profileId}:${getEntryDayKey(entry)}`;
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

  const selectedActivityDate = useMemo(() => {
    if (detailSelection?.dayKey && detailSelection.dayKey !== "week") {
      return detailSelection.dayKey;
    }

    const selectedWeekHasToday = weekDays.some((day) => day.key === currentDateValue);
    return selectedWeekHasToday ? currentDateValue : selectedWeekStart;
  }, [currentDateValue, detailSelection, selectedWeekStart, weekDays]);

  useEffect(() => {
    setActivityExpansionOverride(null);
  }, [selectedActivityDate]);

  const runningTimerMinutes = activeTimer && now !== null
    ? calculateLoggedMinutes(new Date(activeTimer.startTime), new Date(now), "exact").durationMinutes
    : 0;

  const runningTimerLoggedMinutes = activeTimer && now !== null
    ? calculateLoggedMinutes(new Date(activeTimer.startTime), new Date(now), roundingMode).loggedMinutes
    : 0;

  const activityEntries = useMemo(() => {
    const completedEntries = entries
      .filter((entry) => getEntryDayKey(entry) === selectedActivityDate)
      .sort((left, right) => left.startTime.localeCompare(right.startTime));

    if (activeTimer && getEntryDayKey(activeTimer) === selectedActivityDate) {
      return [...completedEntries, activeTimer].sort((left, right) =>
        left.startTime.localeCompare(right.startTime)
      );
    }

    return completedEntries;
  }, [activeTimer, entries, selectedActivityDate]);

  const todaySplitRows = useMemo(() => {
    const totals = new Map<string, { profileName: string; minutes: number }>();

    for (const entry of entries) {
      if (getEntryDayKey(entry) !== selectedActivityDate) continue;

      const existing = totals.get(entry.profileId) ?? {
        profileName: entry.profileName,
        minutes: 0,
      };
      existing.minutes += getEffectiveLoggedMinutes(entry, roundingMode);
      totals.set(entry.profileId, existing);
    }

    if (activeTimer && getEntryDayKey(activeTimer) === selectedActivityDate) {
      const existing = totals.get(activeTimer.profileId) ?? {
        profileName: activeTimer.profileName,
        minutes: 0,
      };
      existing.minutes += runningTimerLoggedMinutes;
      totals.set(activeTimer.profileId, existing);
    }

    return Array.from(totals.entries())
      .map(([profileId, value]) => ({ profileId, ...value }))
      .filter((row) => row.minutes > 0)
      .sort((left, right) => right.minutes - left.minutes || left.profileName.localeCompare(right.profileName));
  }, [activeTimer, entries, roundingMode, runningTimerLoggedMinutes, selectedActivityDate]);

  const todayTotalMinutes = useMemo(
    () => todaySplitRows.reduce((sum, row) => sum + row.minutes, 0),
    [todaySplitRows]
  );

  const longestActivityMinutes = useMemo(() => {
    return activityEntries.reduce((longest, entry) => {
      const duration = entry.endTime
        ? getActualDurationMinutes(entry)
        : runningTimerMinutes;
      return Math.max(longest, duration);
    }, 0);
  }, [activityEntries, runningTimerMinutes]);

  const contextSwitches = useMemo(() => {
    return activityEntries.reduce((count, entry, index) => {
      if (index === 0) return count;
      return activityEntries[index - 1].profileId === entry.profileId ? count : count + 1;
    }, 0);
  }, [activityEntries]);

  const activityHasManyEntries = activityEntries.length > ACTIVITY_COLLAPSE_THRESHOLD;
  const activityDefaultExpanded = activityEntries.length > 0 && !activityHasManyEntries;
  const showActivityEntries =
    activityEntries.length > 0 &&
    (activityExpansionOverride
      ? activityExpansionOverride === "expanded"
      : activityDefaultExpanded);
  const maxTodaySplitMinutes = todaySplitRows[0]?.minutes ?? 0;

  const selectedProfileName = detailSelection
    ? profiles.find((profile) => profile.id === detailSelection.profileId)?.name ?? "Profile"
    : "";

  async function goToWeek(weekStart: string) {
    if (weekStart === selectedWeekStart) return;
    setDetailSelection(null);
    await loadWeekData(weekStart);
  }

  function goToCurrentWeek() {
    const actionDate = getBrisbaneDate(new Date());
    setCurrentDateValue(actionDate);
    void goToWeek(getMondayWeekStart(actionDate));
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
    if (deletingEntryId) {
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

      setPendingDeleteEntryId(null);
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
      date: getEntryDayKey(entry),
      startTime: toTimeInputValue(new Date(entry.startTime)),
      endTime: entry.endTime ? toTimeInputValue(new Date(entry.endTime)) : "17:00",
      notes: entry.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeTimerElapsed = runningTimerMinutes;

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
              onClick={goToCurrentWeek}
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

        <section className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-stretch">
          <article
            className={`tm-card rounded-[14px] border p-4 shadow-sm md:p-5 ${
              activeTimer ? "ring-1 ring-amber-700/20 shadow-[0_10px_28px_rgba(120,78,24,0.1)]" : ""
            }`}
          >
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
              <div className="mt-4 rounded-[12px] border border-amber-700/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,226,190,0.36))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{activeTimer.profileName}</div>
                    <div className="mt-1 text-sm text-[color:var(--tm-muted)]">
                      Started {formatTimerStarted(activeTimer.startTime)}
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

            <div className="mt-5 border-t border-[color:var(--tm-border)] pt-4">
              <h3 className="text-sm font-semibold tracking-tight">Today&apos;s Stats</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[color:var(--tm-border)] bg-white/45 px-3 py-2 text-sm">
                  <span className="text-[color:var(--tm-muted)]">Today Total</span>
                  <span className="font-medium">{formatDuration(todayTotalMinutes)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[color:var(--tm-border)] bg-white/45 px-3 py-2 text-sm">
                  <span className="text-[color:var(--tm-muted)]">Sessions</span>
                  <span className="font-medium">{activityEntries.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[color:var(--tm-border)] bg-white/45 px-3 py-2 text-sm">
                  <span className="text-[color:var(--tm-muted)]">Context Switches</span>
                  <span className="font-medium">{contextSwitches}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[color:var(--tm-border)] bg-white/45 px-3 py-2 text-sm">
                  <span className="text-[color:var(--tm-muted)]">Longest Block</span>
                  <span className="font-medium">
                    {longestActivityMinutes > 0 ? formatDuration(longestActivityMinutes) : "0m"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-[color:var(--tm-border)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-tight">Today&apos;s Time Split</h3>
                <span className="text-xs text-[color:var(--tm-muted)]">{roundingMode}</span>
              </div>

              {todaySplitRows.length === 0 ? (
                <div className="mt-3 rounded-[10px] border border-dashed border-[color:var(--tm-border)] bg-white/35 px-3 py-2 text-sm text-[color:var(--tm-muted)]">
                  No time logged today.
                </div>
              ) : (
                <div className="mt-3 grid gap-2.5">
                  {todaySplitRows.map((row) => {
                    const colour = getProfileColour(row.profileId);
                    const percentage = maxTodaySplitMinutes > 0
                      ? Math.max(7, Math.round((row.minutes / maxTodaySplitMinutes) * 100))
                      : 0;

                    return (
                      <div key={row.profileId} className="grid grid-cols-[minmax(72px,1fr)_minmax(0,2fr)_auto] items-center gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium">{row.profileName}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-white/55">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percentage}%`, backgroundColor: colour.bar }}
                          />
                        </div>
                        <span className="shrink-0 text-[color:var(--tm-muted)]">
                          {formatDuration(row.minutes)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
                              onClick={() => setPendingDeleteEntryId(entry.id)}
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

        <section className="mt-4 tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Today&apos;s Activity · {formatDateHeading(selectedActivityDate)} ·{" "}
                {activityEntries.length} {activityEntries.length === 1 ? "session" : "sessions"} ·{" "}
                {formatDuration(todayTotalMinutes)}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                Chronological start and stop activity for the selected date.
              </p>
            </div>
            {activityEntries.length > 0 && (
              <button
                type="button"
                className={buttonClass}
                onClick={() =>
                  setActivityExpansionOverride(showActivityEntries ? "collapsed" : "expanded")
                }
              >
                {showActivityEntries ? "Collapse" : "Expand"}
              </button>
            )}
          </div>

          {activityEntries.length === 0 ? (
            <div className="mt-3 rounded-[10px] border border-dashed border-[color:var(--tm-border)] bg-white/35 px-3 py-2 text-sm text-[color:var(--tm-muted)]">
              No activity logged today.
            </div>
          ) : showActivityEntries ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {activityEntries.map((entry) => {
                const isRunning = !entry.endTime;
                const duration = isRunning ? runningTimerMinutes : getActualDurationMinutes(entry);
                const colour = getProfileColour(entry.profileId);

                return (
                  <div
                    key={entry.id}
                    className="rounded-[10px] border px-3 py-2 text-sm"
                    style={{ backgroundColor: colour.surface, borderColor: colour.border }}
                  >
                    <div className="grid gap-2 md:grid-cols-[minmax(112px,1fr)_minmax(90px,0.8fr)_auto] md:items-center">
                      <div className="font-medium">{formatActivityRange(entry)}</div>
                      <div className="min-w-0 truncate">{entry.profileName}</div>
                      <div className="font-medium text-[color:var(--tm-muted)]">
                        {isRunning ? `Running ${formatDuration(duration)}` : formatDuration(duration)}
                      </div>
                    </div>
                    {entry.notes && (
                      <div className="mt-1 text-xs text-[color:var(--tm-muted)]">
                        {entry.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-[10px] border border-dashed border-[color:var(--tm-border)] bg-white/35 px-3 py-2 text-sm text-[color:var(--tm-muted)]">
              Activity list collapsed.
            </div>
          )}
        </section>
      </div>
      {pendingDeleteEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="tm-card w-full max-w-md rounded-[14px] border p-5 shadow-xl">
            <h3 className="text-lg font-semibold tracking-tight">Delete time entry?</h3>
            <p className="mt-2 text-sm text-[color:var(--tm-muted)]">
              This will permanently remove this time entry.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={buttonClass}
                onClick={() => setPendingDeleteEntryId(null)}
                disabled={Boolean(deletingEntryId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => void handleDeleteEntry(pendingDeleteEntryId)}
                disabled={Boolean(deletingEntryId)}
              >
                {deletingEntryId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
