import { prisma } from "@/app/lib/prisma";
import { OverviewClient, type OverviewProfileData } from "@/app/overview/overview-client";

const DEFAULT_TASKS_TO_SHOW = 8;

function toDateOnly(value: Date | null) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareTasksByCreatedAt(
  left: { createdAt: Date; id: string },
  right: { createdAt: Date; id: string }
) {
  if (left.createdAt.getTime() !== right.createdAt.getTime()) {
    return left.createdAt.getTime() - right.createdAt.getTime();
  }

  return left.id.localeCompare(right.id);
}

function compareTasksForStartDateSort(
  left: { startDate: Date; createdAt: Date; id: string },
  right: { startDate: Date; createdAt: Date; id: string }
) {
  const leftStart = left.startDate.getTime();
  const rightStart = right.startDate.getTime();

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return compareTasksByCreatedAt(left, right);
}

function compareTasksForManualSort(
  left: { orderIndex: number | null; startDate: Date; createdAt: Date; id: string },
  right: { orderIndex: number | null; startDate: Date; createdAt: Date; id: string }
) {
  const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return compareTasksForStartDateSort(left, right);
}

async function getOverviewData(): Promise<OverviewProfileData[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const profiles = await prisma.profile.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      tasks: {
        where: {
          completedOn: null,
        },
        select: {
          id: true,
          title: true,
          notes: true,
          startDate: true,
          dueAt: true,
          category: true,
          createdAt: true,
          orderIndex: true,
          recurrenceSeriesId: true,
          repeatEnabled: true,
          repeatPattern: true,
          repeatDays: true,
          repeatWeeklyDay: true,
          repeatMonthlyDay: true,
          projectId: true,
          project: {
            select: {
              name: true,
            },
          },
        },
      },
      projects: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          startDate: true,
          dueAt: true,
          category: true,
          archived: true,
          collapsed: true,
          orderIndex: true,
          createdAt: true,
        },
      },
    },
  });

  const profileIds = profiles.map((profile) => profile.id);

  const [openCounts, doneCounts, overdueCounts, categories] = await Promise.all([
    prisma.task.groupBy({
      by: ["profileId"],
      where: {
        profileId: { in: profileIds },
        completedOn: null,
      },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["profileId"],
      where: {
        profileId: { in: profileIds },
        completedOn: { not: null },
      },
      _count: { _all: true },
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
    prisma.task.findMany({
      where: {
        profileId: { in: profileIds },
        category: { not: null },
      },
      select: {
        profileId: true,
        category: true,
      },
    }),
  ]);

  const openCountByProfile = new Map(openCounts.map((row) => [row.profileId, row._count._all]));
  const doneCountByProfile = new Map(doneCounts.map((row) => [row.profileId, row._count._all]));
  const overdueCountByProfile = new Map(overdueCounts.map((row) => [row.profileId, row._count._all]));

  const categoryMap = new Map<string, Map<string, string>>();
  for (const row of categories) {
    const category = row.category?.trim();
    if (!category) continue;

    const key = category.toLocaleLowerCase();
    const profileCategoryMap =
      categoryMap.get(row.profileId) ?? new Map<string, string>();
    if (!profileCategoryMap.has(key)) {
      profileCategoryMap.set(key, category);
    }
    categoryMap.set(row.profileId, profileCategoryMap);
  }

  return profiles.map((profile) => {
    const sortedOpenTasks = [...profile.tasks].sort(compareTasksForManualSort);

    return {
      id: profile.id,
      name: profile.name,
      counts: {
        open: openCountByProfile.get(profile.id) ?? 0,
        done: doneCountByProfile.get(profile.id) ?? 0,
        overdue: overdueCountByProfile.get(profile.id) ?? 0,
      },
      categorySuggestions: Array.from(
        categoryMap.get(profile.id)?.values() ?? []
      ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
      projects: profile.projects.map((project) => ({
        id: project.id,
        name: project.name,
        startDate: toDateOnly(project.startDate),
        dueAt: toDateOnly(project.dueAt),
        category: project.category,
        archived: project.archived,
        collapsed: project.collapsed,
        orderIndex: project.orderIndex,
        createdAt: project.createdAt.toISOString(),
      })),
      openTasks: sortedOpenTasks.map((task) => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        projectId: task.projectId,
        projectName: task.project?.name ?? null,
        category: task.category,
        startDate: toDateOnly(task.startDate),
        dueAt: toDateOnly(task.dueAt),
        createdAt: task.createdAt.toISOString(),
        orderIndex: task.orderIndex,
        recurrenceSeriesId: task.recurrenceSeriesId,
        repeatEnabled: task.repeatEnabled,
        repeatPattern: task.repeatPattern,
        repeatDays: task.repeatDays,
        repeatWeeklyDay: task.repeatWeeklyDay,
        repeatMonthlyDay: task.repeatMonthlyDay,
      })),
      initialTaskLimit: DEFAULT_TASKS_TO_SHOW,
    };
  });
}

export default async function OverviewPage() {
  const profiles = await getOverviewData();

  return <OverviewClient profiles={profiles} />;
}
