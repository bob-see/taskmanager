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

export function DelegatedLifecycleActions({
  delegatedTaskId,
  action,
}: DelegatedLifecycleActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/delegated/${delegatedTaskId}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Could not update delegated task");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update delegated task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="tm-button-primary inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-60"
        disabled={saving}
        onClick={submit}
      >
        {saving ? "Saving..." : actionLabels[action]}
      </button>
      {error ? <p className="text-right text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
