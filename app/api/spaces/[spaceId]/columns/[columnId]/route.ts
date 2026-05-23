import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
} from "@/app/api/spaces/shared";

type Ctx = {
  params: Promise<{ spaceId: string; columnId: string }>;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { spaceId, columnId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const body = await req.json().catch(() => ({}));
  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasOrder = Object.prototype.hasOwnProperty.call(body, "order");
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!hasName && !hasOrder) {
    return Response.json(
      { error: "At least one supported column field is required" },
      { status: 400 }
    );
  }

  if (hasName && !name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const order = Number(body?.order);
  if (hasOrder && (!Number.isInteger(order) || order < 0)) {
    return Response.json({ error: "Order must be a non-negative integer" }, { status: 400 });
  }

  const existingColumn = await prisma.matrixColumn.findFirst({
    where: { id: columnId, spaceId },
    select: { id: true },
  });

  if (!existingColumn) {
    return Response.json({ error: "Column not found" }, { status: 404 });
  }

  const column = await prisma.matrixColumn.update({
    where: { id: columnId },
    data: {
      ...(hasName ? { name } : {}),
      ...(hasOrder ? { order } : {}),
    },
    include: {
      statusOptions: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
      },
    },
  });

  return Response.json(column);
}
