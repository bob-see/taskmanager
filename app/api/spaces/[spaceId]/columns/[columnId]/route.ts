import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
} from "@/app/api/spaces/shared";
import { createActivityLog } from "@/app/lib/activity-log";

type Ctx = {
  params: Promise<{ spaceId: string; columnId: string }>;
};

type DeleteCheckCell = {
  textValue: string | null;
  numberValue: unknown | null;
  dateValue: Date | null;
  booleanValue: boolean | null;
  statusOptionId: string | null;
  userIdValue: string | null;
  notes: string | null;
  _count: {
    noteHistory: number;
  };
};

function hasMeaningfulCellData(cell: DeleteCheckCell) {
  return (
    Boolean(cell.textValue?.trim()) ||
    cell.numberValue !== null ||
    cell.dateValue !== null ||
    cell.booleanValue !== null ||
    Boolean(cell.statusOptionId) ||
    Boolean(cell.userIdValue) ||
    Boolean(cell.notes?.trim()) ||
    cell._count.noteHistory > 0
  );
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { spaceId, columnId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const body = await req.json().catch(() => ({}));
  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasOrder = Object.prototype.hasOwnProperty.call(body, "order");
  const hasArchive = Object.prototype.hasOwnProperty.call(body, "archive");
  const shouldArchive = body?.archive === true;
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!hasName && !hasOrder && !hasArchive) {
    return Response.json(
      { error: "At least one supported column field is required" },
      { status: 400 }
    );
  }

  if (hasName && !name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  if (hasArchive && typeof body?.archive !== "boolean") {
    return Response.json({ error: "archive must be a boolean" }, { status: 400 });
  }

  const order = Number(body?.order);
  if (hasOrder && (!Number.isInteger(order) || order < 0)) {
    return Response.json({ error: "Order must be a non-negative integer" }, { status: 400 });
  }

  const existingColumn = await prisma.matrixColumn.findFirst({
    where: {
      id: columnId,
      spaceId,
      ...(hasArchive ? {} : { archivedAt: null }),
    },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      space: { select: { name: true } },
    },
  });

  if (!existingColumn) {
    return Response.json({ error: "Column not found" }, { status: 404 });
  }

  const nameChanged = hasName && name !== existingColumn.name;
  const archiveChanged =
    hasArchive && shouldArchive !== (existingColumn.archivedAt !== null);

  const column = await prisma.$transaction(async (tx) => {
    const updatedColumn = await tx.matrixColumn.update({
      where: { id: columnId },
      data: {
        ...(nameChanged ? { name } : {}),
        ...(hasOrder ? { order } : {}),
        ...(archiveChanged ? { archivedAt: shouldArchive ? new Date() : null } : {}),
      },
      include: {
        statusOptions: {
          orderBy: [{ order: "asc" }, { id: "asc" }],
        },
      },
    });

    if (nameChanged) {
      await createActivityLog(tx, {
        userId: currentUser.user.id,
        spaceId,
        type: "space.column_rename",
        description: `Renamed column "${existingColumn.name}" to "${updatedColumn.name}" in "${existingColumn.space.name}"`,
        metadata: {
          spaceId,
          spaceName: existingColumn.space.name,
          columnId,
          columnName: updatedColumn.name,
          previousValue: existingColumn.name,
          newValue: updatedColumn.name,
        },
      });
    }

    if (archiveChanged) {
      await createActivityLog(tx, {
        userId: currentUser.user.id,
        spaceId,
        type: shouldArchive ? "space.column_archive" : "space.column_restore",
        description: `${shouldArchive ? "Archived" : "Restored"} column "${updatedColumn.name}" in "${existingColumn.space.name}"`,
        metadata: {
          spaceId,
          spaceName: existingColumn.space.name,
          columnId,
          columnName: updatedColumn.name,
          previousValue: shouldArchive ? "active" : "archived",
          newValue: shouldArchive ? "archived" : "active",
        },
      });
    }

    return updatedColumn;
  });

  return Response.json(column);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { spaceId, columnId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const existingColumn = await prisma.matrixColumn.findFirst({
    where: { id: columnId, spaceId },
    select: {
      id: true,
      name: true,
      space: { select: { name: true } },
    },
  });

  if (!existingColumn) {
    return Response.json({ error: "Column not found" }, { status: 404 });
  }

  const cells = await prisma.matrixCell.findMany({
    where: { columnId },
    select: {
      textValue: true,
      numberValue: true,
      dateValue: true,
      booleanValue: true,
      statusOptionId: true,
      userIdValue: true,
      notes: true,
      _count: {
        select: {
          noteHistory: true,
        },
      },
    },
  });
  const meaningfulCellCount = cells.filter(hasMeaningfulCellData).length;

  if (meaningfulCellCount > 0) {
    return Response.json(
      {
        error: `Column has ${meaningfulCellCount} card/task ${
          meaningfulCellCount === 1 ? "cell" : "cells"
        } with saved data and cannot be permanently deleted. Move or clear those cells first, or archive the column instead.`,
        meaningfulCellCount,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.matrixColumn.delete({
      where: { id: columnId },
    });

    await createActivityLog(tx, {
      userId: currentUser.user.id,
      spaceId,
      type: "space.column_delete",
      description: `Deleted column "${existingColumn.name}" from "${existingColumn.space.name}"`,
      metadata: {
        spaceId,
        spaceName: existingColumn.space.name,
        columnId,
        columnName: existingColumn.name,
        previousValue: existingColumn.name,
      },
    });
  });

  return new Response(null, { status: 204 });
}
