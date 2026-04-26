import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      profile: {
        user: {
          email: session.user.email,
        },
      },
    },
    orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
  });

  return Response.json(tasks);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const dueAtInput = body?.dueAt;
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";
  let dueAt: Date | null | undefined = undefined;

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }

  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      user: {
        email: session.user.email,
      },
    },
    select: { id: true },
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

  const task = await prisma.task.create({
    data: {
      title,
      profileId,
      ...(dueAt !== undefined ? { dueAt } : {}),
    },
  });

  return Response.json(task, { status: 201 });
}
