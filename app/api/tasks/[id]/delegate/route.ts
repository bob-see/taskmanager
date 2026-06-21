import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import {
  DELEGATED_TRANSACTION_OPTIONS,
  formatUserName,
  isUniqueConstraintError,
  readOptionalText,
  type PrismaTransaction,
  validateDelegationReceiver,
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
      role: true,
    },
  });

  if (!currentUser) {
    return Response.json({ error: "Authenticated user not found" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const receiverResult = await validateDelegationReceiver(
    currentUser,
    body?.assignedToUserId
  );
  if (receiverResult.error) return receiverResult.error;

  const message = readOptionalText(body?.message, "Message");
  if (message.error) return message.error;

  const task = await prisma.task.findFirst({
    where: {
      id,
      profile: {
        userId: currentUser.id,
      },
    },
    select: {
      id: true,
      title: true,
      delegatedTask: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.delegatedTask) {
    return Response.json(
      { error: "This task has already been delegated" },
      { status: 409 }
    );
  }

  const systemNote = `${formatUserName(currentUser)} delegated this task to ${formatUserName(
    receiverResult.receiver
  )}.`;
  const noteData = [
    {
      taskId: task.id,
      userId: currentUser.id,
      content: systemNote,
    },
    ...(message.value
      ? [
          {
            taskId: task.id,
            userId: currentUser.id,
            content: message.value,
          },
        ]
      : []),
  ];

  try {
    const delegatedTaskId = crypto.randomUUID();
    const delegatedTask = await prisma.$transaction(
      async (tx: PrismaTransaction) => {
        const createdDelegatedTask = await tx.delegatedTask.create({
          data: {
            id: delegatedTaskId,
            taskId: task.id,
            assignedByUserId: currentUser.id,
            assignedToUserId: receiverResult.receiver.id,
            status: "PENDING",
          },
        });

        await createDelegatedTaskNotification(
          {
            event: "received",
            delegatedTaskId,
            taskTitle: task.title,
            recipientUserId: receiverResult.receiver.id,
            actor: currentUser,
          },
          tx
        );

        return createdDelegatedTask;
      },
      DELEGATED_TRANSACTION_OPTIONS
    );

    try {
      await prisma.taskNote.createMany({
        data: noteData,
      });
    } catch (error) {
      console.error("Existing delegated task note creation failed", {
        taskId: task.id,
        delegatedTaskId: delegatedTask.id,
        error,
      });
    }

    return Response.json(delegatedTask, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { error: "This task has already been delegated" },
        { status: 409 }
      );
    }

    console.error("Existing task delegation failed", {
      taskId: task.id,
      assignedByUserId: currentUser.id,
      assignedToUserId: receiverResult.receiver.id,
      error,
    });

    return Response.json(
      { error: "Could not delegate task" },
      { status: 500 }
    );
  }
}
