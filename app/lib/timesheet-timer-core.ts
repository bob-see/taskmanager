export type TimerRoundingMode = "exact" | "nearest-15" | "up-15";

export type OwnedTimerProfile = {
  id: string;
  name: string;
};

export type OwnedActiveTimer = {
  id: string;
  profileId: string;
  profileName: string;
  startTime: Date;
};

export type TimerCompletionData = {
  entryDate: Date;
  endTime: Date;
  durationMinutes: number;
  loggedMinutes: number;
  roundingMode: TimerRoundingMode;
  notes: string | null;
};

export type LockedTimerStore<Entry> = {
  findOwnedProfile(
    userId: string,
    profileId: string
  ): Promise<OwnedTimerProfile | null>;
  findActiveTimer(userId: string): Promise<OwnedActiveTimer | null>;
  createTimer(input: {
    userId: string;
    profileId: string;
    entryDate: Date;
    startTime: Date;
    notes: string | null;
  }): Promise<Entry>;
  completeActiveTimer(input: {
    userId: string;
    timerId: string;
    data: TimerCompletionData;
  }): Promise<Entry | null>;
  recordActivity(input: {
    userId: string;
    profileId: string;
    timeEntryId: string;
    type: "time_entry.create" | "time_entry.update";
    description: string;
  }): Promise<void>;
};

export type OwnedTimerStore<Entry> = {
  withOwnerLock<T>(
    userId: string,
    operation: (store: LockedTimerStore<Entry>) => Promise<T>
  ): Promise<T>;
};

export class TimerOperationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TimerOperationError";
    this.status = status;
  }
}

export async function requireAuthenticatedTimesheetUser<User>(
  getCurrentUser: () => Promise<User | null>
) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

export async function startOwnedTimer<Entry extends { id: string }>(
  store: OwnedTimerStore<Entry>,
  input: {
    userId: string;
    profileId: string;
    entryDate: Date;
    startTime: Date;
    notes: string | null;
  }
) {
  return store.withOwnerLock(input.userId, async (lockedStore) => {
    const profile = await lockedStore.findOwnedProfile(
      input.userId,
      input.profileId
    );
    if (!profile) {
      throw new TimerOperationError("Profile not found", 404);
    }

    const activeTimer = await lockedStore.findActiveTimer(input.userId);
    if (activeTimer) {
      throw new TimerOperationError(
        `Timer already running for ${activeTimer.profileName}`,
        409
      );
    }

    const entry = await lockedStore.createTimer(input);
    await lockedStore.recordActivity({
      userId: input.userId,
      profileId: profile.id,
      timeEntryId: entry.id,
      type: "time_entry.create",
      description: "Started timer",
    });
    return entry;
  });
}

export async function stopOwnedTimer<Entry extends { id: string }>(
  store: OwnedTimerStore<Entry>,
  input: {
    userId: string;
    endTime: Date;
    entryDate: Date;
    roundingMode: TimerRoundingMode;
    notes: string | null;
    calculateLoggedMinutes: (
      startTime: Date,
      endTime: Date,
      roundingMode: TimerRoundingMode
    ) => { durationMinutes: number; loggedMinutes: number };
  }
) {
  return store.withOwnerLock(input.userId, async (lockedStore) => {
    const activeTimer = await lockedStore.findActiveTimer(input.userId);
    if (!activeTimer) {
      throw new TimerOperationError("No active timer", 404);
    }

    const { durationMinutes, loggedMinutes } = input.calculateLoggedMinutes(
      activeTimer.startTime,
      input.endTime,
      input.roundingMode
    );
    const entry = await lockedStore.completeActiveTimer({
      userId: input.userId,
      timerId: activeTimer.id,
      data: {
        entryDate: input.entryDate,
        endTime: input.endTime,
        durationMinutes,
        loggedMinutes,
        roundingMode: input.roundingMode,
        notes: input.notes,
      },
    });

    if (!entry) {
      throw new TimerOperationError("No active timer", 404);
    }

    await lockedStore.recordActivity({
      userId: input.userId,
      profileId: activeTimer.profileId,
      timeEntryId: entry.id,
      type: "time_entry.update",
      description: "Stopped timer",
    });
    return entry;
  });
}
