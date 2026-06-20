import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceMember,
  validateColumnType,
} from "@/app/api/spaces/shared";
import { createActivityLog } from "@/app/lib/activity-log";

type Ctx = {
  params: Promise<{ spaceId: string }>;
};

const defaultStatusOptions = [
  { label: "Not Started", color: "red", order: 0 },
  { label: "In Progress", color: "amber", order: 1 },
  { label: "Complete", color: "green", order: 2 },
];

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

  const type = validateColumnType(body?.type);
  if (type.error) return type.error;

  const column = await prisma.$transaction(async (tx) => {
    const space = await tx.collaborativeSpace.findUniqueOrThrow({
      where: { id: spaceId },
      select: { name: true },
    });
    const result = await tx.matrixColumn.aggregate({
      where: { spaceId, archivedAt: null },
      _max: { order: true },
    });

    const createdColumn = await tx.matrixColumn.create({
      data: {
        spaceId,
        name,
        type: type.value,
        order: (result._max.order ?? -1) + 1,
        ...(type.value === "status"
          ? { statusOptions: { create: defaultStatusOptions } }
          : {}),
      },
      include: {
        statusOptions: {
          orderBy: { order: "asc" },
        },
      },
    });

    await createActivityLog(tx, {
      userId: currentUser.user.id,
      spaceId,
      type: "space.column_create",
      description: `Created column "${createdColumn.name}" in "${space.name}"`,
      metadata: {
        spaceId,
        spaceName: space.name,
        columnId: createdColumn.id,
        columnName: createdColumn.name,
        newValue: createdColumn.name,
      },
    });

    return createdColumn;
  });

  return Response.json(column, { status: 201 });
}
