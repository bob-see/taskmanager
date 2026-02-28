import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  ensureProfile,
  ensureProject,
  getRecurringSeriesId,
  nextOccurrenceDate,
  normalizeRepeatSettings,
  parseOptionalBooleanInput,
  parseOptionalIntInput,
  parseOptionalRepeatPatternInput,
  parseDateInput,
  parseOptionalTextInput,
} from "@/app/api/p/tasks-shared";

type Ctx = {
  params: Promise<{ profileId: string; id: string }>;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { profileId, id } = await ctx.params;

  const profile = await ensureProfile(profileId);
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const existingTask = await prisma.task.findFirst({
    where: { id, profileId },
    select: {
      id: true,
      title: true,
      startDate: true,
      dueAt: true,
      category: true,
      notes: true,
      projectId: true,
      recurrenceSeriesId: true,
      completedAt: true,
      completedOn: true,
      repeatEnabled: true,
      repeatPattern: true,
      repeatDays: true,
      repeatWeeklyDay: true,
      repeatMonthlyDay: true,
    },
  });
  if (!existingTask) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: {
    title?: string;
    startDate?: Date;
    dueAt?: Date | null;
    category?: string | null;
    notes?: string | null;
    projectId?: string | null;
    recurrenceSeriesId?: string | null;
    completedAt?: Date | null;
    completedOn?: Date | null;
    repeatEnabled?: boolean;
    repeatPattern?: string | null;
    repeatDays?: number | null;
    repeatWeeklyDay?: number | null;
    repeatMonthlyDay?: number | null;
  } = {};
  let completionBaseDate: Date | null = null;

  if (body?.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }
    data.title = title;
  }

  if (body?.startDate !== undefined) {
    const startDate = parseDateInput(body.startDate, "startDate");
    if (startDate.error) return startDate.error;
    if (!startDate.value) {
      return Response.json({ error: "startDate is required" }, { status: 400 });
    }
    data.startDate = startDate.value;
  }

  if (body?.dueAt !== undefined) {
    const dueAt = parseDateInput(body.dueAt, "dueAt");
    if (dueAt.error) return dueAt.error;
    data.dueAt = dueAt.value ?? null;
  }

  if (body?.category !== undefined) {
    const category = parseOptionalTextInput(body.category, "category");
    if (category.error) return category.error;
    data.category = category.value ?? null;
  }

  if (body?.notes !== undefined) {
    const notes = parseOptionalTextInput(body.notes, "notes");
    if (notes.error) return notes.error;
    data.notes = notes.value ?? null;
  }

  if (body?.projectId !== undefined) {
    const projectId = parseOptionalTextInput(body.projectId, "projectId");
    if (projectId.error) return projectId.error;
    if (projectId.value) {
      const project = await ensureProject(profileId, projectId.value);
      if (!project) {
        return Response.json({ error: "Project not found" }, { status: 404 });
      }
    }
    data.projectId = projectId.value ?? null;
  }

  const repeatEnabled = parseOptionalBooleanInput(
    body?.repeatEnabled,
    "repeatEnabled"
  );
  if (repeatEnabled.error) return repeatEnabled.error;

  const repeatPattern = parseOptionalRepeatPatternInput(
    body?.repeatPattern,
    "repeatPattern"
  );
  if (repeatPattern.error) return repeatPattern.error;

  const repeatDays = parseOptionalIntInput(
    body?.repeatDays,
    "repeatDays",
    1,
    127
  );
  if (repeatDays.error) return repeatDays.error;

  const repeatWeeklyDay = parseOptionalIntInput(
    body?.repeatWeeklyDay,
    "repeatWeeklyDay",
    1,
    7
  );
  if (repeatWeeklyDay.error) return repeatWeeklyDay.error;

  const repeatMonthlyDay = parseOptionalIntInput(
    body?.repeatMonthlyDay,
    "repeatMonthlyDay",
    1,
    31
  );
  if (repeatMonthlyDay.error) return repeatMonthlyDay.error;

  const repeatFieldsTouched =
    body?.repeatEnabled !== undefined ||
    body?.repeatPattern !== undefined ||
    body?.repeatDays !== undefined ||
    body?.repeatWeeklyDay !== undefined ||
    body?.repeatMonthlyDay !== undefined;

  if (repeatFieldsTouched) {
    const normalizedRepeat = normalizeRepeatSettings({
      repeatEnabled: repeatEnabled.value ?? existingTask.repeatEnabled,
      repeatPattern: repeatPattern.value ?? existingTask.repeatPattern,
      repeatDays: repeatDays.value ?? existingTask.repeatDays,
      repeatWeeklyDay: repeatWeeklyDay.value ?? existingTask.repeatWeeklyDay,
      repeatMonthlyDay: repeatMonthlyDay.value ?? existingTask.repeatMonthlyDay,
      referenceDate: data.startDate ?? existingTask.startDate,
    });
    if (normalizedRepeat.error) return normalizedRepeat.error;

    data.repeatEnabled = normalizedRepeat.value?.repeatEnabled;
    data.repeatPattern = normalizedRepeat.value?.repeatPattern ?? null;
    data.repeatDays = normalizedRepeat.value?.repeatDays ?? null;
    data.repeatWeeklyDay = normalizedRepeat.value?.repeatWeeklyDay ?? null;
    data.repeatMonthlyDay = normalizedRepeat.value?.repeatMonthlyDay ?? null;
  }

  if (body?.completed !== undefined) {
    const completed = parseOptionalBooleanInput(body.completed, "completed");
    if (completed.error) return completed.error;
    if (completed.value) {
      const completedAt = new Date();
      const completedOnInput = parseDateInput(
        body.completedOn ?? completedAt.toISOString(),
        "completedOn"
      );
      if (completedOnInput.error) return completedOnInput.error;

      completionBaseDate = completedOnInput.value ?? completedAt;
      data.completedAt = completedAt;
      data.completedOn = completionBaseDate;
    } else {
      data.completedAt = null;
      data.completedOn = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error:
          "Body must include at least one of title, startDate, dueAt, category, notes, projectId, repeat settings, or completed",
      },
      { status: 400 }
    );
  }

  const finalRepeat = normalizeRepeatSettings({
    repeatEnabled: data.repeatEnabled ?? existingTask.repeatEnabled,
    repeatPattern: data.repeatPattern ?? existingTask.repeatPattern,
    repeatDays: data.repeatDays ?? existingTask.repeatDays,
    repeatWeeklyDay: data.repeatWeeklyDay ?? existingTask.repeatWeeklyDay,
    repeatMonthlyDay: data.repeatMonthlyDay ?? existingTask.repeatMonthlyDay,
    referenceDate: data.startDate ?? existingTask.startDate,
  });
  if (finalRepeat.error) return finalRepeat.error;

  if (finalRepeat.value?.repeatEnabled) {
    data.recurrenceSeriesId = getRecurringSeriesId(existingTask);
  }

  const result = await prisma.$transaction(async (tx) => {
    const isCompletingTask = body?.completed === true;

    if (isCompletingTask) {
      const markedDone = await tx.task.updateMany({
        where: { id, profileId, completedAt: null },
        data,
      });

      if (markedDone.count === 0) {
        const task = await tx.task.findFirst({ where: { id, profileId } });
        return { task, createdTask: null };
      }
    } else {
      await tx.task.update({
        where: { id },
        data,
      });
    }

    const task = await tx.task.findFirst({
      where: { id, profileId },
    });

    if (!task) {
      throw new Error("Task not found after update");
    }

    let createdTask = null;
    if (
      isCompletingTask &&
      finalRepeat.value?.repeatEnabled &&
      finalRepeat.value.repeatPattern
    ) {
      const recurrenceSeriesId = getRecurringSeriesId(existingTask);
      const completedOn = completionBaseDate ?? data.completedOn ?? new Date();
      const nextStartDate = nextOccurrenceDate({
        baseDate: completedOn,
        recurrenceType: finalRepeat.value.repeatPattern,
        repeatDays: finalRepeat.value.repeatDays,
        weeklyDay: finalRepeat.value.repeatWeeklyDay,
        monthlyDay: finalRepeat.value.repeatMonthlyDay,
      });

      const nextTaskData = {
        title: data.title ?? existingTask.title,
        category:
          data.category !== undefined ? data.category : existingTask.category,
        notes: data.notes !== undefined ? data.notes : existingTask.notes,
        projectId:
          data.projectId !== undefined ? data.projectId : existingTask.projectId,
        profileId,
        recurrenceSeriesId,
        startDate: nextStartDate,
        dueAt: null,
        repeatEnabled: finalRepeat.value.repeatEnabled,
        repeatPattern: finalRepeat.value.repeatPattern,
        repeatDays: finalRepeat.value.repeatDays,
        repeatWeeklyDay: finalRepeat.value.repeatWeeklyDay,
        repeatMonthlyDay: finalRepeat.value.repeatMonthlyDay,
      };

      createdTask = await tx.task.findFirst({
        where: {
          profileId,
          recurrenceSeriesId,
          startDate: nextStartDate,
        },
      });

      if (!createdTask) {
        const legacyOccurrence = await tx.task.findFirst({
          where: {
            id: { not: id },
            profileId,
            recurrenceSeriesId: null,
            startDate: nextStartDate,
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
        });

        if (legacyOccurrence) {
          createdTask = await tx.task.update({
            where: { id: legacyOccurrence.id },
            data: {
              recurrenceSeriesId,
            },
          });
        }
      }

      if (!createdTask) {
        try {
          createdTask = await tx.task.create({
            data: nextTaskData,
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            createdTask = await tx.task.findFirst({
              where: {
                profileId,
                recurrenceSeriesId,
                startDate: nextStartDate,
              },
            });
          } else {
            throw error;
          }
        }
      }
    }

    return { task, createdTask };
  });

  return Response.json(result);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { profileId, id } = await ctx.params;
  const { searchParams } = new URL(_req.url);
  const mode = searchParams.get("mode") ?? "this";

  const profile = await ensureProfile(profileId);
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!["this", "future", "series"].includes(mode)) {
    return Response.json(
      { error: "mode must be one of: this, future, series" },
      { status: 400 }
    );
  }

  const task = await prisma.task.findFirst({
    where: { id, profileId },
    select: {
      id: true,
      profileId: true,
      title: true,
      startDate: true,
      dueAt: true,
      category: true,
      notes: true,
      projectId: true,
      recurrenceSeriesId: true,
      repeatEnabled: true,
      repeatPattern: true,
      repeatDays: true,
      repeatWeeklyDay: true,
      repeatMonthlyDay: true,
    },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  let deleted;

  if (mode === "this" || !task.recurrenceSeriesId) {
    if (
      mode === "this" &&
      task.recurrenceSeriesId &&
      task.repeatEnabled &&
      task.repeatPattern
    ) {
      deleted = await prisma.$transaction(async (tx) => {
        const deletedTask = await tx.task.deleteMany({
          where: { id, profileId },
        });

        if (deletedTask.count === 0) {
          return deletedTask;
        }

        const futureOccurrence = await tx.task.findFirst({
          where: {
            profileId,
            recurrenceSeriesId: task.recurrenceSeriesId,
            startDate: { gt: task.startDate },
          },
          select: { id: true },
        });

        if (futureOccurrence) {
          return deletedTask;
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
            profileId,
            recurrenceSeriesId: task.recurrenceSeriesId,
            startDate: nextStartDate,
          },
          select: { id: true },
        });

        if (!existingNextOccurrence) {
          try {
            await tx.task.create({
              data: {
                title: task.title,
                notes: task.notes,
                dueAt: null,
                category: task.category,
                startDate: nextStartDate,
                profileId,
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

        return deletedTask;
      });
    } else {
      deleted = await prisma.task.deleteMany({
        where: { id, profileId },
      });
    }
  } else if (mode === "future") {
    deleted = await prisma.task.deleteMany({
      where: {
        profileId,
        recurrenceSeriesId: task.recurrenceSeriesId,
        startDate: { gte: task.startDate },
      },
    });
  } else {
    deleted = await prisma.task.deleteMany({
      where: {
        profileId,
        recurrenceSeriesId: task.recurrenceSeriesId,
      },
    });
  }

  if (deleted.count === 0) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
