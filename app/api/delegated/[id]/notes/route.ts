import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  DELEGATED_TRANSACTION_OPTIONS,
  readOptionalText,
  type PrismaTransaction,
} from "@/app/api/delegated/shared";
import { createDelegatedTaskNotification } from "@/app/lib/delegated-task-notifications";
import { prisma } from "@/app/lib/prisma";

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

  if (!note.value) {
    return Response.json({ error: "Note is required" }, { status: 400 });
  }
  const noteContent = note.value;

  const delegatedTask = await prisma.delegatedTask.findUnique({
    where: { id },
    select: {
      id: true,
      taskId: true,
      assignedByUserId: true,
      assignedToUserId: true,
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

  if (
    delegatedTask.assignedByUserId !== currentUser.id &&
    delegatedTask.assignedToUserId !== currentUser.id
  ) {
    return Response.json(
      { error: "Only delegated task participants can add notes" },
      { status: 403 }
    );
  }

  const recipientUserId =
    delegatedTask.assignedByUserId === currentUser.id
      ? delegatedTask.assignedToUserId
      : delegatedTask.assignedByUserId;
  const targetUrl =
    delegatedTask.assignedByUserId === currentUser.id
      ? "/delegated/assigned-to-me"
      : "/delegated/assigned-by-me";

  const taskNoteId = crypto.randomUUID();
  const createdNote = await prisma.$transaction(
    async (tx: PrismaTransaction) => {
      const taskNote = await tx.taskNote.create({
        data: {
          id: taskNoteId,
          taskId: delegatedTask.taskId,
          userId: currentUser.id,
          content: noteContent,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await createDelegatedTaskNotification(
        {
          event: "note-added",
          delegatedTaskId: delegatedTask.id,
          taskTitle: delegatedTask.task.title,
          recipientUserId,
          actor: currentUser,
          taskNoteId,
          targetUrl,
        },
        tx
      );

      return taskNote;
    },
    DELEGATED_TRANSACTION_OPTIONS
  );

  return Response.json(createdNote, { status: 201 });
}
