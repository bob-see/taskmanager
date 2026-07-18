import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { createActivityLog } from "@/app/lib/activity-log";
import {
  TimerOperationError,
  type LockedTimerStore,
  type OwnedTimerStore,
} from "@/app/lib/timesheet-timer-core";
import { timeEntrySelect } from "@/app/api/timesheets/shared";

type SelectedTimeEntry = Prisma.TimeEntryGetPayload<{
  select: typeof timeEntrySelect;
}>;

function lockedTimerStore(
  tx: Prisma.TransactionClient
): LockedTimerStore<SelectedTimeEntry> {
  return {
    async findOwnedProfile(userId, profileId) {
      return tx.profile.findFirst({
        where: { id: profileId, userId },
        select: { id: true, name: true },
      });
    },

    async findActiveTimer(userId) {
      const entry = await tx.timeEntry.findFirst({
        where: {
          endTime: null,
          profile: { userId },
        },
        orderBy: { startTime: "desc" },
        select: {
          id: true,
          profileId: true,
          startTime: true,
          profile: { select: { name: true } },
        },
      });

      return entry
        ? {
            id: entry.id,
            profileId: entry.profileId,
            profileName: entry.profile.name,
            startTime: entry.startTime,
          }
        : null;
    },

    createTimer(input) {
      return tx.timeEntry.create({
        data: {
          profileId: input.profileId,
          entryDate: input.entryDate,
          startTime: input.startTime,
          endTime: null,
          durationMinutes: null,
          loggedMinutes: null,
          roundingMode: null,
          notes: input.notes,
          source: "timer",
        },
        select: timeEntrySelect,
      });
    },

    async completeActiveTimer(input) {
      const result = await tx.timeEntry.updateMany({
        where: {
          id: input.timerId,
          endTime: null,
          profile: { userId: input.userId },
        },
        data: {
          entryDate: input.data.entryDate,
          endTime: input.data.endTime,
          durationMinutes: input.data.durationMinutes,
          loggedMinutes: input.data.loggedMinutes,
          roundingMode: input.data.roundingMode,
          ...(input.data.notes !== null ? { notes: input.data.notes } : {}),
        },
      });

      if (result.count !== 1) return null;

      return tx.timeEntry.findFirst({
        where: {
          id: input.timerId,
          profile: { userId: input.userId },
        },
        select: timeEntrySelect,
      });
    },

    async recordActivity(input) {
      await createActivityLog(tx, input);
    },
  };
}

export const prismaTimerStore: OwnedTimerStore<SelectedTimeEntry> = {
  withOwnerLock(userId, operation) {
    return prisma.$transaction(async (tx) => {
      const ownerRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM \`user\` WHERE id = ${userId} FOR UPDATE
      `;

      if (ownerRows.length !== 1) {
        throw new TimerOperationError("Unauthorized", 401);
      }

      return operation(lockedTimerStore(tx));
    });
  },
};
