import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
} from "@/app/api/spaces/shared";
import { createActivityLog } from "@/app/lib/activity-log";

type Ctx = {
  params: Promise<{ spaceId: string }>;
};

export async function POST(req: Request, ctx: Ctx) {
  const { spaceId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const row = await prisma.$transaction(async (tx) => {
    const space = await tx.collaborativeSpace.findUniqueOrThrow({
      where: { id: spaceId },
      select: { name: true },
    });
    const result = await tx.matrixRow.aggregate({
      where: { spaceId },
      _max: { order: true },
    });

    const createdRow = await tx.matrixRow.create({
      data: {
        spaceId,
        name,
        order: (result._max.order ?? -1) + 1,
      },
    });

    await createActivityLog(tx, {
      userId: currentUser.user.id,
      spaceId,
      type: "space.item_create",
      description: `Created item "${createdRow.name}" in "${space.name}"`,
      metadata: {
        spaceId,
        spaceName: space.name,
        rowId: createdRow.id,
        itemId: createdRow.id,
        rowTitle: createdRow.name,
        itemTitle: createdRow.name,
      },
    });

    return createdRow;
  });

  return Response.json(row, { status: 201 });
}
