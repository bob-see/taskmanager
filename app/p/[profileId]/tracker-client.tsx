"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  name: string;
};

type Task = {
  id: string;
  title: string;
  startDate: string;
  dueAt: string | null;
  completedAt: string | null;
  category: string | null;
  notes: string | null;
  projectId: string | null;
  createdAt: string;
};

type TrackerClientProps = {
  profileId: string;
  profileName: string;
};

type TaskFormState = {
  title: string;
  startDate: string;
  dueAt: string;
  category: string;
};

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInputValue() {
  return dateInputValue(new Date());
}

function toDateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function isTaskActiveForDay(task: Task, selectedDay: string) {
  return !task.completedAt && toDateOnly(task.startDate) <= selectedDay;
}

export function TrackerClient({
  profileId,
  profileName,
}: TrackerClientProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(todayInputValue);
  const [form, setForm] = useState<TaskFormState>({
    title: "",
    startDate: todayInputValue(),
    dueAt: "",
    category: "",
  });

  const refreshData = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      const [profilesRes, tasksRes] = await Promise.all([
        fetch("/api/profiles", { cache: "no-store" }),
        fetch(`/api/p/${profileId}/tasks`, { cache: "no-store" }),
      ]);

      if (!profilesRes.ok) {
        const body = await profilesRes.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not load profiles");
      }

      if (!tasksRes.ok) {
        const body = await tasksRes.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not load tasks");
      }

      const [profilesData, tasksData] = (await Promise.all([
        profilesRes.json(),
        tasksRes.json(),
      ])) as [Profile[], Task[]];

      setProfiles(profilesData);
      setTasks(tasksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tasks");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void refreshData();
  }, [profileId]);

  useEffect(() => {
    setForm({
      title: "",
      startDate: todayInputValue(),
      dueAt: "",
      category: "",
    });
    setSelectedDay(todayInputValue());
  }, [profileId]);

  const currentProfileName =
    profiles.find((profile) => profile.id === profileId)?.name ?? profileName;
  const openTasks = tasks.filter((task) => isTaskActiveForDay(task, selectedDay));
  const doneTasks = tasks.filter((task) => task.completedAt);

  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/p/${profileId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startDate: form.startDate,
          dueAt: form.dueAt || null,
          category: form.category || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not create task");
      }

      const task = (await res.json()) as Task;
      setTasks((prev) => [task, ...prev]);
      setForm({
        title: "",
        startDate: todayInputValue(),
        dueAt: "",
        category: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId: string, body: Record<string, unknown>) {
    setError(null);

    const res = await fetch(`/api/p/${profileId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not update task");
    }

    const task = (await res.json()) as Task;
    setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
  }

  async function deleteTask(taskId: string) {
    setError(null);

    const res = await fetch(`/api/p/${profileId}/tasks/${taskId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      throw new Error(responseBody?.error ?? "Could not delete task");
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-4">
        <div>
          <div className="text-sm opacity-70">Current profile</div>
          <div className="text-lg font-semibold">{currentProfileName}</div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="opacity-70">Switch profile</span>
          <select
            className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            value={profileId}
            onChange={(e) => router.push(`/p/${e.target.value}`)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id} className="text-black">
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="opacity-70">Viewing:</span>
          <input
            className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            type="date"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          />
        </label>
        <div className="text-sm opacity-70">
          Open tasks appear from their start date onward until completed.
        </div>
      </div>

      <form
        onSubmit={createTask}
        className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      >
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          placeholder="+ Task"
          value={form.title}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, title: e.target.value }))
          }
        />
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          type="date"
          value={form.startDate}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, startDate: e.target.value }))
          }
        />
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          type="date"
          value={form.dueAt}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, dueAt: e.target.value }))
          }
        />
        <input
          className="rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
          placeholder="Category"
          value={form.category}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, category: e.target.value }))
          }
        />
        <button
          className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          Save
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-md border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Open</h2>
            <div className="text-sm opacity-70">
              {selectedDay}
            </div>
          </div>

          {loading ? (
            <div className="text-sm opacity-60">Loading tasks…</div>
          ) : openTasks.length === 0 ? (
            <div className="text-sm opacity-60">
              No active tasks for this day.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left opacity-70">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Task</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Due</th>
                    <th className="pb-2 pr-4 font-medium">Start</th>
                    <th className="pb-2 pr-4 font-medium">Done</th>
                    <th className="pb-2 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {openTasks.map((task) => (
                    <tr key={task.id} className="border-t border-white/10">
                      <td className="py-3 pr-4">{task.title}</td>
                      <td className="py-3 pr-4">{task.category ?? "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.dueAt) || "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.startDate)}</td>
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() =>
                            void updateTask(task.id, { completed: true }).catch(
                              (err: unknown) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not update task"
                                )
                            )
                          }
                        />
                      </td>
                      <td className="py-3">
                        <button
                          className="rounded-md border border-white/10 px-3 py-1"
                          type="button"
                          onClick={() =>
                            void deleteTask(task.id).catch((err: unknown) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not delete task"
                              )
                            )
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-md border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Done</h2>
            <div className="text-sm opacity-70">Showing all completed tasks</div>
          </div>

          {loading ? (
            <div className="text-sm opacity-60">Loading tasks…</div>
          ) : doneTasks.length === 0 ? (
            <div className="text-sm opacity-60">No completed tasks yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left opacity-70">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Task</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Due</th>
                    <th className="pb-2 pr-4 font-medium">Start</th>
                    <th className="pb-2 pr-4 font-medium">Done</th>
                    <th className="pb-2 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {doneTasks.map((task) => (
                    <tr key={task.id} className="border-t border-white/10 opacity-80">
                      <td className="py-3 pr-4">{task.title}</td>
                      <td className="py-3 pr-4">{task.category ?? "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.dueAt) || "—"}</td>
                      <td className="py-3 pr-4">{toDateOnly(task.startDate)}</td>
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          checked
                          onChange={() =>
                            void updateTask(task.id, { completed: false }).catch(
                              (err: unknown) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not update task"
                                )
                            )
                          }
                        />
                      </td>
                      <td className="py-3">
                        <button
                          className="rounded-md border border-white/10 px-3 py-1"
                          type="button"
                          onClick={() =>
                            void deleteTask(task.id).catch((err: unknown) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not delete task"
                              )
                            )
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
