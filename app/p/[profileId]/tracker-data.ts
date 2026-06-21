import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { isMissingDatabaseObjectError } from "@/app/lib/prisma-errors";
import type { TrackerInitialData } from "@/app/p/[profileId]/tracker-client";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

export async function getTrackerPageData(profileId: string, email: string) {
  let profile;

  try {
    profile = await prisma.profile.findFirst({
      where: {
        id: profileId,
        user: {
          email,
        },
      },
      select: { id: true, name: true, routineSupportEnabled: true },
    });
  } catch (error) {
    if (!isMissingDatabaseObjectError(error, "routineSupportEnabled", ["P2022"])) {
      throw error;
    }

    // TODO: Remove this temporary compatibility safeguard after every database
    // has the Profile.routineSupportEnabled column.
    const fallbackProfile = await prisma.profile.findFirst({
      where: {
        id: profileId,
        user: {
          email,
        },
      },
      select: { id: true, name: true },
    });
    profile = fallbackProfile
      ? { ...fallbackProfile, routineSupportEnabled: false }
      : null;
  }

  if (!profile) return notFound();

  const [profiles, tasks, projects] = await Promise.all([
    prisma.profile.findMany({
      where: {
        user: {
          email,
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        defaultView: true,
        averageBasis: true,
      },
    }),
    prisma.task.findMany({
      where: { profileId },
      orderBy: [{ completedOn: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        startDate: true,
        dueAt: true,
        completedAt: true,
        completedOn: true,
        category: true,
        notes: true,
        noteHistory: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        delegatedTask: {
          select: {
            id: true,
            status: true,
            assignedByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        projectId: true,
        recurrenceSeriesId: true,
        repeatEnabled: true,
        repeatPattern: true,
        repeatDays: true,
        repeatWeeklyDay: true,
        repeatMonthlyDay: true,
        repeatPaused: true,
        repeatPauseUntil: true,
        repeatPauseNote: true,
        createdAt: true,
        orderIndex: true,
        isPriority: true,
      },
    }),
    prisma.project.findMany({
      where: { profileId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        startDate: true,
        dueAt: true,
        category: true,
        archived: true,
        collapsed: true,
        isPriority: true,
        createdAt: true,
        orderIndex: true,
      },
    }),
  ]);

  const initialData: TrackerInitialData = {
    profiles,
    tasks: tasks.map((task) => ({
      ...task,
      startDate: task.startDate.toISOString(),
      dueAt: serializeDate(task.dueAt),
      completedAt: serializeDate(task.completedAt),
      completedOn: serializeDate(task.completedOn),
      repeatPattern: task.repeatPattern as TrackerInitialData["tasks"][number]["repeatPattern"],
      repeatPauseUntil: serializeDate(task.repeatPauseUntil),
      createdAt: task.createdAt.toISOString(),
      delegatedTask: task.delegatedTask,
      noteHistory: task.noteHistory.map((note) => ({
        ...note,
        createdAt: note.createdAt.toISOString(),
      })),
    })),
    projects: projects.map((project) => ({
      ...project,
      startDate: project.startDate.toISOString(),
      dueAt: serializeDate(project.dueAt),
      createdAt: project.createdAt.toISOString(),
    })),
  };

  return { profile, initialData };
}
