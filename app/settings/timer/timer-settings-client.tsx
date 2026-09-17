"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TimerSettingsClient({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateEnabled(nextEnabled: boolean) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/timesheets/timer/widget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timerWidgetEnabled: nextEnabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not update timer setting");
      setEnabled(data.timerWidgetEnabled);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update timer setting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Floating timer widget</h2>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--tm-muted)]">Shows your active profile and elapsed time, lets you start or stop it, and lets you switch profiles without a gap.</p>
        </div>
        <button
          type="button"
          className={enabled ? "tm-button-primary inline-flex h-10 items-center rounded-[10px] border px-4 text-sm disabled:opacity-50" : "tm-button inline-flex h-10 items-center rounded-[10px] border px-4 text-sm disabled:opacity-50"}
          disabled={saving}
          onClick={() => void updateEnabled(!enabled)}
        >
          {saving ? "Saving…" : enabled ? "Widget on" : "Widget off"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
