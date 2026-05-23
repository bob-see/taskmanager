import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
  validateStatusOptionColor,
} from "@/app/api/spaces/shared";

type Ctx = {
  params: Promise<{ spaceId: string; columnId: string }>;
};

export async function POST(req: Request, ctx: Ctx) {
  const { spaceId, columnId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const column = await prisma.matrixColumn.findFirst({
    where: { id: columnId, spaceId },
    select: { id: true, type: true },
  });

  if (!column) {
    return Response.json({ error: "Column not found" }, { status: 404 });
  }

  if (column.type !== "status") {
    return Response.json(
      { error: "Status options can only be configured for status columns" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const label = typeof body?.label === "string" ? body.label.trim() : "";

  if (!label) {
    return Response.json({ error: "Label is required" }, { status: 400 });
  }

  const color = validateStatusOptionColor(body?.color ?? "neutral");
  if (color.error) return color.error;

  const option = await prisma.$transaction(async (tx) => {
    const result = await tx.columnStatusOption.aggregate({
      where: { columnId },
      _max: { order: true },
    });

    return tx.columnStatusOption.create({
      data: {
        columnId,
        label,
        color: color.value,
        order: (result._max.order ?? -1) + 1,
      },
    });
  });

  return Response.json(option, { status: 201 });
}
