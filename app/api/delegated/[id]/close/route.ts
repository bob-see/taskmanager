import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  DELEGATED_TRANSACTION_OPTIONS,
  formatUserName,
  type PrismaTransaction,
} from "@/app/api/delegated/shared";
import { prisma } from "@/app/lib/prisma";
import { createDelegatedTaskNotification } from "@/app/lib/delegated-task-notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!currentUser) {
    return Response.json({ error: "Authenticated user not found" }, { status: 401 });
  }

  const delegatedTask = await prisma.delegatedTask.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      assignedByUserId: true,
      assignedToUserId: true,
      taskId: true,
      task: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!delegatedTask) {
    return Response.json({ error: "Delegated task not found" }, { status: 404 });
  }

  if (delegatedTask.assignedByUserId !== currentUser.id) {
    return Response.json(
      { error: "Only the original delegator can close this task" },
      { status: 403 }
    );
  }

  if (delegatedTask.status !== "COMPLETED") {
    return Response.json(
      { error: "Only completed delegated tasks can be closed" },
      { status: 409 }
    );
  }

  try {
    const now = new Date();
    await prisma.$transaction(async (tx: PrismaTransaction) => {
      const updateResult = await tx.delegatedTask.updateMany({
        where: {
          id: delegatedTask.id,
          assignedByUserId: currentUser.id,
          status: "COMPLETED",
        },
        data: {
          status: "CLOSED",
          closedAt: now,
        },
      });

      if (updateResult.count !== 1) {
        throw new Error("STALE_DELEGATED_TASK");
      }

      await createDelegatedTaskNotification(
        {
          event: "closed",
          delegatedTaskId: delegatedTask.id,
          taskTitle: delegatedTask.task.title,
          recipientUserId: delegatedTask.assignedToUserId,
          actor: currentUser,
        },
        tx
      );
    }, DELEGATED_TRANSACTION_OPTIONS);

    try {
      await prisma.taskNote.create({
        data: {
          taskId: delegatedTask.taskId,
          userId: currentUser.id,
          content: `${formatUserName(currentUser)} closed this delegated task.`,
        },
      });
    } catch (error) {
      console.error("Delegated task close note creation failed", {
        delegatedTaskId: delegatedTask.id,
        taskId: delegatedTask.taskId,
        error,
      });
    }

    const result = await prisma.delegatedTask.findUniqueOrThrow({
      where: { id: delegatedTask.id },
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_DELEGATED_TASK") {
      return Response.json(
        { error: "Only completed delegated tasks can be closed" },
        { status: 409 }
      );
    }

    console.error("Delegated task close failed", {
      delegatedTaskId: delegatedTask.id,
      taskId: delegatedTask.taskId,
      assignedByUserId: currentUser.id,
      error,
    });

    return Response.json({ error: "Could not close delegated task" }, { status: 500 });
  }
}
