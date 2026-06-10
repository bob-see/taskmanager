import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createActivityLog } from "@/app/lib/activity-log";
import type { PrismaTransaction } from "@/app/api/delegated/shared";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const completed =
    typeof body?.completed === "boolean" ? body.completed : undefined;
  const dueAtInput = body?.dueAt;
  let dueAt: Date | null | undefined = undefined;

  if (dueAtInput === null) {
    dueAt = null;
  } else if (dueAtInput === undefined) {
    dueAt = undefined;
  } else if (typeof dueAtInput === "string") {
    const parsed = new Date(dueAtInput);
    if (Number.isNaN(parsed.getTime())) {
      return Response.json(
        { error: "dueAt must be an ISO datetime string or null" },
        { status: 400 }
      );
    }
    dueAt = parsed;
  } else {
    return Response.json(
      { error: "dueAt must be an ISO datetime string or null" },
      { status: 400 }
    );
  }

  if (completed === undefined && dueAt === undefined) {
    return Response.json(
      { error: "Body must include completed and/or dueAt" },
      { status: 400 }
    );
  }

  const task = await prisma.task.findFirst({
    where: {
      id,
      profile: {
        user: {
          email: session.user.email,
        },
      },
    },
    select: {
      id: true,
      title: true,
      profileId: true,
      projectId: true,
      completedAt: true,
      profile: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      ...(completed !== undefined
        ? { completedAt: completed ? new Date() : null }
        : {}),
      ...(dueAt !== undefined ? { dueAt } : {}),
    },
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

  if (task.profile?.userId && completed !== undefined) {
    const didComplete = !task.completedAt && updatedTask.completedAt;
    const didReopen = task.completedAt && !updatedTask.completedAt;

    if (didComplete || didReopen) {
      await createActivityLog(prisma, {
        userId: task.profile.userId,
        profileId: task.profileId,
        taskId: task.id,
        projectId: task.projectId,
        type: didComplete ? "task.complete" : "task.reopen",
        description: `${didComplete ? "Completed" : "Reopened"} task "${task.title}"`,
      });
    }
  }

  return Response.json(updatedTask);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await prisma.task.findFirst({
    where: {
      id,
      profile: {
        user: {
          email: session.user.email,
        },
      },
    },
    select: {
      id: true,
      title: true,
      profileId: true,
      projectId: true,
      profile: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    await tx.task.delete({
      where: { id: task.id },
    });

    if (task.profile?.userId) {
      await createActivityLog(tx, {
        userId: task.profile.userId,
        profileId: task.profileId,
        taskId: task.id,
        projectId: task.projectId,
        type: "task.delete",
        description: `Deleted task "${task.title}"`,
      });
    }
  });

  return new Response(null, { status: 204 });
}
