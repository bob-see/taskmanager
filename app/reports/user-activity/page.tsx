import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { formatActivityType } from "@/app/lib/activity-log";
import { prisma } from "@/app/lib/prisma";
import { ActivityFilters } from "@/app/reports/user-activity/activity-filters";

type SearchParams = Promise<{
  userId?: string;
  period?: string;
  from?: string;
  to?: string;
}>;

type Period = "today" | "week" | "month" | "custom";

const REPORT_TIME_ZONE = "Australia/Brisbane";
const BRISBANE_OFFSET = "+10:00";

const summaryTypes = [
  ["Tasks completed", "task.complete"],
  ["Tasks created", "task.create"],
  ["Tasks deleted", "task.delete"],
  ["Tasks reopened", "task.reopen"],
  ["Priority toggles", "task.priority_toggle"],
  ["Time entries updated", "time_entry.update"],
] as const;

function dateKeyInBrisbane(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function shiftDateKey(value: string, days: number) {
  const parsed = parseDateKey(value);
  if (!parsed) return value;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return date.toISOString().slice(0, 10);
}

function startOfWeekKey(value: string) {
  const parsed = parseDateKey(value);
  if (!parsed) return value;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const day = date.getUTCDay();
  return shiftDateKey(value, day === 0 ? -6 : 1 - day);
}

function normalizePeriod(value: string | undefined): Period {
  return value === "today" || value === "week" || value === "month" || value === "custom"
    ? value
    : "today";
}

function getDateRange(period: Period, fromValue?: string, toValue?: string) {
  const today = dateKeyInBrisbane(new Date());
  let from = today;
  let to = today;

  if (period === "week") {
    from = startOfWeekKey(today);
  } else if (period === "month") {
    from = `${today.slice(0, 7)}-01`;
  } else if (period === "custom") {
    const validFrom = fromValue && parseDateKey(fromValue) ? fromValue : today;
    const validTo = toValue && parseDateKey(toValue) ? toValue : validFrom;
    from = validFrom <= validTo ? validFrom : validTo;
    to = validFrom <= validTo ? validTo : validFrom;
  }

  return {
    from,
    to,
    start: new Date(`${from}T00:00:00${BRISBANE_OFFSET}`),
    end: new Date(`${shiftDateKey(to, 1)}T00:00:00${BRISBANE_OFFSET}`),
  };
}

function formatRangeDate(value: string) {
  const parsed = parseDateKey(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: REPORT_TIME_ZONE,
  }).format(value);
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="tm-card rounded-[12px] border p-4 shadow-sm">
      <p className="text-sm text-[color:var(--tm-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}

function Breakdown({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  const maximum = Math.max(0, ...items.map((item) => item.count));

  return (
    <article className="tm-card rounded-[12px] border p-4 shadow-sm md:p-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--tm-muted)]">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span>{item.label}</span>
                <span className="font-semibold tabular-nums">{item.count}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-slate-700"
                  style={{ width: `${maximum > 0 ? Math.max(3, (item.count / maximum) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function UserActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return notFound();

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (admin?.role !== "admin") return notFound();

  const params = await searchParams;
  const period = normalizePeriod(params.period);
  const range = getDateRange(period, params.from, params.to);

  const users = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });
  const selectedUserId = users.some((user) => user.id === params.userId) ? params.userId! : "";
  const where = {
    ...(selectedUserId ? { userId: selectedUserId } : {}),
    createdAt: { gte: range.start, lt: range.end },
  };

  const [typeGroups, completionLogs, recentLogs] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
      orderBy: { type: "asc" },
    }),
    prisma.activityLog.findMany({
      where: { ...where, type: "task.complete" },
      select: { createdAt: true, projectId: true },
    }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, userId: true, type: true, description: true, createdAt: true },
    }),
  ]);

  const countsByType = new Map(typeGroups.map((group) => [group.type, group._count._all]));
  const userById = new Map(users.map((user) => [user.id, user]));

  const completionByDayMap = new Map<string, number>();
  for (const log of completionLogs) {
    const day = dateKeyInBrisbane(log.createdAt);
    completionByDayMap.set(day, (completionByDayMap.get(day) ?? 0) + 1);
  }
  const completionByDay = Array.from(completionByDayMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, count]) => ({ label: formatRangeDate(day), count }));

  const projectIds = Array.from(
    new Set(completionLogs.flatMap((log) => (log.projectId ? [log.projectId] : [])))
  );
  const projects =
    projectIds.length > 0
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [];
  const projectById = new Map(projects.map((project) => [project.id, project.name]));
  const completionByProjectMap = new Map<string, number>();
  for (const log of completionLogs) {
    const label = log.projectId
      ? projectById.get(log.projectId) ?? "Project no longer available"
      : "No project";
    completionByProjectMap.set(label, (completionByProjectMap.get(label) ?? 0) + 1);
  }
  const completionByProject = Array.from(completionByProjectMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const activityBreakdown = typeGroups
    .map((group) => ({ label: formatActivityType(group.type), count: group._count._all }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const selectedUser = selectedUserId ? userById.get(selectedUserId) : null;

  return (
    <main className="min-h-screen bg-[color:var(--tm-bg)] text-[color:var(--tm-text)]">
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:py-10 xl:px-8 2xl:px-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
            Reports
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">User Activity</h1>
          <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
            Management view of recorded task and time-entry events. The Activity tool remains the raw audit trail.
          </p>
        </div>

        <ActivityFilters
          users={users}
          selectedUserId={selectedUserId}
          selectedPeriod={period}
          customFrom={range.from}
          customTo={range.to}
        />

        <div className="mt-3 rounded-[12px] border border-[color:var(--tm-border)] bg-white/45 px-4 py-3 text-sm text-[color:var(--tm-muted)]">
          User: <span className="font-medium text-[color:var(--tm-text)]">{selectedUser ? `${selectedUser.name} (${selectedUser.email})` : "All users"}</span>
          {" · "}
          Range: <span className="font-medium text-[color:var(--tm-text)]">{formatRangeDate(range.from)} to {formatRangeDate(range.to)}</span>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Summary</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {summaryTypes.map(([label, type]) => (
              <SummaryCard key={type} label={label} value={countsByType.get(type) ?? 0} />
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-3">
          <Breakdown title="Activity breakdown" items={activityBreakdown} emptyLabel="No activity in this period." />
          <Breakdown title="Completion by day" items={completionByDay} emptyLabel="No task completions in this period." />
          <Breakdown title="Completion by project" items={completionByProject} emptyLabel="No task completions in this period." />
        </section>

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">Latest 20 matching ActivityLog records.</p>
          </div>
          <article className="tm-card overflow-hidden rounded-[12px] border shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-[color:var(--tm-muted)]">No activity in this period.</td>
                    </tr>
                  ) : (
                    recentLogs.map((log) => {
                      const user = userById.get(log.userId);
                      return (
                        <tr key={log.id} className="border-b border-[color:var(--tm-border)] last:border-0">
                          <td className="whitespace-nowrap px-4 py-3 text-[color:var(--tm-muted)]">{formatTimestamp(log.createdAt)}</td>
                          <td className="px-4 py-3">{user ? `${user.name} (${user.email})` : log.userId}</td>
                          <td className="px-4 py-3"><span className="tm-chip inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">{formatActivityType(log.type)}</span></td>
                          <td className="px-4 py-3">{log.description}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
