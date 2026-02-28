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

  const existingProject = await prisma.project.findFirst({
    where: { id, profileId },
    select: { id: true },
  });

  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    startDate?: Date;
    dueAt?: Date | null;
    category?: string | null;
    archived?: boolean;
    collapsed?: boolean;
  } = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = name;
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

  if (body?.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      return Response.json({ error: "archived must be a boolean" }, { status: 400 });
    }
    data.archived = body.archived;
  }

  if (body?.collapsed !== undefined) {
    if (typeof body.collapsed !== "boolean") {
      return Response.json({ error: "collapsed must be a boolean" }, { status: 400 });
    }
    data.collapsed = body.collapsed;
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error:
          "Body must include at least one of name, startDate, dueAt, category, archived, or collapsed",
      },
      { status: 400 }
    );
  }

  const project = await prisma.project.update({
    where: { id },
    data,
  });

  return Response.json(project);
}
