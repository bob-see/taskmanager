import { prisma } from "@/app/lib/prisma";
import { getBrisbaneCalendarDate, getBrisbaneDate } from "@/app/lib/date-time";

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
 * Counts attention-worthy open tasks for each profile. The green badge is for
 * work that has started since the profile was last opened, not for tasks the
 * user has just added. Overdue tasks remain visible until done or rescheduled.
 */
export async function getProfileTaskBadges(
  profiles: ProfileBadgeSource[],
  now = new Date()
): Promise<ProfileTaskBadge[]> {
  if (profiles.length === 0) return [];

  const profileIds = profiles.map((profile) => profile.id);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const today = getBrisbaneCalendarDate(now);
  const todayDate = getBrisbaneDate(now);

  const [startedOpenTasks, overdueTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        profileId: { in: profileIds },
        completedOn: null,
        startDate: { lte: today },
      },
      select: { profileId: true, createdAt: true, startDate: true },
    }),
    prisma.task.findMany({
      where: {
        profileId: { in: profileIds },
        completedOn: null,
        OR: [
          { dueAt: { lt: today } },
          {
            workflowRunId: { not: null },
            dueAt: null,
            startDate: { lt: today },
          },
        ],
      },
      select: {
        profileId: true,
        dueAt: true,
        startDate: true,
        workflowRunId: true,
      },
    }),
  ]);

  const startingTasksByProfile = new Map<string, number>();
  for (const task of startedOpenTasks) {
    const profile = task.profileId ? profileById.get(task.profileId) : undefined;
    const startDate = getBrisbaneDate(task.startDate);

    if (
      task.profileId &&
      profile &&
      startDate > getBrisbaneDate(profile.taskBadgeLastSeenAt) &&
      startDate <= todayDate &&
      getBrisbaneDate(task.createdAt) < startDate
    ) {
      startingTasksByProfile.set(
        task.profileId,
        (startingTasksByProfile.get(task.profileId) ?? 0) + 1
      );
    }
  }

  const overdueTasksByProfile = new Map<string, number>();
  for (const task of overdueTasks) {
    const effectiveDueDate = task.dueAt ?? (task.workflowRunId ? task.startDate : null);
    if (task.profileId && effectiveDueDate && effectiveDueDate < today) {
      overdueTasksByProfile.set(
        task.profileId,
        (overdueTasksByProfile.get(task.profileId) ?? 0) + 1
      );
    }
  }

  return profiles.map((profile) => ({
    profileId: profile.id,
    newTasks: startingTasksByProfile.get(profile.id) ?? 0,
    overdueTasks: overdueTasksByProfile.get(profile.id) ?? 0,
  }));
}
