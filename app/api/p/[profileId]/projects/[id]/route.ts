import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createActivityLog } from "@/app/lib/activity-log";
import {
  parseDateInput,
  parseOptionalTextInput,
} from "@/app/api/p/tasks-shared";

type Ctx = {
  params: Promise<{ profileId: string; id: string }>;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { profileId, id } = await ctx.params;

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

  const existingProject = await prisma.project.findFirst({
    where: { id, profileId },
    select: { id: true, name: true },
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
    isPriority?: boolean;
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

  if (body?.isPriority !== undefined) {
    if (typeof body.isPriority !== "boolean") {
      return Response.json({ error: "isPriority must be a boolean" }, { status: 400 });
    }
    data.isPriority = body.isPriority;
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error:
          "Body must include at least one of name, startDate, dueAt, category, archived, collapsed, or isPriority",
      },
      { status: 400 }
    );
  }

  const project = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updatedProject = await tx.project.update({
      where: { id },
      data,
    });

    if (profile.userId) {
      await createActivityLog(tx, {
        userId: profile.userId,
        profileId,
        projectId: updatedProject.id,
        type: "project.update",
        description: `Updated project "${updatedProject.name}"`,
      });
    }

    return updatedProject;
  });

  return Response.json(project);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { profileId, id } = await ctx.params;

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

  const existingProject = await prisma.project.findFirst({
    where: { id, profileId },
    select: { id: true, name: true },
  });

  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.task.updateMany({
      where: { projectId: id, profileId },
      data: { projectId: null },
    });

    await tx.project.delete({
      where: { id },
    });

    if (profile.userId) {
      await createActivityLog(tx, {
        userId: profile.userId,
        profileId,
        projectId: existingProject.id,
        type: "project.delete",
        description: `Deleted project "${existingProject.name}"`,
      });
    }
  });

  return new Response(null, { status: 204 });
}
