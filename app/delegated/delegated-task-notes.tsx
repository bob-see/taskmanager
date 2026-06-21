"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type DelegatedTaskNote = {
  id: string;
  content: string;
  createdAt: Date | string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type DelegatedTaskNotesProps = {
  delegatedTaskId: string;
  notes: DelegatedTaskNote[];
};

const noteDateFormatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Australia/Brisbane",
  hour12: true,
});

function formatNoteDate(value: Date | string) {
  return noteDateFormatter.format(new Date(value));
}

function formatUser(user: DelegatedTaskNote["user"]) {
  if (!user) return "Unknown";
  return user.name?.trim() || user.email || "Unknown";
}

export function DelegatedTaskNotes({ delegatedTaskId, notes }: DelegatedTaskNotesProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = note.trim();
    if (!trimmed) return;

    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/delegated/${delegatedTaskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Could not add note");
      }

      setNote("");
      setExpanded(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[12px] border border-[color:var(--tm-border)] bg-white/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-sm font-medium underline-offset-4 hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          Notes / Activity ({notes.length})
        </button>
        <span className="text-xs text-[color:var(--tm-muted)]">
          {notes[0] ? `Latest ${formatNoteDate(notes[0].createdAt)}` : "No notes yet"}
        </span>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {notes.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {notes.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/45 p-3 text-sm"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--tm-muted)]">
                    <span>{formatUser(item.user)}</span>
                    <span>{formatNoteDate(item.createdAt)}</span>
                  </div>
                  <div className="whitespace-pre-wrap leading-5">{item.content}</div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[color:var(--tm-muted)]">No notes yet.</p>
          )}

          <form className="space-y-2" onSubmit={submit}>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Add note</span>
              <textarea
                className="tm-input min-h-20 w-full rounded-[10px] border px-3 py-2 text-sm outline-none transition-colors"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {error ? <p className="text-sm text-red-700">{error}</p> : <span />}
              <button
                type="submit"
                className="tm-button-primary inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-60"
                disabled={saving || !note.trim()}
              >
                {saving ? "Saving..." : "Add note"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
