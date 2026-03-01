"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
};

function moveProfileToIndex(
  list: Profile[],
  draggedId: string,
  targetIndex: number
) {
  const sourceIndex = list.findIndex((profile) => profile.id === draggedId);
  if (sourceIndex === -1) return list;

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, list.length));
  const next = [...list];
  const [draggedProfile] = next.splice(sourceIndex, 1);
  const insertionIndex =
    sourceIndex < boundedTargetIndex ? boundedTargetIndex - 1 : boundedTargetIndex;

  next.splice(insertionIndex, 0, draggedProfile);
  return next.map((profile, index) => ({ ...profile, order: index }));
}

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

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

      const createdProfile = (await res.json()) as Profile;
      setName("");
      setShowForm(false);
      setProfiles((prev) => [...prev, createdProfile]);
    } finally {
      setSaving(false);
    }
  }

  async function persistOrder(nextProfiles: Profile[], previousProfiles: Profile[]) {
    setReordering(true);

    try {
      const res = await fetch("/api/profiles/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: nextProfiles.map((profile) => profile.id),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not save profile order");
      }

      const savedProfiles = (await res.json()) as Profile[];
      setProfiles(savedProfiles);
    } catch (error) {
      setProfiles(previousProfiles);
      alert(error instanceof Error ? error.message : "Could not save profile order");
    } finally {
      setReordering(false);
    }
  }

  function handleDragStart(profileId: string) {
    setDraggedId(profileId);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverIndex(null);
  }

  function handleDragOver(
    event: React.DragEvent<HTMLDivElement>,
    index: number
  ) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.left + bounds.width / 2;
    setDragOverIndex(event.clientX < midpoint ? index : index + 1);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedId || dragOverIndex === null) {
      handleDragEnd();
      return;
    }

    const previousProfiles = profiles;
    const nextProfiles = moveProfileToIndex(previousProfiles, draggedId, dragOverIndex);

    handleDragEnd();

    if (nextProfiles === previousProfiles) {
      return;
    }

    const previousOrder = previousProfiles.map((profile) => profile.id).join(",");
    const nextOrder = nextProfiles.map((profile) => profile.id).join(",");
    if (previousOrder === nextOrder) {
      return;
    }

    setProfiles(nextProfiles);
    await persistOrder(nextProfiles, previousProfiles);
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-16">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="TaskManager logo" className="h-14 w-14" />
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight">
              TaskManager
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Choose a profile to continue
            </p>
          </div>
        </div>

        {/* Profiles */}
        <section className="mt-12 w-full">
          {loading && (
            <div className="text-center text-sm text-gray-500">
              Loading profiles…
            </div>
          )}

          {!loading && profiles.length === 0 && (
            <div className="text-center text-sm text-gray-500">
              No profiles yet.
            </div>
          )}

          <div className="flex flex-nowrap justify-center gap-6 overflow-x-auto pb-2">
            {profiles.map((profile, index) => {
              const isDragged = draggedId === profile.id;
              const showLeftIndicator = dragOverIndex === index;
              const showRightIndicator =
                dragOverIndex === index + 1 && index === profiles.length - 1;

              return (
                <div
                  key={profile.id}
                  draggable={!reordering}
                  onDragStart={() => handleDragStart(profile.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={handleDrop}
                  className={`relative shrink-0 transition ${
                    isDragged ? "opacity-60" : ""
                  }`}
                >
                  {showLeftIndicator && (
                    <div className="absolute -left-3 top-4 h-28 w-1 rounded-full bg-gray-900" />
                  )}

                  {showRightIndicator && (
                    <div className="absolute -right-3 top-4 h-28 w-1 rounded-full bg-gray-900" />
                  )}

                  <Link
                    href={`/p/${profile.id}`}
                    className="group flex h-44 w-44 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="px-4 text-center">
                      <div className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-gray-400">
                        Drag
                      </div>
                      <div className="text-lg font-medium text-gray-900">
                        {profile.name}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 opacity-0 transition group-hover:opacity-100">
                        Open profile
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Add profile */}
          <div className="mt-10 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-medium shadow-sm hover:shadow"
            >
              + Add profile
            </button>

            {showForm && (
              <form
                onSubmit={createProfile}
                className="flex flex-col items-center gap-3"
              >
                <input
                  className="w-72 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Profile name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                  >
                    Create
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setName("");
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
