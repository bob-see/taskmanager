import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { TASK_ORDER_GAP } from "@/app/api/p/tasks-shared";
import { Prisma } from "@prisma/client";

type Ctx = {
  params: Promise<{ profileId: string }>;
};

function parseOrderedIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const orderedIds = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );

  if (orderedIds.length !== value.length) {
    return null;
  }

  return new Set(orderedIds).size === orderedIds.length ? orderedIds : null;
}

export async function POST(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  const body = await req.json().catch(() => ({}));
  const orderedIds = parseOrderedIds(body?.orderedIds);

  if (!orderedIds) {
    return Response.json(
      { error: "orderedIds must contain at least one unique task id" },
      { status: 400 }
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      profileId,
      id: { in: orderedIds },
    },
    select: {
      id: true,
      completedOn: true,
    },
  });

  if (tasks.length !== orderedIds.length) {
    return Response.json({ error: "One or more tasks were not found" }, { status: 404 });
  }

  if (tasks.some((task: { completedOn: Date | null }) => task.completedOn !== null)) {
    return Response.json(
      { error: "Only open tasks can be reordered" },
      { status: 400 }
    );
  }

  const orderCases = orderedIds.map((id, index) =>
    Prisma.sql`WHEN ${id} THEN ${(index + 1) * TASK_ORDER_GAP}`
  );

  await prisma.$executeRaw`
    UPDATE task
    SET
      orderIndex = CASE id ${Prisma.join(orderCases, " ")} END,
      updatedAt = CURRENT_TIMESTAMP(3)
    WHERE profileId = ${profileId}
      AND completedOn IS NULL
      AND id IN (${Prisma.join(orderedIds)})
  `;

  return Response.json({ ok: true });
}
