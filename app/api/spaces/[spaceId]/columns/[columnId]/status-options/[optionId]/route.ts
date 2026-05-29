import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
  validateStatusOptionColor,
} from "@/app/api/spaces/shared";

type Ctx = {
  params: Promise<{ spaceId: string; columnId: string; optionId: string }>;
};

async function getStatusColumn(spaceId: string, columnId: string) {
  const column = await prisma.matrixColumn.findFirst({
    where: { id: columnId, spaceId },
    select: { id: true, type: true },
  });

  if (!column) {
    return {
      error: Response.json({ error: "Column not found" }, { status: 404 }),
    };
  }

  if (column.type !== "status") {
    return {
      error: Response.json(
        { error: "Status options can only be configured for status columns" },
        { status: 400 }
      ),
    };
  }

  return { column };
}

async function getStatusOption(columnId: string, optionId: string) {
  const option = await prisma.columnStatusOption.findFirst({
    where: { id: optionId, columnId },
    select: { id: true },
  });

  if (!option) {
    return {
      error: Response.json({ error: "Status option not found" }, { status: 404 }),
    };
  }

  return { option };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { spaceId, columnId, optionId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const column = await getStatusColumn(spaceId, columnId);
  if (column.error) return column.error;

  const existingOption = await getStatusOption(columnId, optionId);
  if (existingOption.error) return existingOption.error;

  const body = await req.json().catch(() => ({}));
  const label = typeof body?.label === "string" ? body.label.trim() : "";

  if (!label) {
    return Response.json({ error: "Label is required" }, { status: 400 });
  }

  const color = validateStatusOptionColor(body?.color);
  if (color.error) return color.error;

  const option = await prisma.columnStatusOption.update({
    where: { id: optionId },
    data: {
      label,
      color: color.value,
    },
  });

  return Response.json(option);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { spaceId, columnId, optionId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const column = await getStatusColumn(spaceId, columnId);
  if (column.error) return column.error;

  const existingOption = await getStatusOption(columnId, optionId);
  if (existingOption.error) return existingOption.error;

  const cellCount = await prisma.matrixCell.count({
    where: {
      statusOptionId: optionId,
    },
  });

  if (cellCount > 0) {
    return Response.json(
      { error: "Status option is in use and cannot be deleted" },
      { status: 409 }
    );
  }

  await prisma.columnStatusOption.delete({
    where: { id: optionId },
  });

  return new Response(null, { status: 204 });
}
