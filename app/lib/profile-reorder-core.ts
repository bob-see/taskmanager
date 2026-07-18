export type OwnedProfileOrderRow = {
  id: string;
};

export type OwnedProfileReorderTransaction<Result> = {
  listOwnedProfiles(userId: string): Promise<OwnedProfileOrderRow[]>;
  updateOwnedProfileOrder(
    userId: string,
    profileId: string,
    order: number
  ): Promise<boolean>;
  listReorderedProfiles(userId: string): Promise<Result[]>;
};

export type OwnedProfileReorderStore<Result> = {
  transaction<T>(
    operation: (tx: OwnedProfileReorderTransaction<Result>) => Promise<T>
  ): Promise<T>;
};

export class ProfileReorderError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProfileReorderError";
    this.status = status;
  }
}

export async function requireAuthenticatedProfileUser<User>(
  getCurrentUser: () => Promise<User | null>
) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

export function parseProfileReorderIds(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((id) => typeof id !== "string" || !id.trim())
  ) {
    throw new ProfileReorderError(
      "orderedIds must be a non-empty string array",
      400
    );
  }

  if (new Set(value).size !== value.length) {
    throw new ProfileReorderError(
      "orderedIds must not contain duplicates",
      400
    );
  }

  return value as string[];
}

export async function reorderOwnedProfiles<Result>(
  store: OwnedProfileReorderStore<Result>,
  userId: string,
  value: unknown
) {
  const orderedIds = parseProfileReorderIds(value);

  return store.transaction(async (tx) => {
    const ownedProfiles = await tx.listOwnedProfiles(userId);
    const ownedIds = new Set(ownedProfiles.map((profile) => profile.id));

    if (
      ownedProfiles.length !== orderedIds.length ||
      orderedIds.some((id) => !ownedIds.has(id))
    ) {
      throw new ProfileReorderError(
        "orderedIds must include every accessible profile exactly once",
        400
      );
    }

    for (const [order, profileId] of orderedIds.entries()) {
      const updated = await tx.updateOwnedProfileOrder(
        userId,
        profileId,
        order
      );
      if (!updated) {
        throw new ProfileReorderError(
          "Profile ordering changed; reload and try again",
          409
        );
      }
    }

    return tx.listReorderedProfiles(userId);
  });
}
