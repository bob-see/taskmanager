import { prisma } from "@/app/lib/prisma";

type VisibilityUser = {
  id: string;
  role?: string | null;
};

export function isAdminUser(user: VisibilityUser) {
  return user.role === "admin";
}

/**
 * A one-group admin is scoped to that group. Admins with zero or multiple
 * groups retain the existing global-admin behaviour.
 */
export async function getAdminGroupScope(
  user: VisibilityUser
): Promise<string[] | null> {
  if (!isAdminUser(user)) return [];

  const memberships = await prisma.userGroup.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((membership) => membership.groupId);

  return groupIds.length === 1 ? groupIds : null;
}

export async function scopedVisibleUserWhere(currentUser: VisibilityUser) {
  const adminGroupScope = await getAdminGroupScope(currentUser);
  if (isAdminUser(currentUser) && adminGroupScope === null) {
    return {};
  }

  const groupIds =
    adminGroupScope ??
    (await prisma.userGroup.findMany({
      where: { userId: currentUser.id },
      select: { groupId: true },
    })).map((membership) => membership.groupId);

  if (groupIds.length === 0) {
    return {
      id: currentUser.id,
    };
  }

  return {
    OR: [
      { id: currentUser.id },
      {
        groupMemberships: {
          some: {
            groupId: {
              in: groupIds,
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

  const adminGroupScope = await getAdminGroupScope(currentUser);
  if (isAdminUser(currentUser) && adminGroupScope === null) {
    const userCount = await prisma.user.count({
      where: { id: targetUserId },
    });

    return userCount > 0;
  }

  const groupIds =
    adminGroupScope ??
    (await prisma.userGroup.findMany({
      where: { userId: currentUser.id },
      select: { groupId: true },
    })).map((membership) => membership.groupId);

  if (groupIds.length === 0) {
    return false;
  }

  const sharedGroupCount = await prisma.userGroup.count({
    where: {
      userId: targetUserId,
      groupId: {
        in: groupIds,
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
        await scopedVisibleUserWhere(currentUser),
      ],
    },
    select: {
      id: true,
    },
  });

  return new Set(users.map((user) => user.id));
}
