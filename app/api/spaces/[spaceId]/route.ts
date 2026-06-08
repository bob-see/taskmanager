import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
} from "@/app/api/spaces/shared";
import { visibleUserIds } from "@/app/api/users/visibility";

type Ctx = {
  params: Promise<{ spaceId: string }>;
};

export async function GET(req: Request, ctx: Ctx) {
  const { spaceId } = await ctx.params;
  const includeArchivedColumns =
    new URL(req.url).searchParams.get("includeArchivedColumns") === "1";

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
        where: includeArchivedColumns ? undefined : { archivedAt: null },
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
        ...(includeArchivedColumns ? {} : { archivedAt: null }),
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

  const visibleNoteUserIds = await visibleUserIds(
    currentUser.user,
    cells.flatMap((cell) => cell.noteHistory.map((note) => note.userId))
  );
  const visibleCells = cells.map((cell) => ({
    ...cell,
    noteHistory: cell.noteHistory.map((note) =>
      visibleNoteUserIds.has(note.userId)
        ? note
        : {
            ...note,
            userId: "",
            user: {
              id: "",
              name: "Hidden user",
              email: null,
            },
          }
    ),
  }));

  const archivedColumnCount = await prisma.matrixColumn.count({
    where: {
      spaceId,
      archivedAt: { not: null },
    },
  });

  return Response.json({
    ...space,
    cells: visibleCells,
    archivedColumnCount,
    currentMember: membership.member,
  });
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
