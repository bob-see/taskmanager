import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createActivityLog } from "@/app/lib/activity-log";
import { isMissingDatabaseObjectError } from "@/app/lib/prisma-errors";

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

  const email = session.user.email;

  let profiles;

  try {
    profiles = await prisma.profile.findMany({
      where: {
        user: {
          email,
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { ...profileSelect, routineSupportEnabled: true },
    });
  } catch (error) {
    if (!isMissingDatabaseObjectError(error, "routineSupportEnabled", ["P2022"])) {
      throw error;
    }

    // TODO: Remove this temporary compatibility safeguard after every database
    // has the Profile.routineSupportEnabled column.
    const fallbackProfiles = await prisma.profile.findMany({
      where: {
        user: {
          email,
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: profileSelect,
    });
    profiles = fallbackProfiles.map((profile) => ({
      ...profile,
      routineSupportEnabled: false,
    }));
  }

  return Response.json(profiles);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const profile = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Authenticated user not found");
    }

    const result = await tx.profile.aggregate({
      where: {
        user: {
          email,
        },
      },
      _max: { order: true },
    });

    const createdProfile = await tx.profile.create({
      data: {
        name,
        order: (result._max.order ?? -1) + 1,
        user: {
          connect: {
            email,
          },
        },
      },
      select: {
        ...profileSelect,
      },
    });

    await createActivityLog(tx, {
      userId: user.id,
      profileId: createdProfile.id,
      type: "profile.create",
      description: `Created profile "${createdProfile.name}"`,
    });

    return createdProfile;
  });

  return Response.json(profile, { status: 201 });
}
