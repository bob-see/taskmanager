import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.profile.findMany({
    where: {
      user: {
        email: session.user.email,
      },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: profileSelect,
  });

  return Response.json(profiles);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const profile = await prisma.$transaction(async (tx) => {
    const result = await tx.profile.aggregate({
      where: {
        user: {
          email: session.user.email,
        },
      },
      _max: { order: true },
    });

    return tx.profile.create({
      data: {
        name,
        order: (result._max.order ?? -1) + 1,
        user: {
          connect: {
            email: session.user.email,
          },
        },
      },
      select: profileSelect,
    });
  });

  return Response.json(profile, { status: 201 });
}
