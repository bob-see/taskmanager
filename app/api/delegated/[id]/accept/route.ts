import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getNextTaskOrderIndex } from "@/app/api/p/tasks-shared";
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
  const note = readOptionalText(body?.note, "Note");
  if (note.error) return note.error;
  const profileId =
    typeof body?.profileId === "string" && body.profileId.trim()
      ? body.profileId.trim()
      : null;

  if (profileId) {
    const profile = await prisma.profile.findFirst({
      where: {
        id: profileId,
        userId: currentUser.id,
      },
      select: { id: true },
    });

    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }
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
          id: true,
          title: true,
          notes: true,
          dueAt: true,
          startDate: true,
          category: true,
          profileId: true,
          repeatEnabled: true,
          repeatPattern: true,
          repeatDays: true,
          repeatWeeklyDay: true,
          repeatMonthlyDay: true,
          noteHistory: {
            orderBy: { createdAt: "asc" },
            select: {
              userId: true,
              content: true,
              waitingOn: true,
              createdAt: true,
            },
          },
          profile: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!delegatedTask) {
    return Response.json({ error: "Delegated task not found" }, { status: 404 });
  }

  if (delegatedTask.assignedToUserId !== currentUser.id) {
    return Response.json(
      { error: "Only the assigned user can accept this task" },
      { status: 403 }
    );
  }

  if (delegatedTask.status !== "PENDING") {
    return Response.json(
      { error: "Only pending delegated tasks can be accepted" },
      { status: 409 }
    );
  }

  try {
    const now = new Date();
    let acceptedTaskId = delegatedTask.taskId;

    await prisma.$transaction(async (tx: PrismaTransaction) => {
      if (profileId) {
        const orderIndex = await getNextTaskOrderIndex(tx, profileId);

        if (!delegatedTask.task.profileId) {
          await tx.task.update({
            where: { id: delegatedTask.taskId },
            data: {
              profileId,
              orderIndex,
            },
          });
        } else if (delegatedTask.task.profile?.userId !== currentUser.id) {
          const receiverTask = await tx.task.create({
            data: {
              title: delegatedTask.task.title,
              notes: delegatedTask.task.notes,
              dueAt: delegatedTask.task.dueAt,
              startDate: delegatedTask.task.startDate,
              category: delegatedTask.task.category,
              profileId,
              orderIndex,
              repeatEnabled: delegatedTask.task.repeatEnabled,
              repeatPattern: delegatedTask.task.repeatPattern,
              repeatDays: delegatedTask.task.repeatDays,
              repeatWeeklyDay: delegatedTask.task.repeatWeeklyDay,
              repeatMonthlyDay: delegatedTask.task.repeatMonthlyDay,
            },
          });

          if (delegatedTask.task.noteHistory.length > 0) {
            await tx.taskNote.createMany({
              data: delegatedTask.task.noteHistory.map((historyNote) => ({
                taskId: receiverTask.id,
                userId: historyNote.userId,
                content: historyNote.content,
                waitingOn: historyNote.waitingOn,
                createdAt: historyNote.createdAt,
              })),
            });
          }

          await tx.delegatedTask.update({
            where: { id: delegatedTask.id },
            data: { taskId: receiverTask.id },
          });
          acceptedTaskId = receiverTask.id;
        }
      }

      const updateResult = await tx.delegatedTask.updateMany({
        where: {
          id: delegatedTask.id,
          assignedToUserId: currentUser.id,
          status: "PENDING",
        },
        data: {
          status: "ACCEPTED",
          respondedAt: now,
          acceptedAt: now,
        },
      });

      if (updateResult.count !== 1) {
        throw new Error("STALE_DELEGATED_TASK");
      }

      await tx.taskNote.createMany({
        data: [
          {
            taskId: acceptedTaskId,
            userId: currentUser.id,
            content: `${formatUserName(currentUser)} accepted this delegated task.`,
          },
          ...(note.value
            ? [
                {
                  taskId: acceptedTaskId,
                  userId: currentUser.id,
                  content: note.value,
                },
              ]
            : []),
        ],
      });

      await createDelegatedTaskNotification(
        {
          event: "accepted",
          delegatedTaskId: delegatedTask.id,
          taskTitle: delegatedTask.task.title,
          recipientUserId: delegatedTask.assignedByUserId,
          actor: currentUser,
        },
        tx
      );
    }, DELEGATED_TRANSACTION_OPTIONS);

    const result = await prisma.delegatedTask.findUniqueOrThrow({
      where: { id: delegatedTask.id },
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_DELEGATED_TASK") {
      return Response.json(
        { error: "Only pending delegated tasks can be accepted" },
        { status: 409 }
      );
    }

    console.error("Delegated task accept failed", {
      delegatedTaskId: delegatedTask.id,
      taskId: delegatedTask.taskId,
      assignedToUserId: currentUser.id,
      error,
    });

    return Response.json(
      { error: "Could not accept delegated task" },
      { status: 500 }
    );
  }
}
