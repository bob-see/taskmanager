"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

type Filter = "all" | "today" | "upcoming" | "overdue";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  async function refresh() {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    const data = (await res.json()) as Task[];
    setTasks(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const dueAt =
      dueDate.trim() === ""
        ? null
        : new Date(
            Number(dueDate.slice(0, 4)),
            Number(dueDate.slice(5, 7)) - 1,
            Number(dueDate.slice(8, 10))
          ).toISOString();

    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, dueAt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error ?? "Could not create task");
        return;
      }

      setTitle("");
      setDueDate("");
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function toggleComplete(id: string, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    await refresh();
  }

  async function removeTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await refresh();
  }

  const open = tasks.filter((t) => !t.completedAt);
  const done = tasks.filter((t) => t.completedAt);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  function matchesFilter(task: Task) {
    if (filter === "all") return true;
    if (!task.dueAt) return false;
    const dueLocal = new Date(task.dueAt);
    dueLocal.setHours(0, 0, 0, 0);

    if (filter === "today") {
      return dueLocal >= todayStart && dueLocal < tomorrowStart;
    }
    if (filter === "overdue") {
      return dueLocal < todayStart;
    }
    return dueLocal >= tomorrowStart;
  }

  const openFiltered = open.filter(matchesFilter);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  });

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Task Manager</h1>
      <p className="mt-1 text-sm opacity-70">Local tasks (SQLite + Prisma)</p>

      <form onSubmit={addTask} className="mt-6 flex flex-wrap gap-2">
        <input
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
          placeholder="Add a task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <button
          className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
          disabled={loading}
        >
          Add
        </button>
      </form>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
            Open ({openFiltered.length})
          </h2>
          <div className="flex gap-2 text-sm">
            {(["all", "today", "upcoming", "overdue"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-2 py-1 ${
                  filter === key
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/5"
                }`}
              >
                {key === "all"
                  ? "All"
                  : key === "today"
                  ? "Today"
                  : key === "upcoming"
                  ? "Upcoming"
                  : "Overdue"}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {openFiltered.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2"
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={(e) => toggleComplete(t.id, e.target.checked)}
                />
                <span className="flex items-center gap-2">
                  <span>{t.title}</span>
                  {t.dueAt && (
                    <span className="text-xs opacity-70">
                      Due: {dateLabel.format(new Date(t.dueAt))}
                    </span>
                  )}
                </span>
              </label>
              <button
                className="text-sm opacity-70 hover:opacity-100"
                onClick={() => removeTask(t.id)}
                type="button"
              >
                Delete
              </button>
            </li>
          ))}
          {openFiltered.length === 0 && (
            <li className="opacity-60">No open tasks.</li>
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
          Done ({done.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {done.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 opacity-80"
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={true}
                  onChange={(e) => toggleComplete(t.id, e.target.checked)}
                />
                <span className="line-through">{t.title}</span>
              </label>
              <button
                className="text-sm opacity-70 hover:opacity-100"
                onClick={() => removeTask(t.id)}
                type="button"
              >
                Delete
              </button>
            </li>
          ))}
          {done.length === 0 && (
            <li className="opacity-60">No completed tasks.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
