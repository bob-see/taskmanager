import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";

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

  return user?.role === "admin" ? user : null;
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

  if (!name || !email || !password) {
    usersRedirect({ error: "missing-create-fields" });
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

  await prisma.$transaction([
    prisma.userGroup.deleteMany({
      where: { userId },
    }),
    ...(groupIds.length > 0
      ? [
          prisma.userGroup.createMany({
            data: groupIds.map((groupId) => ({
              userId,
              groupId,
            })),
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
  if (error === "missing-create-fields") return "Name, email and password are required.";
  if (error === "missing-reset-fields") return "Choose a new password before resetting.";
  if (error === "missing-group-name") return "Group name is required.";
  if (error === "missing-group-id") return "Choose a group before deleting.";
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

  const [users, groups] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        groupMemberships: {
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
        </div>
        <div className="rounded-full border border-[color:var(--tm-border)] bg-white/70 px-3 py-1 text-sm font-medium">
          {users.length} {users.length === 1 ? "user" : "users"}
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

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <article className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
          <h2 className="text-lg font-semibold tracking-tight">Create user</h2>
          <form action={createUser} className="mt-4 grid gap-3">
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">Name</div>
              <input name="name" className={`w-full ${inputClass}`} required />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">Email</div>
              <input
                name="email"
                type="email"
                className={`w-full ${inputClass}`}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">Password</div>
              <input
                name="password"
                type="password"
                className={`w-full ${inputClass}`}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">Role</div>
              <select name="role" className={`w-full ${inputClass}`} defaultValue="user">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="flex justify-end">
              <button type="submit" className={primaryButtonClass}>
                Create user
              </button>
            </div>
          </form>
        </article>

        <article className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
          <h2 className="text-lg font-semibold tracking-tight">Create group</h2>
          <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
            Groups control which users can see and interact with each other.
          </p>
          <form action={createGroup} className="mt-4 grid gap-3">
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">Name</div>
              <input name="name" className={`w-full ${inputClass}`} required />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">Description</div>
              <input name="description" className={`w-full ${inputClass}`} />
            </label>
            <div className="flex justify-end">
              <button type="submit" className={primaryButtonClass}>
                Create group
              </button>
            </div>
          </form>
        </article>

        <section className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Groups</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Users</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-[color:var(--tm-muted)]" colSpan={4}>
                      No groups yet.
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => (
                    <tr key={group.id} className="tm-table-row border-b last:border-0">
                      <td className="px-3 py-3">
                        <form action={updateGroup} className="grid gap-2">
                          <input type="hidden" name="id" value={group.id} />
                          <input
                            name="name"
                            className={`w-full ${inputClass}`}
                            defaultValue={group.name}
                            required
                          />
                          <input
                            name="description"
                            className={`w-full ${inputClass}`}
                            defaultValue={group.description ?? ""}
                            placeholder="Description"
                          />
                          <button type="submit" className={buttonClass}>
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                        {group.description || "No description"}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                        {group._count.memberships}
                      </td>
                      <td className="px-3 py-3">
                        <form action={deleteGroup}>
                          <input type="hidden" name="id" value={group.id} />
                          <button type="submit" className={buttonClass}>
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Existing users</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Groups</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Reset password</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="tm-table-row border-b last:border-0"
                  >
                    <td className="px-3 py-3 font-medium">{user.name}</td>
                    <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                      {user.email}
                    </td>
                    <td className="px-3 py-3">
                      <span className="tm-chip inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <form action={updateUserGroups} className="grid gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="grid max-h-32 gap-1 overflow-y-auto rounded-[10px] border border-[color:var(--tm-border)] bg-white/35 p-2">
                          {groups.length === 0 ? (
                            <span className="text-xs text-[color:var(--tm-muted)]">
                              Create a group first.
                            </span>
                          ) : (
                            groups.map((group) => {
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
                            })
                          )}
                        </div>
                        <button type="submit" className={buttonClass}>
                          Update groups
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                      {formatCreatedAt(user.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <form action={resetPassword} className="flex gap-2">
                        <input type="hidden" name="id" value={user.id} />
                        <input
                          name="password"
                          type="password"
                          className={`w-44 ${inputClass}`}
                          placeholder="New password"
                          required
                        />
                        <button type="submit" className={buttonClass}>
                          Reset
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
