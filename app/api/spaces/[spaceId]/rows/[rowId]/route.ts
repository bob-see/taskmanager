import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
  validateRowCellTypeOverride,
} from "@/app/api/spaces/shared";

type Ctx = {
  params: Promise<{ spaceId: string; rowId: string }>;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { spaceId, rowId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const body = await req.json().catch(() => ({}));
  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasOrder = Object.prototype.hasOwnProperty.call(body, "order");
  const hasIsDone = Object.prototype.hasOwnProperty.call(body, "isDone");
  const hasDoneAt = Object.prototype.hasOwnProperty.call(body, "doneAt");
  const hasCellTypeOverride = Object.prototype.hasOwnProperty.call(
    body,
    "cellTypeOverride"
  );

  if (!hasName && !hasOrder && !hasIsDone && !hasDoneAt && !hasCellTypeOverride) {
    return Response.json(
      { error: "At least one supported row field is required" },
      { status: 400 }
    );
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (hasName && !name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const order = Number(body?.order);
  if (hasOrder && (!Number.isInteger(order) || order < 0)) {
    return Response.json(
      { error: "Order must be a non-negative integer" },
      { status: 400 }
    );
  }

  if (hasIsDone && typeof body?.isDone !== "boolean") {
    return Response.json({ error: "isDone must be a boolean" }, { status: 400 });
  }

  let doneAt: Date | null | undefined;
  if (hasDoneAt) {
    if (body?.doneAt === null || body?.doneAt === "") {
      doneAt = null;
    } else if (typeof body?.doneAt === "string") {
      const parsedDoneAt = new Date(body.doneAt);
      if (Number.isNaN(parsedDoneAt.getTime())) {
        return Response.json({ error: "doneAt must be a valid date" }, { status: 400 });
      }
      doneAt = parsedDoneAt;
    } else {
      return Response.json(
        { error: "doneAt must be a valid date or null" },
        { status: 400 }
      );
    }
  }

  const cellTypeOverride = hasCellTypeOverride
    ? validateRowCellTypeOverride(body?.cellTypeOverride)
    : null;
  if (cellTypeOverride?.error) return cellTypeOverride.error;

  const existingRow = await prisma.matrixRow.findFirst({
    where: { id: rowId, spaceId },
    select: { id: true },
  });

  if (!existingRow) {
    return Response.json({ error: "Row not found" }, { status: 404 });
  }

  const row = await prisma.matrixRow.update({
    where: { id: rowId },
    data: {
      ...(hasName ? { name } : {}),
      ...(hasOrder ? { order } : {}),
      ...(hasIsDone
        ? {
            isDone: body.isDone,
            doneAt: body.isDone ? (doneAt ?? new Date()) : null,
          }
        : hasDoneAt
          ? { doneAt }
          : {}),
      ...(hasCellTypeOverride
        ? { cellTypeOverride: cellTypeOverride?.value ?? null }
        : {}),
    },
  });

  return Response.json(row);
}
