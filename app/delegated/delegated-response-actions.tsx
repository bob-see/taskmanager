"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type DelegatedResponseActionsProps = {
  delegatedTaskId: string;
  profiles: Array<{
    id: string;
    name: string;
  }>;
};

type ResponseMode = "accept" | "decline";

const textareaClass =
  "tm-input min-h-24 rounded-[10px] border px-3 py-2 text-sm outline-none transition-colors";
const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";

export function DelegatedResponseActions({
  delegatedTaskId,
  profiles,
}: DelegatedResponseActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ResponseMode | null>(null);
  const [note, setNote] = useState("");
  const [profileId, setProfileId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function closeModal() {
    if (saving) return;

    setMode(null);
    setError("");
    setNote("");
    setProfileId("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return;

    setError("");

    setSaving(true);
    try {
      const endpoint =
        mode === "accept"
          ? `/api/delegated/${delegatedTaskId}/accept`
          : `/api/delegated/${delegatedTaskId}/decline`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "accept"
            ? {
                note: note.trim() || null,
                profileId: profileId || null,
              }
            : {
                reason: note.trim() || null,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Could not update delegated task");
      }

      setMode(null);
      setNote("");
      setProfileId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update delegated task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="tm-button-primary inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
          onClick={() => setMode("accept")}
        >
          Accept
        </button>
        <button
          type="button"
          className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
          onClick={() => setMode("decline")}
        >
          Decline
        </button>
      </div>

      {mode ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/35 px-4 py-6 text-left">
          <div className="tm-card max-h-[90vh] w-full max-w-lg overflow-auto rounded-[14px] border p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">
                {mode === "accept" ? "Accept Delegated Task" : "Decline Delegated Task"}
              </h2>
              <button
                type="button"
                className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={submit}>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">
                  {mode === "accept" ? "Note / message" : "Reason / message"}
                </span>
                <textarea
                  className={`w-full ${textareaClass}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>

              {mode === "accept" ? (
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Add to profile</span>
                  <select
                    className={`w-full ${inputClass}`}
                    value={profileId}
                    onChange={(event) => setProfileId(event.target.value)}
                  >
                    <option value="">Do not add to a profile</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {error ? <p className="text-sm text-red-700">{error}</p> : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : mode === "accept"
                      ? "Accept Task"
                      : "Decline Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
