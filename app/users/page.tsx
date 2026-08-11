import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { getAdminGroupScope } from "@/app/api/users/visibility";

type SearchParams = Promise<{
  error?: string;
  success?: string;
}>;

const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50";
const primaryButtonClass =
  "tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm disabled:opacity-50";

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return null;

  const email = session.user.email;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (user?.role !== "admin") return null;

  return {
    ...user,
    groupIds: (await getAdminGroupScope(user)) ?? [],
  };
}

function isScopedAdmin(admin: Awaited<ReturnType<typeof requireAdmin>>) {
  return Boolean(admin?.groupIds.length);
}

async function ensureUserInAdminScope(
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
  userId: string
) {
  if (!isScopedAdmin(admin)) return;

  const membershipCount = await prisma.userGroup.count({
    where: { userId, groupId: admin.groupIds[0] },
  });
  if (membershipCount === 0) usersRedirect({ error: "forbidden-scope" });
}

function ensureGroupInAdminScope(
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
  groupId: string
) {
  if (isScopedAdmin(admin) && admin.groupIds[0] !== groupId) {
    usersRedirect({ error: "forbidden-scope" });
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: string) {
  return value === "admin" ? "admin" : "user";
}

function readStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function usersRedirect(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  redirect(`/users?${searchParams.toString()}`);
}

function isPrismaError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

async function createUser(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) return notFound();

  const name = readString(formData, "name");
  const email = readString(formData, "email").toLocaleLowerCase();
  const password = readString(formData, "password");
  const role = normalizeRole(readString(formData, "role"));
  const groupId = readString(formData, "groupId");

  if (!name || !email || !password || !groupId) {
    usersRedirect({ error: "missing-create-fields" });
  }

  ensureGroupInAdminScope(admin, groupId);

  const groupExists = await prisma.group.count({ where: { id: groupId } });
  if (groupExists === 0) {
    usersRedirect({ error: "missing-group-id" });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    usersRedirect({ error: "duplicate-email" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        groupMemberships: {
          create: { groupId },
        },
      },
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      usersRedirect({ error: "duplicate-email" });
    }

    throw error;
  }

  revalidatePath("/users");
  usersRedirect({ success: "created" });
}

async function resetPassword(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) return notFound();

  const id = readString(formData, "id");
  const password = readString(formData, "password");

  if (!id || !password) {
    usersRedirect({ error: "missing-reset-fields" });
  }

  await ensureUserInAdminScope(admin, id);

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  revalidatePath("/users");
  usersRedirect({ success: "password-reset" });
}

async function createGroup(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) return notFound();

  if (isScopedAdmin(admin)) usersRedirect({ error: "forbidden-scope" });

  const name = readString(formData, "name");
  const description = readString(formData, "description");

  if (!name) {
    usersRedirect({ error: "missing-group-name" });
  }

  try {
    await prisma.group.create({
      data: {
        name,
        description: description || null,
      },
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      usersRedirect({ error: "duplicate-group" });
    }

    throw error;
  }

  revalidatePath("/users");
  usersRedirect({ success: "group-created" });
}

async function updateGroup(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) return notFound();

  const id = readString(formData, "id");
  const name = readString(formData, "name");
  const description = readString(formData, "description");

  if (!id || !name) {
    usersRedirect({ error: "missing-group-name" });
  }

  ensureGroupInAdminScope(admin, id);

  try {
    await prisma.group.update({
      where: { id },
      data: {
        name,
        description: description || null,
      },
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      usersRedirect({ error: "duplicate-group" });
    }

    throw error;
  }

  revalidatePath("/users");
  usersRedirect({ success: "group-updated" });
}

async function deleteGroup(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) return notFound();

  const id = readString(formData, "id");

  if (!id) {
    usersRedirect({ error: "missing-group-id" });
  }

  if (isScopedAdmin(admin)) usersRedirect({ error: "forbidden-scope" });

  await prisma.group.delete({
    where: { id },
  });

  revalidatePath("/users");
  usersRedirect({ success: "group-deleted" });
}

async function updateUserGroups(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) return notFound();

  const userId = readString(formData, "userId");
  const groupIds = readStringArray(formData, "groupIds");

  if (!userId) {
    usersRedirect({ error: "missing-user-id" });
  }

  await ensureUserInAdminScope(admin, userId);

  if (
    isScopedAdmin(admin) &&
    groupIds.some((groupId) => groupId !== admin.groupIds[0])
  ) {
    usersRedirect({ error: "forbidden-scope" });
  }

  const [userExists, validGroupCount] = await Promise.all([
    prisma.user.count({
      where: { id: userId },
    }),
    groupIds.length > 0
      ? prisma.group.count({
          where: {
            id: {
              in: groupIds,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  if (userExists === 0) {
    usersRedirect({ error: "missing-user-id" });
  }

  if (validGroupCount !== groupIds.length) {
    usersRedirect({ error: "missing-group-id" });
  }

  if (isScopedAdmin(admin)) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (targetUser?.role === "admin" && !groupIds.includes(admin.groupIds[0])) {
      usersRedirect({ error: "forbidden-scope" });
    }
  }

  const membershipWhere = isScopedAdmin(admin)
    ? { userId, groupId: admin.groupIds[0] }
    : { userId };

  await prisma.$transaction([
    prisma.userGroup.deleteMany({ where: membershipWhere }),
    ...(groupIds.length > 0
      ? [
          prisma.userGroup.createMany({
            data: groupIds.map((groupId) => ({ userId, groupId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  revalidatePath("/users");
  usersRedirect({ success: "groups-updated" });
}

function messageFor(error?: string, success?: string) {
  if (error === "duplicate-email") return "A user with that email already exists.";
  if (error === "duplicate-group") return "A group with that name already exists.";
  if (error === "missing-create-fields") return "Name, email, password and a group are required.";
  if (error === "missing-reset-fields") return "Choose a new password before resetting.";
  if (error === "missing-group-name") return "Group name is required.";
  if (error === "missing-group-id") return "Choose a valid group before continuing.";
  if (error === "forbidden-scope") return "You can only manage users and groups in your own group.";
  if (error === "missing-user-id") return "Choose a user before updating groups.";
  if (success === "created") return "User created.";
  if (success === "password-reset") return "Password reset.";
  if (success === "group-created") return "Group created.";
  if (success === "group-updated") return "Group updated.";
  if (success === "group-deleted") return "Group deleted.";
  if (success === "groups-updated") return "User groups updated.";
  return null;
}

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = await requireAdmin();
  if (!admin) return notFound();

  const resolvedSearchParams = await searchParams;
  const message = messageFor(
    resolvedSearchParams.error,
    resolvedSearchParams.success
  );
  const isError = Boolean(resolvedSearchParams.error);

  const scoped = isScopedAdmin(admin);
  const scopedGroupId = scoped ? admin.groupIds[0] : undefined;

  const [users, groups] = await Promise.all([
    prisma.user.findMany({
      where: scopedGroupId
        ? { groupMemberships: { some: { groupId: scopedGroupId } } }
        : undefined,
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        groupMemberships: {
          where: scopedGroupId ? { groupId: scopedGroupId } : undefined,
          include: {
            group: true,
          },
          orderBy: {
            group: {
              name: "asc",
            },
          },
        },
      },
    }),
    prisma.group.findMany({
      where: scopedGroupId ? { id: scopedGroupId } : undefined,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    }),
  ]);

  const usersByGroup = new Map<string, typeof users>();
  const ungroupedUsers: typeof users = [];

  for (const user of users) {
    if (user.groupMemberships.length === 0) {
      ungroupedUsers.push(user);
      continue;
    }

    for (const membership of user.groupMemberships) {
      const groupUsers = usersByGroup.get(membership.groupId) ?? [];
      groupUsers.push(user);
      usersByGroup.set(membership.groupId, groupUsers);
    }
  }

  function userRow(user: (typeof users)[number]) {
    return (
      <div
        key={user.id}
        className="flex flex-col gap-2 border-t border-[color:var(--tm-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span>{user.name}</span>
            <span className="tm-chip inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize">
              {user.role}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-[color:var(--tm-muted)]">
            {user.email} · joined {formatCreatedAt(user.createdAt)}
          </div>
        </div>
        <details className="relative shrink-0 self-start sm:self-auto">
          <summary className="tm-button flex h-8 cursor-pointer list-none items-center rounded-[9px] border px-2.5 text-xs [&::-webkit-details-marker]:hidden">
            Actions
          </summary>
          <div className="tm-menu absolute right-0 top-full z-30 mt-2 w-72 rounded-[10px] border p-3 shadow-xl">
            <form action={updateUserGroups} className="grid gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                Groups
              </div>
              <div className="grid max-h-32 gap-1 overflow-y-auto rounded-[9px] border border-[color:var(--tm-border)] bg-white/35 p-2">
                {groups.map((group) => {
                  const checked = user.groupMemberships.some(
                    (membership) => membership.groupId === group.id
                  );

                  return (
                    <label key={group.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="groupIds"
                        value={group.id}
                        defaultChecked={checked}
                      />
                      <span>{group.name}</span>
                    </label>
                  );
                })}
              </div>
              <button type="submit" className={buttonClass}>
                Update groups
              </button>
            </form>
            <div className="my-3 border-t border-[color:var(--tm-border)]" />
            <form action={resetPassword} className="grid gap-2">
              <input type="hidden" name="id" value={user.id} />
              <label className="grid gap-1 text-xs">
                <span className="text-[color:var(--tm-muted)]">Reset password</span>
                <input
                  name="password"
                  type="password"
                  className={`w-full ${inputClass}`}
                  placeholder="New password"
                  required
                />
              </label>
              <button type="submit" className={buttonClass}>
                Reset password
              </button>
            </form>
          </div>
        </details>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
        </div>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="tm-button-primary flex h-9 cursor-pointer list-none items-center justify-center rounded-[10px] border px-3 text-sm [&::-webkit-details-marker]:hidden">
              <span className="mr-1 text-base leading-none">+</span> Add
            </summary>
            <div className="tm-menu absolute right-0 z-40 mt-2 w-80 rounded-[12px] border p-4 shadow-xl">
              <h2 className="text-base font-semibold tracking-tight">Create user</h2>
              <form action={createUser} className="mt-3 grid gap-3">
                <label className="space-y-1 text-sm">
                  <div className="text-[color:var(--tm-muted)]">Name</div>
                  <input name="name" className={`w-full ${inputClass}`} required />
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-[color:var(--tm-muted)]">Email</div>
                  <input name="email" type="email" className={`w-full ${inputClass}`} required />
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-[color:var(--tm-muted)]">Password</div>
                  <input name="password" type="password" className={`w-full ${inputClass}`} required />
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-[color:var(--tm-muted)]">Group</div>
                  <select name="groupId" className={`w-full ${inputClass}`} required defaultValue="">
                    <option value="" disabled>Choose a group</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-[color:var(--tm-muted)]">Role</div>
                  <select name="role" className={`w-full ${inputClass}`} defaultValue="user">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button type="submit" className={primaryButtonClass}>Create user</button>
              </form>
              <div className="my-4 border-t border-[color:var(--tm-border)]" />
              <h2 className="text-base font-semibold tracking-tight">Create group</h2>
              <p className="mt-1 text-xs text-[color:var(--tm-muted)]">Groups control which users can see and interact with each other.</p>
              <form action={createGroup} className="mt-3 grid gap-3">
                <label className="space-y-1 text-sm">
                  <div className="text-[color:var(--tm-muted)]">Name</div>
                  <input name="name" className={`w-full ${inputClass}`} required />
                </label>
                <label className="space-y-1 text-sm">
                  <div className="text-[color:var(--tm-muted)]">Description</div>
                  <input name="description" className={`w-full ${inputClass}`} />
                </label>
                <button type="submit" className={primaryButtonClass}>Create group</button>
              </form>
            </div>
          </details>
          <div className="rounded-full border border-[color:var(--tm-border)] bg-white/70 px-3 py-1 text-sm font-medium">
          {users.length} {users.length === 1 ? "user" : "users"}
          </div>
        </div>
      </div>

      {message ? (
        <div
          className={`mt-5 rounded-[12px] border px-4 py-3 text-sm ${
            isError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-[color:var(--tm-border)] bg-white/70 text-[color:var(--tm-text)]"
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="mt-6 tm-card overflow-hidden rounded-[14px] border shadow-sm">
        <div className="border-b border-[color:var(--tm-border)] px-4 py-3 md:px-5">
          <h2 className="text-lg font-semibold tracking-tight">Groups</h2>
          <p className="mt-1 text-sm text-[color:var(--tm-muted)]">Expand a group to see its users.</p>
        </div>
        {groups.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[color:var(--tm-muted)]">No groups yet. Use Add to create the first group.</div>
        ) : (
          groups.map((group) => {
            const groupUsers = usersByGroup.get(group.id) ?? [];
            return (
              <details key={group.id} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-white/30 [&::-webkit-details-marker]:hidden md:px-5">
                  <span className="text-xs text-[color:var(--tm-muted)] transition-transform group-open:rotate-90">▶</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{group.name}</span>
                  <span className="hidden truncate text-xs text-[color:var(--tm-muted)] sm:block">{group.description || "No description"}</span>
                  <span className="tm-chip rounded-full border px-2 py-0.5 text-xs">{groupUsers.length}</span>
                  <details className="relative shrink-0">
                    <summary className="tm-button flex h-8 cursor-pointer list-none items-center rounded-[9px] border px-2.5 text-xs [&::-webkit-details-marker]:hidden">Actions</summary>
                    <div className="tm-menu absolute right-0 top-full z-30 mt-2 w-72 rounded-[10px] border p-3 shadow-xl">
                      <form action={updateGroup} className="grid gap-2">
                        <input type="hidden" name="id" value={group.id} />
                        <label className="grid gap-1 text-xs"><span className="text-[color:var(--tm-muted)]">Name</span><input name="name" className={`w-full ${inputClass}`} defaultValue={group.name} required /></label>
                        <label className="grid gap-1 text-xs"><span className="text-[color:var(--tm-muted)]">Description</span><input name="description" className={`w-full ${inputClass}`} defaultValue={group.description ?? ""} /></label>
                        <button type="submit" className={buttonClass}>Save changes</button>
                      </form>
                      <div className="my-3 border-t border-[color:var(--tm-border)]" />
                      <form action={deleteGroup}>
                        <input type="hidden" name="id" value={group.id} />
                        <button type="submit" className={`${buttonClass} w-full text-red-700`}>Delete group</button>
                      </form>
                    </div>
                  </details>
                </summary>
                <div className="bg-white/15 pb-1 pl-4 md:pl-12">
                  {groupUsers.length === 0 ? <div className="border-t border-[color:var(--tm-border)] px-3 py-3 text-xs text-[color:var(--tm-muted)]">No users in this group.</div> : groupUsers.map(userRow)}
                </div>
              </details>
            );
          })
        )}
        {ungroupedUsers.length > 0 ? (
          <details className="group border-t border-[color:var(--tm-border)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden md:px-5">
              <span className="text-xs text-[color:var(--tm-muted)] transition-transform group-open:rotate-90">▶</span>
              <span className="flex-1 text-sm font-semibold">No group</span>
              <span className="tm-chip rounded-full border px-2 py-0.5 text-xs">{ungroupedUsers.length}</span>
            </summary>
            <div className="bg-white/15 pb-1 pl-4 md:pl-12">{ungroupedUsers.map(userRow)}</div>
          </details>
        ) : null}
      </section>
    </main>
  );
}
