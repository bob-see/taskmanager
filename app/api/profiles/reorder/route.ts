import { prisma } from "@/app/lib/prisma";

const profileSelect = {
  id: true,
  name: true,
  order: true,
  defaultView: true,
  averageBasis: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderedIds = body?.orderedIds;

  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    orderedIds.some((id) => typeof id !== "string")
  ) {
    return Response.json(
      { error: "orderedIds must be a non-empty string array" },
      { status: 400 }
    );
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    return Response.json(
      { error: "orderedIds must not contain duplicates" },
      { status: 400 }
    );
  }

  const profiles = await prisma.profile.findMany({
    select: { id: true },
  });

  if (profiles.length !== orderedIds.length) {
    return Response.json(
      { error: "orderedIds must include every profile exactly once" },
      { status: 400 }
    );
  }

  const existingIds = new Set(profiles.map((profile) => profile.id));
  if (orderedIds.some((id) => !existingIds.has(id))) {
    return Response.json(
      { error: "orderedIds must only contain valid profile ids" },
      { status: 400 }
    );
  }

  const reorderedProfiles = await prisma.$transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.profile.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    return tx.profile.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: profileSelect,
    });
  });

  return Response.json(reorderedProfiles);
}
