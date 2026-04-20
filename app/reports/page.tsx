import { prisma } from "@/app/lib/prisma";
import { toDateOnly } from "@/app/timesheets/timesheet-utils";
import { ReportsClient } from "@/app/reports/reports-client";
import {
  formatBestPeriodLabel,
  getCompletedTaskDetails,
  getBestEfficiencyPeriods,
  getBestTaskPeriods,
  getBestTimePeriods,
  getProductivityReport,
  getProfileComparisons,
  getTimeReport,
  normalizeSelectedDate,
  shiftSelectedDate,
  type ReportPeriod,
  type ReportTask,
  type ReportTimeEntry,
} from "@/app/reports/reporting-utils";

type SearchParams = Promise<{
  scope?: string;
  period?: string;
  date?: string;
}>;

function normalizePeriod(value: string | undefined): ReportPeriod {
  return value === "day" || value === "week" || value === "month" ? value : "week";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const profiles = await prisma.profile.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });

  const selectedScope =
    resolvedSearchParams.scope && profiles.some((profile) => profile.id === resolvedSearchParams.scope)
      ? resolvedSearchParams.scope
      : "overview";
  const selectedPeriod = normalizePeriod(resolvedSearchParams.period);
  const selectedDate = normalizeSelectedDate(resolvedSearchParams.date);
  const whereProfile = selectedScope === "overview" ? {} : { profileId: selectedScope };

  const [tasks, timeEntries] = await Promise.all([
    prisma.task.findMany({
      where: whereProfile,
      select: {
        profileId: true,
        createdAt: true,
        id: true,
        title: true,
        notes: true,
        startDate: true,
        dueAt: true,
        completedAt: true,
        completedOn: true,
        category: true,
        projectId: true,
        profile: {
          select: {
            name: true,
          },
        },
        project: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        ...whereProfile,
        endTime: {
          not: null,
        },
      },
      select: {
        profileId: true,
        entryDate: true,
        loggedMinutes: true,
        profile: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const reportTasks: ReportTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    notes: task.notes,
    profileId: task.profileId,
    profileName: task.profile.name,
    projectName: task.project?.name ?? null,
    startDate: toDateOnly(task.startDate),
    dueAt: task.dueAt ? toDateOnly(task.dueAt) : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    completedOn: task.completedOn ? toDateOnly(task.completedOn) : null,
    createdAt: toDateOnly(task.createdAt),
    category: task.category,
    projectId: task.projectId,
  }));

  const reportTimeEntries: ReportTimeEntry[] = timeEntries.map((entry) => ({
    profileId: entry.profileId,
    profileName: entry.profile.name,
    entryDate: toDateOnly(entry.entryDate),
    loggedMinutes: entry.loggedMinutes ?? 0,
  }));

  const productivity = getProductivityReport(reportTasks, selectedDate, selectedPeriod);
  const time = getTimeReport(reportTimeEntries, selectedDate, selectedPeriod);
  const tasksPerHour =
    time.totalMinutes > 0 ? productivity.completedCount / (time.totalMinutes / 60) : null;
  const hoursPerTask =
    productivity.completedCount > 0 ? time.totalMinutes / 60 / productivity.completedCount : null;
  const profileComparisons = getProfileComparisons(
    profiles,
    reportTasks,
    reportTimeEntries,
    selectedDate,
    selectedPeriod
  );

  const scopeLabel =
    selectedScope === "overview"
      ? "Overview"
      : profiles.find((profile) => profile.id === selectedScope)?.name ?? "Profile";

  return (
    <ReportsClient
      profiles={profiles}
      selectedScope={selectedScope}
      selectedPeriod={selectedPeriod}
      selectedDate={selectedDate}
      scopeLabel={scopeLabel}
      periodLabel={formatBestPeriodLabel(
        selectedPeriod === "month" ? selectedDate.slice(0, 7) : selectedDate,
        selectedPeriod === "month" ? "month-key" : selectedPeriod
      )}
      productivity={productivity}
      time={time}
      efficiency={{
        tasksPerHour,
        hoursPerTask,
      }}
      completedTaskDetails={getCompletedTaskDetails(reportTasks, selectedDate, selectedPeriod)}
      profileComparisons={profileComparisons}
      bestTaskPeriods={getBestTaskPeriods(reportTasks)}
      bestTimePeriods={getBestTimePeriods(reportTimeEntries)}
      bestEfficiencyPeriods={getBestEfficiencyPeriods(reportTasks, reportTimeEntries)}
      previousDate={shiftSelectedDate(selectedDate, selectedPeriod, -1)}
      nextDate={shiftSelectedDate(selectedDate, selectedPeriod, 1)}
    />
  );
}
