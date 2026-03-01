import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  addDays,
  ensureProfile,
  ensureProject,
  nextOccurrenceDate,
  parseDateInput,
  parseOptionalTextInput,
  toLocalDayStart,
} from "@/app/api/p/tasks-shared";

type Ctx = {
  params: Promise<{ profileId: string }>;
};

type DeleteMode = "this" | "future" | "series";

type TaskRecord = {
  id: string;
  profileId: string;
  title: string;
  startDate: Date;
  dueAt: Date | null;
  completedOn: Date | null;
  category: string | null;
  notes: string | null;
  projectId: string | null;
  recurrenceSeriesId: string | null;
  repeatEnabled: boolean;
  repeatPattern: "daily" | "weekly" | "monthly" | null;
  repeatDays: number | null;
  repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null;
};

const TASK_SELECT = {
  id: true,
  profileId: true,
  title: true,
  startDate: true,
  dueAt: true,
  completedOn: true,
  category: true,
  notes: true,
  projectId: true,
  recurrenceSeriesId: true,
  repeatEnabled: true,
  repeatPattern: true,
  repeatDays: true,
  repeatWeeklyDay: true,
  repeatMonthlyDay: true,
} satisfies Prisma.TaskSelect;

function uniqueIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const ids = Array.from(
    new Set(
      value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    )
  );

  return ids.length > 0 ? ids : null;
}

async function expandTargetTasks(
  profileId: string,
  selectedTasks: TaskRecord[],
  scope: DeleteMode
) {
  if (scope === "this") {
    return selectedTasks;
  }

  const nonRecurringIds = selectedTasks
    .filter((task) => !task.recurrenceSeriesId)
    .map((task) => task.id);
  const recurringStarts = new Map<string, Date>();

  for (const task of selectedTasks) {
    if (!task.recurrenceSeriesId) continue;

    const currentStart = recurringStarts.get(task.recurrenceSeriesId);
    if (!currentStart || task.startDate < currentStart) {
      recurringStarts.set(task.recurrenceSeriesId, task.startDate);
    }
  }

  const orClauses: Prisma.TaskWhereInput[] = [];

  if (nonRecurringIds.length > 0) {
    orClauses.push({
      id: { in: nonRecurringIds },
    });
  }

  for (const [seriesId, startDate] of recurringStarts) {
    orClauses.push(
      scope === "future"
        ? {
            recurrenceSeriesId: seriesId,
            startDate: { gte: startDate },
          }
        : {
            recurrenceSeriesId: seriesId,
          }
    );
  }

  if (orClauses.length === 0) {
    return [];
  }

  return prisma.task.findMany({
    where: {
      profileId,
      OR: orClauses,
    },
    select: TASK_SELECT,
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
}

async function ensureTaskRecord(
  tx: Prisma.TransactionClient,
  profileId: string,
  id: string
) {
  const task = await tx.task.findFirst({
    where: { id, profileId },
    select: TASK_SELECT,
  });

  if (!task) {
    throw new Error("Task not found");
  }

  return task as TaskRecord;
}

async function markTaskDone(
  tx: Prisma.TransactionClient,
  task: TaskRecord,
  completedOn: Date
) {
  const completedAt = new Date();
  const markedDone = await tx.task.updateMany({
    where: { id: task.id, profileId: task.profileId, completedOn: null },
    data: {
      completedAt,
      completedOn,
    },
  });

  if (markedDone.count === 0) {
    return;
  }

  if (
    !task.repeatEnabled ||
    !task.repeatPattern ||
    !task.recurrenceSeriesId
  ) {
    return;
  }

  const nextStartDate = nextOccurrenceDate({
    baseDate: completedOn,
    recurrenceType: task.repeatPattern,
    repeatDays: task.repeatDays,
    weeklyDay: task.repeatWeeklyDay,
    monthlyDay: task.repeatMonthlyDay,
  });
  const dayStart = toLocalDayStart(nextStartDate);
  const dayEnd = addDays(dayStart, 1);

  const nextTaskData = {
    title: task.title,
    category: task.category,
    notes: task.notes,
    projectId: task.projectId,
    profileId: task.profileId,
    recurrenceSeriesId: task.recurrenceSeriesId,
    startDate: dayStart,
    dueAt: null,
    repeatEnabled: task.repeatEnabled,
    repeatPattern: task.repeatPattern,
    repeatDays: task.repeatDays,
    repeatWeeklyDay: task.repeatWeeklyDay,
    repeatMonthlyDay: task.repeatMonthlyDay,
  };

  const legacyOccurrence = await tx.task.findFirst({
    where: {
      id: { not: task.id },
      profileId: task.profileId,
      recurrenceSeriesId: null,
      startDate: {
        gte: dayStart,
        lt: dayEnd,
      },
      completedOn: null,
      title: nextTaskData.title,
      category: nextTaskData.category,
      notes: nextTaskData.notes,
      projectId: nextTaskData.projectId,
      repeatEnabled: true,
      repeatPattern: nextTaskData.repeatPattern,
      repeatDays: nextTaskData.repeatDays,
      repeatWeeklyDay: nextTaskData.repeatWeeklyDay,
      repeatMonthlyDay: nextTaskData.repeatMonthlyDay,
    },
    select: { id: true },
  });

  if (legacyOccurrence) {
    await tx.task.update({
      where: { id: legacyOccurrence.id },
      data: {
        recurrenceSeriesId: task.recurrenceSeriesId,
        startDate: dayStart,
      },
    });
    return;
  }

  try {
    await tx.task.create({
      data: nextTaskData,
    });
  } catch (error) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
    ) {
      throw error;
    }
  }
}

async function markTaskOpen(tx: Prisma.TransactionClient, task: TaskRecord) {
  await tx.task.updateMany({
    where: { id: task.id, profileId: task.profileId, completedOn: { not: null } },
    data: {
      completedAt: null,
      completedOn: null,
    },
  });
}

async function deleteSingleTask(tx: Prisma.TransactionClient, task: TaskRecord) {
  if (
    !task.recurrenceSeriesId ||
    !task.repeatEnabled ||
    !task.repeatPattern
  ) {
    await tx.task.deleteMany({
      where: { id: task.id, profileId: task.profileId },
    });
    return;
  }

  const deletedTask = await tx.task.deleteMany({
    where: { id: task.id, profileId: task.profileId },
  });

  if (deletedTask.count === 0) {
    return;
  }

  const futureOccurrence = await tx.task.findFirst({
    where: {
      profileId: task.profileId,
      recurrenceSeriesId: task.recurrenceSeriesId,
      startDate: { gt: task.startDate },
    },
    select: { id: true },
  });

  if (futureOccurrence) {
    return;
  }

  const nextStartDate = nextOccurrenceDate({
    baseDate: task.startDate,
    recurrenceType: task.repeatPattern,
    repeatDays: task.repeatDays,
    weeklyDay: task.repeatWeeklyDay,
    monthlyDay: task.repeatMonthlyDay,
  });

  const existingNextOccurrence = await tx.task.findFirst({
    where: {
      profileId: task.profileId,
      recurrenceSeriesId: task.recurrenceSeriesId,
      startDate: nextStartDate,
    },
    select: { id: true },
  });

  if (existingNextOccurrence) {
    return;
  }

  try {
    await tx.task.create({
      data: {
        title: task.title,
        notes: task.notes,
        dueAt: null,
        category: task.category,
        startDate: nextStartDate,
        profileId: task.profileId,
        projectId: task.projectId,
        recurrenceSeriesId: task.recurrenceSeriesId,
        repeatEnabled: task.repeatEnabled,
        repeatPattern: task.repeatPattern,
        repeatDays: task.repeatDays,
        repeatWeeklyDay: task.repeatWeeklyDay,
        repeatMonthlyDay: task.repeatMonthlyDay,
      },
    });
  } catch (error) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
    ) {
      throw error;
    }
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  const profile = await ensureProfile(profileId);

  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const taskIds = uniqueIds(body?.taskIds);
  const scope = body?.scope ?? "this";

  if (
    action !== "mark-done" &&
    action !== "mark-open" &&
    action !== "move-project" &&
    action !== "set-category" &&
    action !== "set-start-date" &&
    action !== "set-due-date" &&
    action !== "clear-due-date" &&
    action !== "delete"
  ) {
    return Response.json({ error: "Invalid bulk action" }, { status: 400 });
  }

  if (!taskIds) {
    return Response.json({ error: "taskIds must include at least one task id" }, { status: 400 });
  }

  if (!["this", "future", "series"].includes(scope)) {
    return Response.json(
      { error: "scope must be one of: this, future, series" },
      { status: 400 }
    );
  }

  const selectedTasks = (await prisma.task.findMany({
    where: {
      profileId,
      id: { in: taskIds },
    },
    select: TASK_SELECT,
  })) as TaskRecord[];

  if (selectedTasks.length !== taskIds.length) {
    return Response.json({ error: "One or more tasks were not found" }, { status: 404 });
  }

  const targetTasks = await expandTargetTasks(profileId, selectedTasks, scope);
  const targetIds = targetTasks.map((task) => task.id);

  if (targetIds.length === 0) {
    return Response.json({ ok: true });
  }

  if (action === "move-project") {
    const projectId = parseOptionalTextInput(body?.projectId, "projectId");
    if (projectId.error) return projectId.error;

    if (projectId.value) {
      const project = await ensureProject(profileId, projectId.value);
      if (!project) {
        return Response.json({ error: "Project not found" }, { status: 404 });
      }
    }

    await prisma.task.updateMany({
      where: { profileId, id: { in: targetIds } },
      data: { projectId: projectId.value ?? null },
    });

    return Response.json({ ok: true });
  }

  if (action === "set-category") {
    const category = parseOptionalTextInput(body?.category, "category");
    if (category.error) return category.error;

    await prisma.task.updateMany({
      where: { profileId, id: { in: targetIds } },
      data: { category: category.value ?? null },
    });

    return Response.json({ ok: true });
  }

  if (action === "set-due-date") {
    const dueAt = parseDateInput(body?.dueAt, "dueAt");
    if (dueAt.error) return dueAt.error;
    if (!dueAt.value) {
      return Response.json({ error: "dueAt is required" }, { status: 400 });
    }

    await prisma.task.updateMany({
      where: { profileId, id: { in: targetIds } },
      data: { dueAt: dueAt.value },
    });

    return Response.json({ ok: true });
  }

  if (action === "clear-due-date") {
    await prisma.task.updateMany({
      where: { profileId, id: { in: targetIds } },
      data: { dueAt: null },
    });

    return Response.json({ ok: true });
  }

  if (action === "set-start-date") {
    const startDate = parseDateInput(body?.startDate, "startDate");
    if (startDate.error) return startDate.error;
    if (!startDate.value) {
      return Response.json({ error: "startDate is required" }, { status: 400 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (const targetTask of targetTasks) {
          await tx.task.update({
            where: { id: targetTask.id },
            data: {
              startDate: targetTask.repeatEnabled
                ? toLocalDayStart(startDate.value!)
                : startDate.value!,
            },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return Response.json(
          { error: "Start date update would create duplicate recurring occurrences" },
          { status: 409 }
        );
      }

      throw error;
    }

    return Response.json({ ok: true });
  }

  if (action === "mark-done") {
    const completedOn = parseDateInput(body?.completedOn, "completedOn");
    if (completedOn.error) return completedOn.error;
    const completionDate = completedOn.value ?? new Date();

    await prisma.$transaction(async (tx) => {
      if (scope === "this") {
        for (const taskId of taskIds) {
          const task = await ensureTaskRecord(tx, profileId, taskId);
          await markTaskDone(tx, task, completionDate);
        }
        return;
      }

      await tx.task.updateMany({
        where: { profileId, id: { in: targetIds }, completedOn: null },
        data: {
          completedAt: new Date(),
          completedOn: completionDate,
        },
      });
    });

    return Response.json({ ok: true });
  }

  if (action === "mark-open") {
    await prisma.$transaction(async (tx) => {
      if (scope === "this") {
        for (const taskId of taskIds) {
          const task = await ensureTaskRecord(tx, profileId, taskId);
          await markTaskOpen(tx, task);
        }
        return;
      }

      await tx.task.updateMany({
        where: { profileId, id: { in: targetIds }, completedOn: { not: null } },
        data: {
          completedAt: null,
          completedOn: null,
        },
      });
    });

    return Response.json({ ok: true });
  }

  await prisma.$transaction(async (tx) => {
    if (scope === "this") {
      for (const taskId of taskIds) {
        const task = await ensureTaskRecord(tx, profileId, taskId);
        await deleteSingleTask(tx, task);
      }
      return;
    }

    await tx.task.deleteMany({
      where: { profileId, id: { in: targetIds } },
    });
  });

  return Response.json({ ok: true });
}
