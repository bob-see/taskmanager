"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DelegatedLifecycleAction = "start" | "complete" | "close";

type DelegatedLifecycleActionsProps = {
  delegatedTaskId: string;
  action: DelegatedLifecycleAction;
};

const actionLabels: Record<DelegatedLifecycleAction, string> = {
  start: "Start Work",
  complete: "Mark Complete",
  close: "Close Task",
};

const closeButtonClass =
  "inline-flex h-9 items-center justify-center rounded-[10px] border border-emerald-700/25 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(167,243,208,0.72))] px-3 text-sm font-semibold text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_3px_rgba(6,95,70,0.12)] transition hover:border-emerald-700/40 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:ring-offset-[color:var(--tm-card)] disabled:cursor-not-allowed disabled:opacity-60";

export function DelegatedLifecycleActions({
  delegatedTaskId,
  action,
}: DelegatedLifecycleActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.MouseEvent<HTMLButtonElement>) {
    setError("");
    setSaving(true);
    const taskRow = event.currentTarget.closest("tr");
    const activityRow = taskRow?.nextElementSibling as HTMLTableRowElement | null;
    let hidden = false;
    const hideAfterCap = action === "close"
      ? window.setTimeout(() => {
          hidden = true;
          taskRow?.classList.add("hidden");
          activityRow?.classList.add("hidden");
          window.dispatchEvent(new CustomEvent("delegated-task-visibility", { detail: { taskId: delegatedTaskId, hidden: true } }));
        }, 2_000)
      : null;

    try {
      const res = await fetch(`/api/delegated/${delegatedTaskId}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Could not update delegated task");
      }

      if (hideAfterCap) window.clearTimeout(hideAfterCap);
      if (action === "close" && !hidden) {
        taskRow?.classList.add("hidden");
        activityRow?.classList.add("hidden");
        window.dispatchEvent(new CustomEvent("delegated-task-visibility", { detail: { taskId: delegatedTaskId, hidden: true } }));
      }
      router.refresh();
    } catch (err) {
      if (hideAfterCap) window.clearTimeout(hideAfterCap);
      if (hidden) {
        taskRow?.classList.remove("hidden");
        activityRow?.classList.remove("hidden");
        window.dispatchEvent(new CustomEvent("delegated-task-visibility", { detail: { taskId: delegatedTaskId, hidden: false } }));
      }
      setError(err instanceof Error ? err.message : "Could not update delegated task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={
          action === "close"
            ? closeButtonClass
            : "tm-button-primary inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-60"
        }
        disabled={saving}
        onClick={submit}
      >
        {saving ? "Saving..." : actionLabels[action]}
      </button>
      {error ? <p className="text-right text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
