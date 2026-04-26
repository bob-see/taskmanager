import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { formatActivityType } from "@/app/lib/activity-log";

type SearchParams = Promise<{
  userId?: string;
  type?: string;
}>;

const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
    },
  });

  if (!currentUser) return notFound();

  const resolvedSearchParams = await searchParams;
  const isAdmin = currentUser.role === "admin";
  const selectedUserId = isAdmin ? resolvedSearchParams.userId?.trim() || "" : "";
  const selectedType = isAdmin ? resolvedSearchParams.type?.trim() || "" : "";

  const where = {
    ...(isAdmin && selectedUserId ? { userId: selectedUserId } : {}),
    ...(isAdmin && selectedType ? { type: selectedType } : {}),
    ...(!isAdmin ? { userId: currentUser.id } : {}),
  };

  const [logs, users, types] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    isAdmin
      ? prisma.user.findMany({
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.activityLog.findMany({
          distinct: ["type"],
          orderBy: { type: "asc" },
          select: { type: true },
        })
      : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
            Activity
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Activity Log</h1>
        </div>
        <div className="rounded-full border border-[color:var(--tm-border)] bg-white/70 px-3 py-1 text-sm font-medium">
          {logs.length} latest
        </div>
      </div>

      {isAdmin ? (
        <form className="mt-6 tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">User</div>
              <select name="userId" className={`w-full ${inputClass}`} defaultValue={selectedUserId}>
                <option value="">All users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-[color:var(--tm-muted)]">Type</div>
              <select name="type" className={`w-full ${inputClass}`} defaultValue={selectedType}>
                <option value="">All types</option>
                {types.map((item) => (
                  <option key={item.type} value={item.type}>
                    {formatActivityType(item.type)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" className={buttonClass}>
                Filter
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <section className="mt-6 tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                <th className="px-3 py-2">When</th>
                {isAdmin ? <th className="px-3 py-2">User</th> : null}
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-4 text-[color:var(--tm-muted)]"
                    colSpan={isAdmin ? 4 : 3}
                  >
                    No activity found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const user = userById.get(log.userId);

                  return (
                    <tr key={log.id} className="tm-table-row border-b last:border-0">
                      <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                        {formatCreatedAt(log.createdAt)}
                      </td>
                      {isAdmin ? (
                        <td className="px-3 py-3">
                          {user ? `${user.name} (${user.email})` : log.userId}
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <span className="tm-chip inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                          {formatActivityType(log.type)}
                        </span>
                      </td>
                      <td className="px-3 py-3">{log.description}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
