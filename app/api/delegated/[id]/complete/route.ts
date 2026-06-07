import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { formatUserName } from "@/app/api/delegated/shared";
import { prisma } from "@/app/lib/prisma";

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
      assignedToUserId: true,
      taskId: true,
    },
  });

  if (!delegatedTask) {
    return Response.json({ error: "Delegated task not found" }, { status: 404 });
  }

  if (delegatedTask.assignedToUserId !== currentUser.id) {
    return Response.json(
      { error: "Only the assigned user can mark this task complete" },
      { status: 403 }
    );
  }

  if (delegatedTask.status !== "IN_PROGRESS") {
    return Response.json(
      { error: "Only in-progress delegated tasks can be marked complete" },
      { status: 409 }
    );
  }

  try {
    const now = new Date();
    const updateResult = await prisma.delegatedTask.updateMany({
      where: {
        id: delegatedTask.id,
        assignedToUserId: currentUser.id,
        status: "IN_PROGRESS",
      },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });

    if (updateResult.count !== 1) {
      return Response.json(
        { error: "Only in-progress delegated tasks can be marked complete" },
        { status: 409 }
      );
    }

    try {
      await prisma.taskNote.create({
        data: {
          taskId: delegatedTask.taskId,
          userId: currentUser.id,
          content: `${formatUserName(currentUser)} marked this delegated task as completed.`,
        },
      });
    } catch (error) {
      console.error("Delegated task complete note creation failed", {
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
    console.error("Delegated task complete failed", {
      delegatedTaskId: delegatedTask.id,
      taskId: delegatedTask.taskId,
      assignedToUserId: currentUser.id,
      error,
    });

    return Response.json(
      { error: "Could not mark delegated task complete" },
      { status: 500 }
    );
  }
}
