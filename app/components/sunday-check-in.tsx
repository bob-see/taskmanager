"use client";

import { useEffect, useState } from "react";

type CheckInProfile = {
  id: string;
  name: string;
};

type CheckInSummary = {
  completedTasks: number;
  bestCompletionDay: { day: string; count: number } | null;
  routineStreaks: Array<{ projectName: string; days: number }>;
};

type CheckInStatus = {
  available: boolean;
  completed?: boolean;
  profileName?: string;
  summary?: CheckInSummary;
};

const REFLECTION_OPTIONS = [
  "I looked after my health",
  "I completed my routines",
  "I stayed organised",
  "I kept up with school",
  "Something else",
];

function checkInApiUrl(profileId: string) {
  const params = new URLSearchParams({ profileId });
  if (process.env.NODE_ENV !== "production") params.set("dev", "1");
  return `/api/sunday-check-in?${params.toString()}`;
}

function RoutineStreaks({ summary }: { summary: CheckInSummary }) {
  const activeStreaks = summary.routineStreaks.filter((streak) => streak.days > 0);

  if (activeStreaks.length === 0) {
    return <div className="text-sm font-medium text-[#685943]">A fresh start</div>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeStreaks.map((streak) => (
        <span
          key={streak.projectName}
          className="tm-sunday-streak-chip inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs"
          aria-label={`${streak.projectName}, ${streak.days} day streak`}
        >
          <span className="font-medium">{streak.projectName}</span>
          <span aria-hidden="true" className="opacity-45">·</span>
          <span className="font-mono font-semibold tabular-nums">{streak.days}d</span>
        </span>
      ))}
    </div>
  );
}

function Summary({ summary }: { summary: CheckInSummary }) {

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/65 px-3 py-2.5">
        <div className="font-mono text-xl font-semibold tabular-nums">
          {summary.completedTasks}
        </div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
          Tasks completed
        </div>
      </div>
      <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/65 px-3 py-2.5">
        <div className="truncate text-sm font-semibold">
          {summary.bestCompletionDay?.day ?? "A steady week"}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
          {summary.bestCompletionDay
            ? `${summary.bestCompletionDay.count} completed · best day`
            : "Best day"}
        </div>
      </div>
      <div className="col-span-2 rounded-[10px] border border-[color:var(--tm-border)] bg-white/65 px-3 py-2.5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
          Routine streaks
        </div>
        <RoutineStreaks summary={summary} />
      </div>
    </div>
  );
}

export function SundayCheckIn({
  profile,
  variant = "primary",
}: {
  profile: CheckInProfile;
  variant?: "primary" | "compact";
}) {
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(checkInApiUrl(profile.id), { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as CheckInStatus;
        if (!cancelled) setStatus(response.ok ? body : { available: false });
      } catch {
        if (!cancelled) setStatus({ available: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  if (!status?.available || !status.summary) return null;

  const completed = Boolean(status.completed);

  async function saveCheckIn() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(checkInApiUrl(profile.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, selectedOptions, reflection }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Could not save check-in");

      setStatus((current) => (current ? { ...current, completed: true } : current));
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save check-in");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section
        className={`tm-sunday-check-in w-full overflow-hidden rounded-[14px] border ${
          variant === "compact" ? "px-3 py-3 sm:px-4" : "px-4 py-4 sm:px-6 sm:py-5"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#806b50]">
              Weekly reflection · {status.profileName ?? profile.name}
            </div>
            <h2 className={`${variant === "compact" ? "mt-1 text-base" : "mt-1 text-xl"} font-semibold`}>
              Sunday Check-In
            </h2>
            <p className="mt-1 text-sm leading-5 text-[color:var(--tm-muted)]">
              {completed
                ? "Check-in complete for this week."
                : "Take a minute to notice what went well this week."}
            </p>
          </div>

          {!completed && (
            <button
              className="tm-button-primary inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border px-4 text-sm font-medium"
              type="button"
              onClick={() => setOpen(true)}
            >
              Start check-in
            </button>
          )}
        </div>

        {variant === "primary" ? (
          <Summary summary={status.summary} />
        ) : (
          <div className="mt-3 border-t border-[rgba(139,105,63,0.16)] pt-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#806b50]">
              Routine streaks
            </div>
            <RoutineStreaks summary={status.summary} />
          </div>
        )}
      </section>

      {open && (
        <div className="tm-overlay fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="tm-card max-h-[92vh] w-full overflow-y-auto rounded-t-[20px] border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:rounded-[16px] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sunday-check-in-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#806b50]">
                  Weekly reflection
                </div>
                <h2 id="sunday-check-in-title" className="mt-1 text-xl font-semibold">
                  Sunday Check-In
                </h2>
                <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                  Notice the things that helped you feel like yourself this week.
                </p>
              </div>
              <button
                className="tm-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border text-lg"
                type="button"
                aria-label="Close Sunday Check-In"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <Summary summary={status.summary} />

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">What felt meaningful this week?</legend>
              <div className="mt-2 space-y-2">
                {REFLECTION_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className="tm-choice flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(option)}
                      onChange={(event) =>
                        setSelectedOptions((current) =>
                          event.target.checked
                            ? [...current, option]
                            : current.filter((item) => item !== option)
                        )
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-5 block text-sm font-semibold">
              Anything else you would like to remember? <span className="font-normal text-[color:var(--tm-muted)]">Optional</span>
              <textarea
                className="tm-input mt-2 min-h-28 w-full resize-y rounded-[10px] border px-3 py-2 text-sm font-normal"
                maxLength={2000}
                placeholder="A small win, something you learned, or a moment that felt good…"
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
              />
            </label>

            {error && (
              <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="tm-button min-h-11 rounded-[10px] border px-4 text-sm"
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Not now
              </button>
              <button
                className="tm-button-primary min-h-11 rounded-[10px] border px-4 text-sm font-medium disabled:opacity-50"
                type="button"
                disabled={saving || (selectedOptions.length === 0 && !reflection.trim())}
                onClick={() => void saveCheckIn()}
              >
                {saving ? "Saving…" : "Complete check-in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
