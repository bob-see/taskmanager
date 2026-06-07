"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DelegatedTaskStatus } from "./delegated-status-badge";

type DelegationUser = {
  id: string;
  name: string;
  email: string | null;
};

type ExistingTaskMode = {
  mode: "existing";
  taskId: string;
  taskTitle: string;
};

type NewTaskMode = {
  mode: "new";
};

type DelegateTaskModalProps = {
  open: boolean;
  mode: ExistingTaskMode | NewTaskMode;
  onClose: () => void;
  onDelegated: (delegation?: { id: string; status: DelegatedTaskStatus }) => void;
};

const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const textareaClass =
  "tm-input min-h-24 rounded-[10px] border px-3 py-2 text-sm outline-none transition-colors";

function userLabel(user: DelegationUser) {
  return user.email ? `${user.name} (${user.email})` : user.name;
}

export function DelegateTaskModal({
  open,
  mode,
  onClose,
  onDelegated,
}: DelegateTaskModalProps) {
  const [users, setUsers] = useState<DelegationUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isNewTask = mode.mode === "new";
  const selectedUser = useMemo(
    () => users.find((user) => user.id === assignedToUserId) ?? null,
    [assignedToUserId, users]
  );

  useEffect(() => {
    if (!open) return;

    setError("");
    setUsersError("");
    setAssignedToUserId("");
    setMessage("");
    setDetails("");
    setDueAt("");
    setTitle("");
    setUsersLoading(true);

    fetch("/api/delegated/users", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(data?.error ?? "Could not load users");
        }
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        setUsersError(err instanceof Error ? err.message : "Could not load users");
      })
      .finally(() => setUsersLoading(false));
  }, [open]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!assignedToUserId) {
      setError("Choose a user to assign this task to.");
      return;
    }

    if (isNewTask && !title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        isNewTask ? "/api/delegated" : `/api/tasks/${mode.taskId}/delegate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isNewTask
              ? {
                  title: title.trim(),
                  details: details.trim() || null,
                  dueAt: dueAt || null,
                  assignedToUserId,
                  message: message.trim() || null,
                }
              : {
                  assignedToUserId,
                  message: message.trim() || null,
                }
          ),
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Could not delegate task");
      }

      onDelegated(data?.delegatedTask ?? data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delegate task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/35 px-4 py-6">
      <div className="tm-card max-h-[90vh] w-full max-w-lg overflow-auto rounded-[14px] border p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Delegate Task</h2>
            {mode.mode === "existing" ? (
              <p className="tm-muted mt-1 line-clamp-2 text-sm">{mode.taskTitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {isNewTask ? (
            <>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Task title</span>
                <input
                  className={`w-full ${inputClass}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Details</span>
                <textarea
                  className={`w-full ${textareaClass}`}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Due date</span>
                <input
                  className={`w-full ${inputClass}`}
                  type="date"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
            </>
          ) : null}

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Assign to</span>
            <select
              className={`w-full ${inputClass}`}
              disabled={usersLoading || users.length === 0}
              value={assignedToUserId}
              onChange={(event) => setAssignedToUserId(event.target.value)}
            >
              <option value="">
                {usersLoading ? "Loading users..." : "Choose a user"}
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {userLabel(user)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Message / note</span>
            <textarea
              className={`w-full ${textareaClass}`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          {selectedUser ? (
            <p className="tm-muted text-xs">This will be assigned to {userLabel(selectedUser)}.</p>
          ) : null}
          {usersError ? <p className="text-sm text-red-700">{usersError}</p> : null}
          {users.length === 0 && !usersLoading && !usersError ? (
            <p className="text-sm text-red-700">No other users are available.</p>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50"
              disabled={saving || usersLoading || users.length === 0}
            >
              {saving ? "Delegating..." : "Delegate Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
