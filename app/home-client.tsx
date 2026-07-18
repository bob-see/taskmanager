"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SundayCheckIn } from "@/app/components/sunday-check-in";
import {
  addDateOnlyDays,
  getBrisbaneSnapshot,
  getGreetingForHour,
  millisecondsUntilNextBrisbaneSnapshotBoundary,
} from "@/app/lib/date-time";
import { useBrisbaneBoundaryRefresh } from "@/app/lib/use-brisbane-boundary-refresh";

type Profile = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  routineSupportEnabled: boolean;
};

type HomeTask = {
  startDate: string;
  dueAt: string | null;
  completedAt: string | null;
  completedOn: string | null;
};

type TodaySnapshot = {
  startingToday: number;
  dueSoon: number;
  overdue: number;
};

const EMPTY_TODAY_SNAPSHOT: TodaySnapshot = {
  startingToday: 0,
  dueSoon: 0,
  overdue: 0,
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

function toDateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function isTaskOpen(task: HomeTask) {
  return !task.completedAt && !task.completedOn;
}

function getTodaySnapshot(tasks: HomeTask[], today: string): TodaySnapshot {
  const dueSoonEnd = addDateOnlyDays(today, 7);
  const snapshot = { ...EMPTY_TODAY_SNAPSHOT };

  for (const task of tasks) {
    if (!isTaskOpen(task)) continue;

    const startDate = toDateOnly(task.startDate);
    const dueAt = toDateOnly(task.dueAt);

    if (startDate === today) {
      snapshot.startingToday += 1;
    }

    if (dueAt && dueAt < today) {
      snapshot.overdue += 1;
    } else if (dueAt && dueAt <= dueSoonEnd) {
      snapshot.dueSoon += 1;
    }
  }

  return snapshot;
}

export function HomeClient({
  initialSnapshot,
}: {
  initialSnapshot: { date: string; hour: number };
}) {
  const [currentSnapshot, setCurrentSnapshot] = useState(initialSnapshot);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<TodaySnapshot>(EMPTY_TODAY_SNAPSHOT);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [desktopDragEnabled, setDesktopDragEnabled] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);
  const [profileActionError, setProfileActionError] = useState("");
  const [profileActionSaving, setProfileActionSaving] = useState(false);

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

  useBrisbaneBoundaryRefresh(
    (now) => setCurrentSnapshot(getBrisbaneSnapshot(now)),
    millisecondsUntilNextBrisbaneSnapshotBoundary
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      if (profiles.length === 0) {
        setSnapshot(EMPTY_TODAY_SNAPSHOT);
        setSnapshotLoading(false);
        return;
      }

      setSnapshotLoading(true);

      try {
        const taskGroups = await Promise.all(
          profiles.map(async (profile) => {
            const res = await fetch(`/api/p/${profile.id}/tasks`, {
              cache: "no-store",
            });

            if (!res.ok) return [];
            return (await res.json()) as HomeTask[];
          })
        );

        if (!cancelled) {
          setSnapshot(getTodaySnapshot(taskGroups.flat(), currentSnapshot.date));
        }
      } catch {
        if (!cancelled) {
          setSnapshot(EMPTY_TODAY_SNAPSHOT);
        }
      } finally {
        if (!cancelled) {
          setSnapshotLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [currentSnapshot.date, profiles]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateDragEnabled = () => setDesktopDragEnabled(mediaQuery.matches);

    updateDragEnabled();
    mediaQuery.addEventListener("change", updateDragEnabled);
    return () => mediaQuery.removeEventListener("change", updateDragEnabled);
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

  function openEditProfile(profile: Profile) {
    setProfileActionError("");
    setEditingProfile(profile);
    setEditingProfileName(profile.name);
  }

  async function saveProfileEdit() {
    if (!editingProfile) return;

    const nextName = editingProfileName.trim();
    if (!nextName) {
      setProfileActionError("Profile name is required.");
      return;
    }

    if (nextName === editingProfile.name) {
      setEditingProfile(null);
      setEditingProfileName("");
      setProfileActionError("");
      return;
    }

    setProfileActionSaving(true);
    setProfileActionError("");

    const res = await fetch(`/api/profiles/${editingProfile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });

    setProfileActionSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setProfileActionError(err?.error ?? "Could not update profile.");
      return;
    }

    const updatedProfile = (await res.json()) as Profile;
    setProfiles((prev) =>
      prev.map((item) => (item.id === updatedProfile.id ? updatedProfile : item))
    );
    setEditingProfile(null);
    setEditingProfileName("");
  }

  function openDeleteProfile(profile: Profile) {
    setProfileActionError("");
    setDeletingProfile(profile);
  }

  async function confirmDeleteProfile() {
    if (!deletingProfile) return;

    setProfileActionSaving(true);
    setProfileActionError("");

    const res = await fetch(`/api/profiles/${deletingProfile.id}`, {
      method: "DELETE",
    });

    setProfileActionSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setProfileActionError(err?.error ?? "Could not delete profile.");
      return;
    }

    setProfiles((prev) => prev.filter((item) => item.id !== deletingProfile.id));
    setDeletingProfile(null);
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
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.left + bounds.width / 2;
    setDragOverIndex(event.clientX < midpoint ? index : index + 1);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!window.matchMedia("(min-width: 768px)").matches) return;

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

  const snapshotItems = [
    { label: "Starting today", value: snapshot.startingToday },
    { label: "Due soon", value: snapshot.dueSoon },
    { label: "Overdue", value: snapshot.overdue },
  ];
  const routineProfile = profiles.find((profile) => profile.routineSupportEnabled);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10 md:pt-16">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="TaskManager logo"
              width={56}
              height={56}
              className="h-11 w-11 sm:h-14 sm:w-14"
            />
          </Link>
          <div className="text-center">
            <Link href="/" className="block text-2xl font-semibold tracking-tight sm:text-4xl">
              TaskManager
            </Link>
            <p className="mt-1 text-xs text-gray-500 sm:mt-2 sm:text-sm">
              Choose a profile to continue
            </p>
          </div>
        </div>

        <section className="mt-6 w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-[#f8f5ef] shadow-sm sm:mt-8">
          <div className="bg-[linear-gradient(90deg,rgba(17,24,39,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(17,24,39,0.045)_1px,transparent_1px)] bg-[size:18px_18px] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                  Today
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
                  {getGreetingForHour(currentSnapshot.hour)}
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:min-w-[28rem]">
                {snapshotItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-gray-200 bg-white/75 px-2 py-3 text-center shadow-sm sm:px-3"
                  >
                    <div className="font-mono text-2xl font-semibold tabular-nums text-gray-900 sm:text-3xl">
                      {snapshotLoading ? "..." : item.value}
                    </div>
                    <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-gray-500 sm:text-xs">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {routineProfile && (
          <div className="mt-4 w-full max-w-4xl sm:mt-5">
            <SundayCheckIn profile={routineProfile} />
          </div>
        )}

        {/* Profiles */}
        <section className="mt-6 w-full sm:mt-10 md:mt-12">
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

          <div className="mx-auto flex w-full max-w-4xl flex-wrap justify-center gap-2 sm:gap-4">
            {profiles.map((profile, index) => {
              const isDragged = draggedId === profile.id;

              return (
                <div
                  key={profile.id}
                  draggable={desktopDragEnabled && !reordering}
                  onDragStart={
                    desktopDragEnabled ? () => handleDragStart(profile.id) : undefined
                  }
                  onDragEnd={desktopDragEnabled ? handleDragEnd : undefined}
                  onDragOver={
                    desktopDragEnabled ? (event) => handleDragOver(event, index) : undefined
                  }
                  onDrop={desktopDragEnabled ? handleDrop : undefined}
                  className={`relative w-[calc((100%-0.5rem)/2)] transition sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] ${
                    isDragged ? "opacity-60" : ""
                  }`}
                >
                  <div className="group relative aspect-square w-full rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl md:h-44 md:aspect-auto">
                    <div className="absolute right-2 top-2 z-10 hidden gap-2 opacity-0 transition group-hover:opacity-100 md:flex">
                      <button
                        type="button"
                        onClick={() => openEditProfile(profile)}
                        className="rounded-lg border border-gray-200 bg-white/90 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteProfile(profile)}
                        className="rounded-lg border border-red-100 bg-red-50/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>

                    <Link
                      href={`/p/${profile.id}`}
                      className="flex h-full w-full items-center justify-center"
                    >
                      <div className="min-w-0 px-3 text-center sm:px-4">
                        <div className="mb-1 hidden text-xs font-medium uppercase tracking-[0.3em] text-gray-400 md:mb-3 md:block">
                          Drag
                        </div>
                        <div className="truncate text-sm font-medium text-gray-900 sm:text-base md:text-lg">
                          {profile.name}
                        </div>
                        <div className="mt-1 hidden text-xs text-gray-500 md:block md:opacity-0 md:transition md:group-hover:opacity-100">
                          Open profile
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add profile */}
          <div className="mt-6 flex flex-col items-center gap-3 sm:mt-10 sm:gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/overview"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow sm:px-5"
              >
                Overview
              </Link>
              <button
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow sm:px-5"
              >
                + Add profile
              </button>
            </div>

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
      {editingProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/35 px-4">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Edit profile
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                Rename profile
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Update how this profile appears throughout TaskManager.
              </p>
            </div>

            <label className="text-sm font-medium text-gray-900">
              Profile name
              <input
                value={editingProfileName}
                onChange={(event) => setEditingProfileName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                autoFocus
              />
            </label>

            {profileActionError ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileActionError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingProfile(null);
                  setEditingProfileName("");
                  setProfileActionError("");
                }}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={profileActionSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveProfileEdit()}
                className="rounded-2xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={profileActionSaving}
              >
                {profileActionSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletingProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/35 px-4">
          <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 shadow-xl">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
                Delete profile
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                Delete {deletingProfile.name}?
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                This will permanently delete related tasks, projects and time entries.
              </p>
            </div>

            {profileActionError ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileActionError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingProfile(null);
                  setProfileActionError("");
                }}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={profileActionSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteProfile()}
                className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={profileActionSaving}
              >
                {profileActionSaving ? "Deleting..." : "Delete profile"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
