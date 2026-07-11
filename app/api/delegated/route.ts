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

function parseDueDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { value: undefined };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json(
        { error: "Due date must be a date string" },
        { status: 400 }
      ),
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      error: Response.json(
        { error: "Due date must be a valid date string" },
        { status: 400 }
      ),
    };
  }

  return { value: parsed };
}

export async function POST(req: Request) {
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
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ error: "Task title is required" }, { status: 400 });
  }

  const receiverResult = await validateDelegationReceiver(
    currentUser,
    body?.assignedToUserId
  );
  if (receiverResult.error) return receiverResult.error;

  const details = readOptionalText(body?.details, "Details");
  if (details.error) return details.error;

  const message = readOptionalText(body?.message, "Message");
  if (message.error) return message.error;

  const dueAt = parseDueDate(body?.dueAt);
  if (dueAt.error) return dueAt.error;

  const systemNote = `${formatUserName(
    currentUser
  )} created and delegated this task to ${formatUserName(receiverResult.receiver)}.`;
  const noteData = [
    {
      userId: currentUser.id,
      content: systemNote,
    },
    ...(details.value
      ? [
          {
            userId: currentUser.id,
            content: details.value,
          },
        ]
      : []),
    ...(message.value
      ? [
          {
            userId: currentUser.id,
            content: message.value,
          },
        ]
      : []),
  ];

  try {
    const taskId = crypto.randomUUID();
    const delegatedTaskId = crypto.randomUUID();
    const result = await prisma.$transaction(
      async (tx: PrismaTransaction) => {
        const task = await tx.task.create({
          data: {
            id: taskId,
            title,
            profileId: null,
            ...(dueAt.value !== undefined ? { dueAt: dueAt.value } : {}),
          },
        });
        const delegatedTask = await tx.delegatedTask.create({
          data: {
            id: delegatedTaskId,
            taskId,
            assignedByUserId: currentUser.id,
            assignedToUserId: receiverResult.receiver.id,
            status: "PENDING",
          },
        });

        return { task, delegatedTask };
      },
      DELEGATED_TRANSACTION_OPTIONS
    );

    try {
      await prisma.taskNote.createMany({
        data: noteData.map((note) => ({
          taskId: result.task.id,
          userId: note.userId,
          content: note.content,
        })),
      });
    } catch (error) {
      console.error("Delegated task note creation failed", {
        taskId: result.task.id,
        delegatedTaskId: result.delegatedTask.id,
        error,
      });
    }

    try {
      await createDelegatedTaskNotification(
        {
          event: "received",
          delegatedTaskId: result.delegatedTask.id,
          taskTitle: title,
          recipientUserId: receiverResult.receiver.id,
          actor: currentUser,
        },
        prisma
      );
    } catch (error) {
      console.error("Delegated task notification dispatch failed", {
        event: "received",
        delegatedTaskId: result.delegatedTask.id,
        error,
      });
    }

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { error: "This task has already been delegated" },
        { status: 409 }
      );
    }

    console.error("Delegated task creation failed", {
      assignedByUserId: currentUser.id,
      assignedToUserId: receiverResult.receiver.id,
      error,
    });

    return Response.json(
      { error: "Could not create delegated task" },
      { status: 500 }
    );
  }
}
