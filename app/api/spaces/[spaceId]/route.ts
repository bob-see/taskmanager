import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
} from "@/app/api/spaces/shared";

type Ctx = {
  params: Promise<{ spaceId: string }>;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { spaceId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const space = await prisma.collaborativeSpace.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      rows: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
      },
      columns: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: {
          statusOptions: {
            orderBy: [{ order: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });

  if (!space) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  const cells = await prisma.matrixCell.findMany({
    where: {
      row: {
        spaceId,
      },
      column: {
        spaceId,
      },
    },
    include: {
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

  return Response.json({ ...space, cells, currentMember: membership.member });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { spaceId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const space = await prisma.collaborativeSpace.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      members: {
        where: { userId: currentUser.user.id },
        select: { role: true },
      },
    },
  });

  if (!space || space.members.length === 0) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  if (space.members[0].role !== "owner") {
    return Response.json(
      { error: "Only owners can delete spaces" },
      { status: 403 }
    );
  }

  await prisma.collaborativeSpace.delete({
    where: { id: spaceId },
  });

  return Response.json({ ok: true });
}
