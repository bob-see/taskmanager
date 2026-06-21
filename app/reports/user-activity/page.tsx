import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { formatActivityType } from "@/app/lib/activity-log";
import { prisma } from "@/app/lib/prisma";
import { isMissingDatabaseObjectError } from "@/app/lib/prisma-errors";
import {
  buildSundayCheckInSummary,
  type SundayCheckInSummary,
} from "@/app/lib/routine-support-summary";
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

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function reflectionOptions(value: unknown) {
  return Array.isArray(value)
    ? value.filter((option): option is string => typeof option === "string")
    : [];
}

function RoutineStreaks({
  streaks,
}: {
  streaks: SundayCheckInSummary["routineStreaks"];
}) {
  if (streaks.length === 0) {
    return <p className="text-sm text-[color:var(--tm-muted)]">No routine projects available.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {streaks.map((streak) => (
        <span
          key={streak.projectName}
          className="tm-sunday-streak-chip inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs"
        >
          <span className="font-medium">{streak.projectName}</span>
          <span aria-hidden="true" className="opacity-45">·</span>
          <span className="font-mono font-semibold tabular-nums">{streak.days}d</span>
        </span>
      ))}
    </div>
  );
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

  let routineProfiles: Array<{
    id: string;
    name: string;
    projects: Array<{ id: string; name: string }>;
    tasks: Array<{
      id: string;
      projectId: string | null;
      startDate: Date;
      completedAt: Date | null;
      completedOn: Date | null;
      recurrenceSeriesId: string | null;
      repeatEnabled: boolean;
      repeatPattern: string | null;
      repeatDays: number | null;
      repeatWeeklyDay: number | null;
      repeatMonthlyDay: number | null;
      repeatPaused: boolean;
      repeatPauseUntil: Date | null;
    }>;
  }> = [];

  if (selectedUserId) {
    try {
      routineProfiles = await prisma.profile.findMany({
        where: { userId: selectedUserId, routineSupportEnabled: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          projects: {
            where: { archived: false },
            orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
            select: { id: true, name: true },
          },
          tasks: {
            select: {
              id: true,
              projectId: true,
              startDate: true,
              completedAt: true,
              completedOn: true,
              recurrenceSeriesId: true,
              repeatEnabled: true,
              repeatPattern: true,
              repeatDays: true,
              repeatWeeklyDay: true,
              repeatMonthlyDay: true,
              repeatPaused: true,
              repeatPauseUntil: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isMissingDatabaseObjectError(error, "routineSupportEnabled", ["P2022"])) {
        throw error;
      }
    }
  }

  const today = dateKeyInBrisbane(new Date());
  const currentRoutineSummaries = routineProfiles.map((profile) => ({
    profileId: profile.id,
    profileName: profile.name,
    summary: buildSundayCheckInSummary(
      profile.tasks,
      profile.projects,
      startOfWeekKey(today),
      today
    ),
  }));

  let sundayCheckIns: Array<{
    id: string;
    profileId: string;
    weekStart: Date;
    selectedOptions: unknown;
    reflection: string | null;
    completedAt: Date;
  }> = [];

  if (routineProfiles.length > 0) {
    try {
      sundayCheckIns = await prisma.sundayCheckIn.findMany({
        where: {
          profileId: { in: routineProfiles.map((profile) => profile.id) },
          completedAt: { gte: range.start, lt: range.end },
        },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          profileId: true,
          weekStart: true,
          selectedOptions: true,
          reflection: true,
          completedAt: true,
        },
      });
    } catch (error) {
      if (!isMissingDatabaseObjectError(error, "sundaycheckin", ["P2021"])) {
        throw error;
      }
    }
  }

  const routineProfileById = new Map(routineProfiles.map((profile) => [profile.id, profile]));
  const checkInRows = sundayCheckIns.flatMap((checkIn) => {
    const profile = routineProfileById.get(checkIn.profileId);
    if (!profile) return [];

    const weekStart = dateKey(checkIn.weekStart);
    const weekEnd = shiftDateKey(weekStart, 6);
    return [{
      ...checkIn,
      profileName: profile.name,
      weekStart,
      weekEnd,
      options: reflectionOptions(checkIn.selectedOptions),
      summary: buildSundayCheckInSummary(
        profile.tasks,
        profile.projects,
        weekStart,
        weekEnd
      ),
    }];
  });

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

        {routineProfiles.length > 0 && (
          <section className="mt-6">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
                Routine Support
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Weekly routines and reflections</h2>
              <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                A neutral view of routine continuity and the reflections shared during this period.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <article className="tm-sunday-check-in rounded-[12px] border p-4 shadow-sm md:p-5">
                <h3 className="text-base font-semibold">Current routine streaks</h3>
                <div className="mt-4 space-y-4">
                  {currentRoutineSummaries.map((profile) => (
                    <div key={profile.profileId}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                        {profile.profileName}
                      </div>
                      <RoutineStreaks streaks={profile.summary.routineStreaks} />
                    </div>
                  ))}
                </div>
              </article>

              <div className="space-y-3">
                {checkInRows.length === 0 ? (
                  <article className="tm-card rounded-[12px] border p-4 text-sm text-[color:var(--tm-muted)] shadow-sm md:p-5">
                    No Sunday Check-Ins were completed in this date range.
                  </article>
                ) : (
                  checkInRows.map((checkIn) => (
                    <article key={checkIn.id} className="tm-card rounded-[12px] border p-4 shadow-sm md:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                            {checkIn.profileName}
                          </div>
                          <h3 className="mt-1 text-base font-semibold">
                            Week of {formatRangeDate(checkIn.weekStart)}
                          </h3>
                          <p className="mt-1 text-xs text-[color:var(--tm-muted)]">
                            Checked in {formatTimestamp(checkIn.completedAt)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-[color:var(--tm-muted)]">
                          Through {formatRangeDate(checkIn.weekEnd)}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/55 px-3 py-2.5">
                          <div className="font-mono text-xl font-semibold tabular-nums">{checkIn.summary.completedTasks}</div>
                          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">Tasks completed</div>
                        </div>
                        <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/55 px-3 py-2.5">
                          <div className="text-sm font-semibold">{checkIn.summary.bestCompletionDay?.day ?? "A steady week"}</div>
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                            {checkIn.summary.bestCompletionDay ? `${checkIn.summary.bestCompletionDay.count} completed · best day` : "Best day"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">Routine streaks at week end</div>
                        <RoutineStreaks streaks={checkIn.summary.routineStreaks} />
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">Reflection</div>
                        {checkIn.options.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {checkIn.options.map((option) => (
                              <span key={option} className="tm-chip inline-flex rounded-full border px-2.5 py-1 text-xs">{option}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[color:var(--tm-muted)]">No structured reflection selected.</p>
                        )}
                        {checkIn.reflection && (
                          <p className="mt-3 whitespace-pre-wrap rounded-[10px] border border-[color:var(--tm-border)] bg-white/45 px-3 py-2.5 text-sm leading-6">
                            {checkIn.reflection}
                          </p>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

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
