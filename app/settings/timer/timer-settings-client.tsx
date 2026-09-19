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
    <section className="tm-card overflow-hidden rounded-[14px] border shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed text-sm">
          <colgroup><col className="w-[28%]" /><col className="w-[52%]" /><col className="w-[20%]" /></colgroup>
          <thead>
            <tr className="border-b border-[color:var(--tm-border)] bg-white/25 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
              <th className="px-5 py-2">Setting</th><th className="px-3 py-2">Description</th><th className="px-5 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-5 py-3 text-sm font-semibold">Floating timer widget</td>
              <td className="px-3 py-3 text-sm leading-5 text-[color:var(--tm-muted)]">Shows your active profile and elapsed time, lets you start or stop it, and lets you switch profiles without a gap.</td>
              <td className="px-5 py-3 text-center"><button
                type="button"
                className={enabled ? "tm-button-primary inline-flex h-10 items-center rounded-[10px] border px-4 text-sm disabled:opacity-50" : "tm-button inline-flex h-10 items-center rounded-[10px] border px-4 text-sm disabled:opacity-50"}
                disabled={saving}
                onClick={() => void updateEnabled(!enabled)}
              >
                {saving ? "Saving…" : enabled ? "Widget on" : "Widget off"}
              </button></td>
            </tr>
          </tbody>
        </table>
      </div>
      {error ? <p className="border-t border-[color:var(--tm-border)] px-4 py-3 text-sm text-red-700 md:px-5">{error}</p> : null}
    </section>
  );
}
