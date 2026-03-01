import { prisma } from "@/app/lib/prisma";

const profileSelect = {
  id: true,
  name: true,
  order: true,
  defaultView: true,
  averageBasis: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  const profiles = await prisma.profile.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: profileSelect,
  });

  return Response.json(profiles);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const profile = await prisma.$transaction(async (tx) => {
    const result = await tx.profile.aggregate({
      _max: { order: true },
    });

    return tx.profile.create({
      data: {
        name,
        order: (result._max.order ?? -1) + 1,
      },
      select: profileSelect,
    });
  });

  return Response.json(profile, { status: 201 });
}
