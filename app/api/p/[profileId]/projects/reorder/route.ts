import { prisma } from "@/app/lib/prisma";
import {
  ensureProfile,
  PROJECT_ORDER_GAP,
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
      { error: "orderedIds must contain at least one unique project id" },
      { status: 400 }
    );
  }

  const projects = await prisma.project.findMany({
    where: {
      profileId,
    },
    select: {
      id: true,
    },
  });

  if (projects.length !== orderedIds.length) {
    return Response.json(
      { error: "orderedIds must include every project exactly once" },
      { status: 400 }
    );
  }

  const existingIds = new Set(projects.map((project) => project.id));
  if (orderedIds.some((id) => !existingIds.has(id))) {
    return Response.json({ error: "One or more projects were not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.project.update({
        where: { id },
        data: { orderIndex: (index + 1) * PROJECT_ORDER_GAP },
      });
    }
  });

  return Response.json({ ok: true });
}
