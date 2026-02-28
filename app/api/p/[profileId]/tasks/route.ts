import { prisma } from "@/app/lib/prisma";
import {
  ensureProfile,
  parseDateInput,
  parseOptionalTextInput,
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
    orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
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

  const task = await prisma.task.create({
    data: {
      title,
      startDate: startDate.value,
      profileId,
      ...(dueAt.value !== undefined ? { dueAt: dueAt.value } : {}),
      ...(category.value !== undefined ? { category: category.value } : {}),
      ...(notes.value !== undefined ? { notes: notes.value } : {}),
      ...(projectId.value !== undefined ? { projectId: projectId.value } : {}),
    },
  });

  return Response.json(task, { status: 201 });
}
