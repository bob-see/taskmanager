import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readOptionalText } from "@/app/api/delegated/shared";
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

  const delegatedTask = await prisma.delegatedTask.findUnique({
    where: { id },
    select: {
      id: true,
      taskId: true,
      assignedByUserId: true,
      assignedToUserId: true,
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

  const createdNote = await prisma.taskNote.create({
    data: {
      taskId: delegatedTask.taskId,
      userId: currentUser.id,
      content: note.value,
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

  return Response.json(createdNote, { status: 201 });
}
