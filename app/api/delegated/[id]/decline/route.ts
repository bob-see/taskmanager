import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import {
  DELEGATED_TRANSACTION_OPTIONS,
  formatUserName,
  readOptionalText,
  type PrismaTransaction,
} from "@/app/api/delegated/shared";
import { createDelegatedTaskNotification } from "@/app/lib/delegated-task-notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
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

  const body = await req.json().catch(() => ({}));
  const reason = readOptionalText(body?.reason, "Reason");
  if (reason.error) return reason.error;

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

  if (delegatedTask.assignedToUserId !== currentUser.id) {
    return Response.json(
      { error: "Only the assigned user can decline this task" },
      { status: 403 }
    );
  }

  if (delegatedTask.status !== "PENDING") {
    return Response.json(
      { error: "Only pending delegated tasks can be declined" },
      { status: 409 }
    );
  }

  try {
    await prisma.$transaction(async (tx: PrismaTransaction) => {
      const updateResult = await tx.delegatedTask.updateMany({
        where: {
          id: delegatedTask.id,
          assignedToUserId: currentUser.id,
          status: "PENDING",
        },
        data: {
          status: "DECLINED",
          respondedAt: new Date(),
        },
      });

      if (updateResult.count !== 1) {
        throw new Error("STALE_DELEGATED_TASK");
      }
    }, DELEGATED_TRANSACTION_OPTIONS);

    try {
      await prisma.taskNote.createMany({
        data: [
          {
            taskId: delegatedTask.taskId,
            userId: currentUser.id,
            content: `${formatUserName(currentUser)} declined this delegated task.`,
          },
          ...(reason.value
            ? [
                {
                  taskId: delegatedTask.taskId,
                  userId: currentUser.id,
                  content: reason.value,
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      console.error("Delegated task decline note creation failed", {
        delegatedTaskId: delegatedTask.id,
        taskId: delegatedTask.taskId,
        error,
      });
    }

    try {
      await createDelegatedTaskNotification(
        {
          event: "declined",
          delegatedTaskId: delegatedTask.id,
          taskTitle: delegatedTask.task.title,
          recipientUserId: delegatedTask.assignedByUserId,
          actor: currentUser,
          reason: reason.value,
        },
        prisma
      );
    } catch (error) {
      console.error("Delegated task notification dispatch failed", {
        event: "declined",
        delegatedTaskId: delegatedTask.id,
        error,
      });
    }

    const updatedDelegatedTask = await prisma.delegatedTask.findUniqueOrThrow({
      where: { id: delegatedTask.id },
    });

    return Response.json(updatedDelegatedTask);
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_DELEGATED_TASK") {
      return Response.json(
        { error: "Only pending delegated tasks can be declined" },
        { status: 409 }
      );
    }

    console.error("Delegated task decline failed", {
      delegatedTaskId: delegatedTask.id,
      taskId: delegatedTask.taskId,
      assignedToUserId: currentUser.id,
      error,
    });

    return Response.json(
      { error: "Could not decline delegated task" },
      { status: 500 }
    );
  }
}
