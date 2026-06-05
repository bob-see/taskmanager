import { prisma } from "@/app/lib/prisma";

type VisibilityUser = {
  id: string;
  role?: string | null;
};

export function isAdminUser(user: VisibilityUser) {
  return user.role === "admin";
}

export function visibleUserWhere(currentUser: VisibilityUser) {
  if (isAdminUser(currentUser)) {
    return {};
  }

  return {
    OR: [
      { id: currentUser.id },
      {
        groupMemberships: {
          some: {
            group: {
              memberships: {
                some: {
                  userId: currentUser.id,
                },
              },
            },
          },
        },
      },
    ],
  };
}

export async function canSeeUser(currentUser: VisibilityUser, targetUserId: string) {
  if (currentUser.id === targetUserId) {
    return true;
  }

  if (isAdminUser(currentUser)) {
    const userCount = await prisma.user.count({
      where: { id: targetUserId },
    });

    return userCount > 0;
  }

  const sharedGroupCount = await prisma.userGroup.count({
    where: {
      userId: targetUserId,
      group: {
        memberships: {
          some: {
            userId: currentUser.id,
          },
        },
      },
    },
  });

  return sharedGroupCount > 0;
}

export async function visibleUserIds(currentUser: VisibilityUser, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return new Set<string>();
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          id: {
            in: uniqueUserIds,
          },
        },
        visibleUserWhere(currentUser),
      ],
    },
    select: {
      id: true,
    },
  });

  return new Set(users.map((user) => user.id));
}
