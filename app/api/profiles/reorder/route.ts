import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  ProfileReorderError,
  requireAuthenticatedProfileUser,
  reorderOwnedProfiles,
  type OwnedProfileReorderStore,
} from "@/app/lib/profile-reorder-core";

const profileSelect = {
  id: true,
  name: true,
  order: true,
  defaultView: true,
  averageBasis: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ReorderedProfile = Prisma.ProfileGetPayload<{
  select: typeof profileSelect;
}>;

export async function POST(req: Request) {
  const currentUser = await requireAuthenticatedProfileUser(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
  });
  if (currentUser.error) return currentUser.error;

  const body = await req.json().catch(() => ({}));

  const store: OwnedProfileReorderStore<ReorderedProfile> = {
    transaction(operation) {
      return prisma.$transaction((tx) =>
        operation({
          listOwnedProfiles(userId) {
            return tx.profile.findMany({
              where: { userId },
              select: { id: true },
            });
          },
          async updateOwnedProfileOrder(userId, profileId, order) {
            const result = await tx.profile.updateMany({
              where: { id: profileId, userId },
              data: { order },
            });
            return result.count === 1;
          },
          listReorderedProfiles(userId) {
            return tx.profile.findMany({
              where: { userId },
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              select: profileSelect,
            });
          },
        })
      );
    },
  };

  try {
    const reorderedProfiles = await reorderOwnedProfiles(
      store,
      currentUser.user.id,
      body?.orderedIds
    );
    return Response.json(reorderedProfiles);
  } catch (error) {
    if (error instanceof ProfileReorderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
