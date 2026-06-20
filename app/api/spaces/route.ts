import { prisma } from "@/app/lib/prisma";
import { getCurrentUserOr401 } from "@/app/api/spaces/shared";
import { createActivityLog } from "@/app/lib/activity-log";

const spaceSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const spaces = await prisma.collaborativeSpace.findMany({
    where: {
      members: {
        some: {
          userId: currentUser.user.id,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: spaceSelect,
  });

  return Response.json(spaces);
}

export async function POST(req: Request) {
  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const space = await prisma.$transaction(async (tx) => {
    const createdSpace = await tx.collaborativeSpace.create({
      data: {
        name,
        members: {
          create: {
            userId: currentUser.user.id,
            role: "owner",
          },
        },
      },
      select: spaceSelect,
    });

    await createActivityLog(tx, {
      userId: currentUser.user.id,
      spaceId: createdSpace.id,
      type: "space.create",
      description: `Created space "${createdSpace.name}"`,
      metadata: {
        spaceId: createdSpace.id,
        spaceName: createdSpace.name,
      },
    });

    return createdSpace;
  });

  return Response.json(space, { status: 201 });
}
