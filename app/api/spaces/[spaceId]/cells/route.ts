import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  parseCellValue,
  requireSpaceMember,
  validateColumnType,
} from "@/app/api/spaces/shared";

type Ctx = {
  params: Promise<{ spaceId: string }>;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { spaceId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const body = await req.json().catch(() => ({}));
  const rowId = typeof body?.rowId === "string" ? body.rowId : "";
  const columnId = typeof body?.columnId === "string" ? body.columnId : "";

  if (!rowId) {
    return Response.json({ error: "rowId is required" }, { status: 400 });
  }

  if (!columnId) {
    return Response.json({ error: "columnId is required" }, { status: 400 });
  }

  const [row, column] = await Promise.all([
    prisma.matrixRow.findFirst({
      where: { id: rowId, spaceId },
      select: { id: true },
    }),
    prisma.matrixColumn.findFirst({
      where: { id: columnId, spaceId },
      select: { id: true, type: true },
    }),
  ]);

  if (!row || !column) {
    return Response.json(
      { error: "Row and column must belong to this space" },
      { status: 400 }
    );
  }

  const type = validateColumnType(column.type);
  if (type.error) return type.error;

  const value = parseCellValue(type.value, body?.value);
  if (value.error) return value.error;

  const notes =
    body?.notes === undefined || body?.notes === null
      ? undefined
      : typeof body.notes === "string"
        ? body.notes
        : null;

  if (notes === null) {
    return Response.json({ error: "notes must be text" }, { status: 400 });
  }

  if (type.value === "status" && value.data.statusOptionId) {
    const option = await prisma.columnStatusOption.findFirst({
      where: {
        id: value.data.statusOptionId,
        columnId,
      },
      select: { id: true },
    });

    if (!option) {
      return Response.json(
        { error: "Status option not found" },
        { status: 404 }
      );
    }
  }

  if (type.value === "user" && value.data.userIdValue) {
    const user = await prisma.user.findUnique({
      where: { id: value.data.userIdValue },
      select: { id: true },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
  }

  const data = {
    ...value.data,
    ...(notes !== undefined ? { notes } : {}),
  };

  const cell = await prisma.matrixCell.upsert({
    where: {
      rowId_columnId: {
        rowId,
        columnId,
      },
    },
    create: {
      rowId,
      columnId,
      ...data,
    },
    update: data,
  });

  return Response.json(cell);
}
