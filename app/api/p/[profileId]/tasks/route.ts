import { prisma } from "@/app/lib/prisma";
import {
  ensureProfile,
  ensureProject,
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

  const profile = await ensureProfile(profileId);
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const tasks = await prisma.task.findMany({
    where: { profileId },
    orderBy: [{ completedOn: "asc" }, { createdAt: "desc" }],
  });

  return Response.json(tasks);
}

export async function POST(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;

  const profile = await ensureProfile(profileId);
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

  const notes = parseOptionalTextInput(body?.notes, "notes");
  if (notes.error) return notes.error;

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

  const normalizedRepeat = normalizeRepeatSettings({
    repeatEnabled: repeatEnabled.value ?? false,
    repeatPattern: repeatPattern.value ?? null,
    repeatDays: repeatDays.value ?? null,
    repeatWeeklyDay: repeatWeeklyDay.value ?? null,
    repeatMonthlyDay: repeatMonthlyDay.value ?? null,
    referenceDate: startDate.value,
  });
  if (normalizedRepeat.error) return normalizedRepeat.error;

  const normalizedStartDate = normalizedRepeat.value?.repeatEnabled
    ? toLocalDayStart(startDate.value)
    : startDate.value;

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        title,
        startDate: normalizedStartDate,
        profileId,
        ...(dueAt.value !== undefined ? { dueAt: dueAt.value } : {}),
        ...(category.value !== undefined ? { category: category.value } : {}),
        ...(notes.value !== undefined ? { notes: notes.value } : {}),
        ...(projectId.value !== undefined ? { projectId: projectId.value } : {}),
        ...normalizedRepeat.value,
      },
    });

    if (!normalizedRepeat.value?.repeatEnabled) {
      return createdTask;
    }

    return tx.task.update({
      where: { id: createdTask.id },
      data: {
        recurrenceSeriesId: createdTask.id,
      },
    });
  });

  return Response.json(task, { status: 201 });
}
