import { prisma } from "@/app/lib/prisma";
import { getBrisbaneCalendarDate } from "@/app/lib/date-time";

export type ProfileTaskBadge = {
  profileId: string;
  newTasks: number;
  overdueTasks: number;
};

type ProfileBadgeSource = {
  id: string;
  taskBadgeLastSeenAt: Date;
};

/**
 * Counts attention-worthy open tasks for each profile. A task remains new
 * until that profile has been opened; overdue tasks remain visible until done
 * or rescheduled.
 */
export async function getProfileTaskBadges(
  profiles: ProfileBadgeSource[],
  now = new Date()
): Promise<ProfileTaskBadge[]> {
  if (profiles.length === 0) return [];

  const profileIds = profiles.map((profile) => profile.id);
  const seenAtByProfile = new Map(
    profiles.map((profile) => [profile.id, profile.taskBadgeLastSeenAt])
  );
  const earliestSeenAt = new Date(
    Math.min(...profiles.map((profile) => profile.taskBadgeLastSeenAt.getTime()))
  );
  const today = getBrisbaneCalendarDate(now);

  const [recentOpenTasks, overdueCounts] = await Promise.all([
    prisma.task.findMany({
      where: {
        profileId: { in: profileIds },
        completedOn: null,
        createdAt: { gt: earliestSeenAt },
      },
      select: { profileId: true, createdAt: true },
    }),
    prisma.task.groupBy({
      by: ["profileId"],
      where: {
        profileId: { in: profileIds },
        completedOn: null,
        dueAt: { lt: today },
      },
      _count: { _all: true },
    }),
  ]);

  const newTasksByProfile = new Map<string, number>();
  for (const task of recentOpenTasks) {
    const seenAt = task.profileId ? seenAtByProfile.get(task.profileId) : undefined;
    if (task.profileId && seenAt && task.createdAt > seenAt) {
      newTasksByProfile.set(
        task.profileId,
        (newTasksByProfile.get(task.profileId) ?? 0) + 1
      );
    }
  }

  const overdueTasksByProfile = new Map(
    overdueCounts.map((row) => [row.profileId, row._count._all])
  );

  return profiles.map((profile) => ({
    profileId: profile.id,
    newTasks: newTasksByProfile.get(profile.id) ?? 0,
    overdueTasks: overdueTasksByProfile.get(profile.id) ?? 0,
  }));
}
