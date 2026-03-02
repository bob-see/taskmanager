import { prisma } from "@/app/lib/prisma";
import {
  ensureProfile,
  TASK_ORDER_GAP,
} from "@/app/api/p/tasks-shared";

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
  const profile = await ensureProfile(profileId);

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

  if (tasks.some((task) => task.completedOn !== null)) {
    return Response.json(
      { error: "Only open tasks can be reordered" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.task.update({
        where: { id },
        data: { orderIndex: (index + 1) * TASK_ORDER_GAP },
      });
    }
  });

  return Response.json({ ok: true });
}
