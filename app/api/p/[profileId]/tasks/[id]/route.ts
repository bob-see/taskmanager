import { prisma } from "@/app/lib/prisma";
import {
  ensureProfile,
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
    select: { id: true },
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
    completedAt?: Date | null;
  } = {};

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
    data.projectId = projectId.value ?? null;
  }

  if (body?.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      return Response.json(
        { error: "completed must be a boolean" },
        { status: 400 }
      );
    }
    data.completedAt = body.completed ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error:
          "Body must include at least one of title, startDate, dueAt, category, notes, projectId, or completed",
      },
      { status: 400 }
    );
  }

  const task = await prisma.task.update({
    where: { id },
    data,
  });

  return Response.json(task);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { profileId, id } = await ctx.params;

  const profile = await ensureProfile(profileId);
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const deleted = await prisma.task.deleteMany({
    where: { id, profileId },
  });

  if (deleted.count === 0) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
