import { prisma } from "@/app/lib/prisma";
import {
  effectiveCellType,
  getCurrentUserOr401,
  type MatrixColumnType,
  parseCellValue,
  requireSpaceMember,
  validateColumnType,
} from "@/app/api/spaces/shared";
import { canSeeUser, visibleUserIds } from "@/app/api/users/visibility";

type Ctx = {
  params: Promise<{ spaceId: string }>;
};

type ParsedCellValueData = {
  textValue: string | null;
  numberValue: number | null;
  dateValue: Date | null;
  booleanValue: boolean | null;
  statusOptionId: string | null;
  userIdValue: string | null;
};

function cellValueData(type: MatrixColumnType, data: ParsedCellValueData) {
  if (type === "text") return { textValue: data.textValue };
  if (type === "number") return { numberValue: data.numberValue };
  if (type === "date") return { dateValue: data.dateValue };
  if (type === "checkbox") return { booleanValue: data.booleanValue };
  if (type === "user") return { userIdValue: data.userIdValue };
  return { statusOptionId: data.statusOptionId };
}

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
      select: { id: true, cellTypeOverride: true },
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

  const type = validateColumnType(effectiveCellType(row, column));
  if (type.error) return type.error;

  const data: Record<string, string | number | boolean | Date | null> = {};
  const hasValue = Object.prototype.hasOwnProperty.call(body, "value");
  let parsedValue: ReturnType<typeof parseCellValue> | null = null;

  if (hasValue) {
    parsedValue = parseCellValue(type.value, body?.value);
    if (parsedValue.error) return parsedValue.error;
    Object.assign(data, cellValueData(type.value, parsedValue.data));
  }

  const newNote =
    body?.newNote === undefined
      ? undefined
      : typeof body.newNote === "string"
        ? body.newNote.trim()
        : null;

  if (newNote === null) {
    return Response.json({ error: "newNote must be text" }, { status: 400 });
  }

  if (type.value === "status" && parsedValue?.data.statusOptionId) {
    const statusColumnId =
      column.type === "status"
        ? columnId
        : (
            await prisma.matrixColumn.findFirst({
              where: { spaceId, type: "status" },
              orderBy: [{ order: "asc" }, { id: "asc" }],
              select: { id: true },
            })
          )?.id;

    if (!statusColumnId) {
      return Response.json(
        { error: "No status options are available for this space" },
        { status: 400 }
      );
    }

    const option = await prisma.columnStatusOption.findFirst({
      where: {
        id: parsedValue.data.statusOptionId,
        columnId: statusColumnId,
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

  if (type.value === "user" && parsedValue?.data.userIdValue) {
    if (!(await canSeeUser(currentUser.user, parsedValue.data.userIdValue))) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "assignedUserId")) {
    const assignedUserId =
      body?.assignedUserId === null || body?.assignedUserId === ""
        ? null
        : typeof body?.assignedUserId === "string"
          ? body.assignedUserId
          : undefined;

    if (assignedUserId === undefined) {
      return Response.json(
        { error: "assignedUserId must be a user id or empty" },
        { status: 400 }
      );
    }

    if (assignedUserId) {
      const assignedMember = await prisma.spaceMember.findUnique({
        where: {
          spaceId_userId: {
            spaceId,
            userId: assignedUserId,
          },
        },
        select: { id: true },
      });

      if (!assignedMember) {
        return Response.json(
          { error: "Assigned user must be a member of this space" },
          { status: 400 }
        );
      }
    }

    data.userIdValue = assignedUserId;
  }

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

  if (newNote) {
    await prisma.matrixCellNote.create({
      data: {
        cellId: cell.id,
        userId: currentUser.user.id,
        content: newNote,
      },
    });
  }

  const updatedCell = await prisma.matrixCell.findUniqueOrThrow({
    where: { id: cell.id },
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
    updatedCell.noteHistory.map((note) => note.userId)
  );

  return Response.json({
    ...updatedCell,
    noteHistory: updatedCell.noteHistory.map((note) =>
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
  });
}
