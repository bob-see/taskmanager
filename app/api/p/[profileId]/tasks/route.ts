import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createActivityLog } from "@/app/lib/activity-log";
import {
  ensureProject,
  getNextTaskOrderIndex,
  normalizeRepeatSettings,
  parseOptionalBooleanInput,
  parseOptionalIntInput,
  parseOptionalRepeatPatternInput,
  parseDateInput,
  parseOptionalTextInput,
  toLocalDayStart,
} from "@/app/api/p/tasks-shared";

type Ctx = {
  params: Promise<{ profileId: string }>;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      user: {
        email: session.user.email,
      },
    },
    select: { id: true, userId: true },
  });
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const tasks = await prisma.task.findMany({
    where: { profileId },
    orderBy: [{ completedOn: "asc" }, { createdAt: "desc" }],
    include: {
      delegatedTask: {
        select: {
          id: true,
          status: true,
        },
      },
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
    },
  });

  return Response.json(tasks);
}

export async function POST(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      user: {
        email: session.user.email,
      },
    },
  });
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  const startDate = parseDateInput(body?.startDate, "startDate");
  if (startDate.error) return startDate.error;
  if (!startDate.value) {
    return Response.json({ error: "startDate is required" }, { status: 400 });
  }

  const dueAt = parseDateInput(body?.dueAt, "dueAt");
  if (dueAt.error) return dueAt.error;

  const category = parseOptionalTextInput(body?.category, "category");
  if (category.error) return category.error;

  const newNote = parseOptionalTextInput(body?.notes, "notes");
  if (newNote.error) return newNote.error;

  const waitingOn = parseOptionalTextInput(body?.waitingOn, "waitingOn");
  if (waitingOn.error) return waitingOn.error;

  const projectId = parseOptionalTextInput(body?.projectId, "projectId");
  if (projectId.error) return projectId.error;
  if (projectId.value) {
    const project = await ensureProject(profileId, projectId.value);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
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

  const repeatInterval = parseOptionalIntInput(
    body?.repeatInterval,
    "repeatInterval",
    1,
    365
  );
  if (repeatInterval.error) return repeatInterval.error;

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

  const repeatPaused = parseOptionalBooleanInput(
    body?.repeatPaused,
    "repeatPaused"
  );
  if (repeatPaused.error) return repeatPaused.error;

  const repeatPauseUntil = parseDateInput(body?.repeatPauseUntil, "repeatPauseUntil");
  if (repeatPauseUntil.error) return repeatPauseUntil.error;

  const repeatPauseNote = parseOptionalTextInput(
    body?.repeatPauseNote,
    "repeatPauseNote"
  );
  if (repeatPauseNote.error) return repeatPauseNote.error;

  const normalizedRepeat = normalizeRepeatSettings({
    repeatEnabled: repeatEnabled.value ?? false,
    repeatPattern: repeatPattern.value ?? null,
    repeatInterval: repeatInterval.value ?? null,
    repeatDays: repeatDays.value ?? null,
    repeatWeeklyDay: repeatWeeklyDay.value ?? null,
    repeatMonthlyDay: repeatMonthlyDay.value ?? null,
    referenceDate: startDate.value,
  });
  if (normalizedRepeat.error) return normalizedRepeat.error;

  const normalizedStartDate = normalizedRepeat.value?.repeatEnabled
    ? toLocalDayStart(startDate.value)
    : startDate.value;

  const createdTask = await prisma.$transaction(async (tx: any) => {
    const orderIndex = await getNextTaskOrderIndex(tx, profileId);
    const createdTask = await tx.task.create({
      data: {
        title,
        startDate: normalizedStartDate,
        profileId,
        orderIndex,
        ...(dueAt.value !== undefined ? { dueAt: dueAt.value } : {}),
        ...(category.value !== undefined ? { category: category.value } : {}),
        ...(projectId.value !== undefined ? { projectId: projectId.value } : {}),
        ...normalizedRepeat.value,
        repeatPaused:
          normalizedRepeat.value?.repeatEnabled && repeatPaused.value
            ? repeatPaused.value
            : false,
        repeatPauseUntil:
          normalizedRepeat.value?.repeatEnabled && repeatPaused.value
            ? repeatPauseUntil.value ?? null
            : null,
        repeatPauseNote:
          normalizedRepeat.value?.repeatEnabled && repeatPaused.value
            ? repeatPauseNote.value ?? null
            : null,
      },
    });

    const task = normalizedRepeat.value?.repeatEnabled
      ? await tx.task.update({
          where: { id: createdTask.id },
          data: {
            recurrenceSeriesId: createdTask.id,
          },
        })
      : createdTask;

    return task;
  });

  let noteSaveErrorMessage: string | null = null;
  if (newNote.value || waitingOn.value) {
    try {
      await prisma.taskNote.create({
        data: {
          taskId: createdTask.id,
          userId: profile.userId ?? null,
          content: newNote.value ?? "",
          waitingOn: waitingOn.value ?? null,
        },
      });
    } catch (error) {
      console.error("Task note create failed after task creation", {
        taskId: createdTask.id,
        profileId,
        error,
      });
      noteSaveErrorMessage =
        "Task was created, but the note could not be saved. Please add the note again from task details.";
    }
  }

  if (profile.userId) {
    try {
      await createActivityLog(prisma, {
        userId: profile.userId,
        profileId,
        taskId: createdTask.id,
        projectId: createdTask.projectId,
        type: "task.create",
        description: `Created task "${createdTask.title}"`,
      });
    } catch (error) {
      console.error("Task create activity log failed", {
        taskId: createdTask.id,
        profileId,
        error,
      });
    }
  }

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: createdTask.id },
    include: {
      delegatedTask: {
        select: {
          id: true,
          status: true,
        },
      },
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
    },
  });

  if (noteSaveErrorMessage) {
    return Response.json(
      {
        ...task,
        noteSaveError: true,
        noteSaveErrorMessage,
      },
      { status: 201 }
    );
  }

  return Response.json(task, { status: 201 });
}
