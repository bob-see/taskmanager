export type GroupScopedUser = {
  role?: string | null;
};

export function isAdminUser(user: GroupScopedUser) {
  return user.role === "admin";
}

/**
 * A one-group admin is restricted to that group. A standard user has no
 * admin scope, so their own memberships must be loaded separately.
 */
export function resolveAdminGroupScope(
  user: GroupScopedUser,
  groupIds: string[]
): string[] | null {
  if (!isAdminUser(user)) return null;
  return groupIds.length === 1 ? groupIds : null;
}
