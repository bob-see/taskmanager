import assert from "node:assert/strict";
import test from "node:test";

import {
  ProfileReorderError,
  reorderOwnedProfiles,
  requireAuthenticatedProfileUser,
} from "../app/lib/profile-reorder-core.ts";
import {
  TimerOperationError,
  requireAuthenticatedTimesheetUser,
  startOwnedTimer,
  stopOwnedTimer,
} from "../app/lib/timesheet-timer-core.ts";
import { getBrisbaneCalendarDate } from "../app/lib/date-time.ts";
import { calculateLoggedMinutes } from "../app/lib/timesheet-duration.ts";

function createProfileReorderStore(initialRows) {
  const state = { rows: initialRows.map((row) => ({ ...row })) };

  return {
    state,
    store: {
      async transaction(operation) {
        const draft = state.rows.map((row) => ({ ...row }));
        const result = await operation({
          async listOwnedProfiles(userId) {
            return draft.filter((row) => row.userId === userId);
          },
          async updateOwnedProfileOrder(userId, profileId, order) {
            const profile = draft.find(
              (row) => row.id === profileId && row.userId === userId
            );
            if (!profile) return false;
            profile.order = order;
            return true;
          },
          async listReorderedProfiles(userId) {
            return draft
              .filter((row) => row.userId === userId)
              .sort((left, right) => left.order - right.order)
              .map((row) => ({ ...row }));
          },
        });
        state.rows = draft;
        return result;
      },
    },
  };
}

const profileRows = [
  { id: "profile-a", userId: "user-1", order: 0 },
  { id: "profile-b", userId: "user-1", order: 1 },
  { id: "profile-c", userId: "user-2", order: 0 },
  { id: "profile-d", userId: "user-2", order: 1 },
];

test("profile reorder rejects an unauthenticated user", async () => {
  const result = await requireAuthenticatedProfileUser(async () => null);
  assert.equal(result.error.status, 401);
  assert.deepEqual(await result.error.json(), { error: "Unauthorized" });
});

test("a user can reorder only their complete owned profile set", async () => {
  const { state, store } = createProfileReorderStore(profileRows);
  const result = await reorderOwnedProfiles(store, "user-1", [
    "profile-b",
    "profile-a",
  ]);

  assert.deepEqual(result.map((profile) => profile.id), ["profile-b", "profile-a"]);
  assert.deepEqual(
    state.rows
      .filter((profile) => profile.userId === "user-2")
      .map(({ id, order }) => ({ id, order })),
    [
      { id: "profile-c", order: 0 },
      { id: "profile-d", order: 1 },
    ]
  );
});

test("mixed-owner, unknown, and incomplete profile reorder payloads roll back", async () => {
  for (const orderedIds of [
    ["profile-a", "profile-c"],
    ["profile-b", "unknown-profile"],
    ["profile-a"],
  ]) {
    const { state, store } = createProfileReorderStore(profileRows);
    const before = structuredClone(state.rows);

    await assert.rejects(
      reorderOwnedProfiles(store, "user-1", orderedIds),
      (error) =>
        error instanceof ProfileReorderError &&
        error.status === 400 &&
        error.message === "orderedIds must include every accessible profile exactly once"
    );
    assert.deepEqual(state.rows, before);
  }
});

function createTimerStore() {
  const state = {
    profiles: [
      { id: "profile-a", userId: "user-1", name: "Alpha" },
      { id: "profile-b", userId: "user-2", name: "Beta" },
    ],
    entries: [],
    activities: [],
    nextId: 1,
  };
  const ownerQueues = new Map();

  function profileForEntry(entry) {
    return state.profiles.find((profile) => profile.id === entry.profileId);
  }

  function activeFor(userId) {
    return state.entries.find(
      (entry) =>
        entry.endTime === null && profileForEntry(entry)?.userId === userId
    );
  }

  const store = {
    async withOwnerLock(userId, operation) {
      const previous = ownerQueues.get(userId) ?? Promise.resolve();
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      ownerQueues.set(userId, previous.then(() => gate));
      await previous;

      try {
        return await operation({
          async findOwnedProfile(ownerId, profileId) {
            const profile = state.profiles.find(
              (item) => item.id === profileId && item.userId === ownerId
            );
            return profile ? { id: profile.id, name: profile.name } : null;
          },
          async findActiveTimer(ownerId) {
            const entry = activeFor(ownerId);
            if (!entry) return null;
            return {
              id: entry.id,
              profileId: entry.profileId,
              profileName: profileForEntry(entry).name,
              startTime: entry.startTime,
            };
          },
          async createTimer(input) {
            const entry = {
              id: `timer-${state.nextId++}`,
              profileId: input.profileId,
              entryDate: input.entryDate,
              startTime: input.startTime,
              endTime: null,
              durationMinutes: null,
              loggedMinutes: null,
              roundingMode: null,
              notes: input.notes,
            };
            state.entries.push(entry);
            return entry;
          },
          async completeActiveTimer(input) {
            const entry = state.entries.find(
              (item) =>
                item.id === input.timerId &&
                item.endTime === null &&
                profileForEntry(item)?.userId === input.userId
            );
            if (!entry) return null;
            const { notes, ...completion } = input.data;
            Object.assign(entry, completion);
            if (notes !== null) entry.notes = notes;
            return entry;
          },
          async recordActivity(input) {
            state.activities.push({ ...input });
          },
        });
      } finally {
        release();
      }
    },
  };

  return { state, store, activeFor };
}

function startTimer(store, userId, profileId, startTime) {
  return startOwnedTimer(store, {
    userId,
    profileId,
    entryDate: getBrisbaneCalendarDate(startTime),
    startTime,
    notes: null,
  });
}

function stopTimer(store, userId, endTime) {
  return stopOwnedTimer(store, {
    userId,
    endTime,
    entryDate: getBrisbaneCalendarDate(endTime),
    roundingMode: "exact",
    notes: null,
    calculateLoggedMinutes,
  });
}

test("timesheet reads and timer mutations reject an unauthenticated user", async () => {
  const result = await requireAuthenticatedTimesheetUser(async () => null);
  assert.equal(result.error.status, 401);
  assert.deepEqual(await result.error.json(), { error: "Unauthorized" });
});

test("separate users can start and read independent active timers", async () => {
  const { state, store, activeFor } = createTimerStore();
  const start = new Date("2026-07-17T13:30:00.000Z");

  await startTimer(store, "user-1", "profile-a", start);
  assert.equal(activeFor("user-1").profileId, "profile-a");
  assert.equal(activeFor("user-2"), undefined);

  await startTimer(store, "user-2", "profile-b", start);
  assert.equal(activeFor("user-2").profileId, "profile-b");
  assert.equal(state.entries.length, 2);
});

test("a second timer for the same user is rejected without replacing the first", async () => {
  const { state, store, activeFor } = createTimerStore();
  const start = new Date("2026-07-17T13:30:00.000Z");
  const first = await startTimer(store, "user-1", "profile-a", start);

  await assert.rejects(
    startTimer(store, "user-1", "profile-a", new Date(start.getTime() + 60_000)),
    (error) => error instanceof TimerOperationError && error.status === 409
  );
  assert.equal(activeFor("user-1").id, first.id);
  assert.equal(state.entries.length, 1);
});

test("a user cannot start a timer under another user's profile or replace their timer", async () => {
  const { state, store, activeFor } = createTimerStore();
  const start = new Date("2026-07-17T13:30:00.000Z");
  await startTimer(store, "user-2", "profile-b", start);

  await assert.rejects(
    startTimer(store, "user-1", "profile-b", start),
    (error) => error instanceof TimerOperationError && error.status === 404
  );
  assert.equal(activeFor("user-2").profileId, "profile-b");
  assert.equal(state.entries.length, 1);
});

test("a user cannot read or stop another user's timer", async () => {
  const { store, activeFor } = createTimerStore();
  await startTimer(
    store,
    "user-1",
    "profile-a",
    new Date("2026-07-17T13:30:00.000Z")
  );

  assert.equal(activeFor("user-2"), undefined);
  await assert.rejects(
    stopTimer(store, "user-2", new Date("2026-07-17T13:45:00.000Z")),
    (error) => error instanceof TimerOperationError && error.status === 404
  );
  assert.ok(activeFor("user-1"));
});

test("timer stop uses the Brisbane stop date and real elapsed instants", async () => {
  const { state, store } = createTimerStore();
  await startTimer(
    store,
    "user-1",
    "profile-a",
    new Date("2026-07-17T13:59:00.000Z")
  );

  const entry = await stopTimer(
    store,
    "user-1",
    new Date("2026-07-17T14:01:00.000Z")
  );
  assert.equal(entry.entryDate.toISOString(), "2026-07-18T00:00:00.000Z");
  assert.equal(entry.durationMinutes, 2);
  assert.equal(entry.loggedMinutes, 2);
  assert.equal(
    state.entries.filter((item) => item.profileId === "profile-a").length,
    1
  );
});

test("concurrent and repeated timer stops finalise once without duplicate entries", async () => {
  const { state, store } = createTimerStore();
  await startTimer(
    store,
    "user-1",
    "profile-a",
    new Date("2026-07-17T13:30:00.000Z")
  );

  const results = await Promise.allSettled([
    stopTimer(store, "user-1", new Date("2026-07-17T13:45:00.000Z")),
    stopTimer(store, "user-1", new Date("2026-07-17T13:45:01.000Z")),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(state.entries.length, 1);
  assert.equal(
    state.activities.filter((activity) => activity.description === "Stopped timer").length,
    1
  );
});
