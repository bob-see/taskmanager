import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createActivityLog } from "@/app/lib/activity-log";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  const tasks = await prisma.task.findMany({
    where: {
      profile: {
        user: {
          email,
        },
      },
    },
    orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
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

  return Response.json(tasks);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const dueAtInput = body?.dueAt;
  const newNote =
    body?.notes === undefined || body?.notes === null
      ? null
      : typeof body.notes === "string"
        ? body.notes.trim()
        : undefined;
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";
  let dueAt: Date | null | undefined = undefined;

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }

  if (newNote === undefined) {
    return Response.json({ error: "notes must be a string" }, { status: 400 });
  }

  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      user: {
        email,
      },
    },
    select: { id: true, userId: true },
  });

  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

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

  const task = await prisma.$transaction(async (tx: any) => {
    const createdTask = await tx.task.create({
      data: {
        title,
        profileId,
        ...(dueAt !== undefined ? { dueAt } : {}),
      },
    });

    if (profile.userId) {
      await createActivityLog(tx as any, {
        userId: profile.userId,
        profileId,
        taskId: createdTask.id,
        projectId: createdTask.projectId,
        type: "task.create",
        description: `Created task "${createdTask.title}"`,
      });
    }

    if (newNote) {
      await tx.taskNote.create({
        data: {
          taskId: createdTask.id,
          userId: profile.userId ?? null,
          content: newNote,
        },
      });
    }

    return tx.task.findUniqueOrThrow({
      where: { id: createdTask.id },
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
  });

  return Response.json(task, { status: 201 });
}
