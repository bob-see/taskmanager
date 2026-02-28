"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  name: string;
  createdAt: string;
};

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/profiles", { cache: "no-store" });
      const data = (await res.json()) as Profile[];
      setProfiles(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error ?? "Could not create profile");
        return;
      }

      setName("");
      setShowForm(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Profiles</h1>
          <p className="mt-1 text-sm opacity-70">
            Choose a profile to continue
          </p>
        </div>
        <button
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
        >
          + New profile
        </button>
      </div>

      {showForm && (
        <form onSubmit={createProfile} className="mt-4 flex flex-wrap gap-2">
          <input
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
            placeholder="Profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
            disabled={saving}
          >
            Create
          </button>
        </form>
      )}

      <section className="mt-6 grid gap-3">
        {loading && <div className="opacity-60">Loading profiles…</div>}
        {!loading && profiles.length === 0 && (
          <div className="opacity-60">No profiles yet.</div>
        )}
        {profiles.map((profile) => (
          <Link
            key={profile.id}
            href={`/p/${profile.id}`}
            className="rounded-md border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/30"
          >
            <div className="text-sm font-semibold">{profile.name}</div>
            <div className="text-xs opacity-60">Open profile</div>
          </Link>
        ))}
      </section>
    </main>
  );
}
