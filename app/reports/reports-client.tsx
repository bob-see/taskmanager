"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  formatBestPeriodLabel,
  formatEfficiency,
  formatHoursFromMinutes,
  type BreakdownItem,
  type ReportPeriod,
  type TaskDetailReportItem,
  type TaskDetailStatusScope,
  type TimeBreakdownItem,
} from "@/app/reports/reporting-utils";

type ReportProfile = {
  id: string;
  name: string;
};

type ReportsClientProps = {
  profiles: ReportProfile[];
  selectedScope: string;
  selectedPeriod: ReportPeriod;
  selectedDate: string;
  scopeLabel: string;
  periodLabel: string;
  productivity: {
    completedCount: number;
    createdCount: number;
    openTasks: number;
    overdueTasks: number;
    backlogCount: number;
    averagePerDay: number | null;
    topProjects: BreakdownItem[];
    topCategories: BreakdownItem[];
  };
  time: {
    totalMinutes: number;
    averagePerDay: number | null;
    loggedDayCount: number | null;
    breakdown: TimeBreakdownItem[];
  };
  efficiency: {
    tasksPerHour: number | null;
    hoursPerTask: number | null;
  };
  taskDetailReport: TaskDetailReportItem[];
  profileComparisons: Array<{
    profileId: string;
    label: string;
    completed: number;
    minutes: number;
    tasksPerHour: number | null;
  }>;
  bestTaskPeriods: {
    bestDay: { key: string; value: number } | null;
    bestWeek: { key: string; value: number } | null;
    bestMonth: { key: string; value: number } | null;
  };
  bestTimePeriods: {
    bestDay: { key: string; value: number } | null;
    bestWeek: { key: string; value: number } | null;
    bestMonth: { key: string; value: number } | null;
  };
  bestEfficiencyPeriods: {
    bestDay: { key: string; completed: number; minutes: number } | null;
    bestWeek: { key: string; completed: number; minutes: number } | null;
    bestMonth: { key: string; completed: number; minutes: number } | null;
  };
  previousDate: string;
  nextDate: string;
};

const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";
const segmentClass = "tm-tabset inline-flex rounded-full border p-1 text-sm";
const segmentButtonClass = "tm-tab rounded-full px-3 py-1.5";
const segmentButtonActiveClass = "tm-tab-active rounded-full px-3 py-1.5";

const taskDetailStatusOptions: Array<{ value: TaskDetailStatusScope; label: string }> = [
  { value: "completed", label: "Completed tasks" },
  { value: "incomplete-with-notes", label: "Incomplete tasks with notes" },
  { value: "both", label: "Both" },
];

function formatDailyReportDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildDailyReportText(input: {
  scopeLabel: string;
  selectedDate: string;
  taskDetails: TaskDetailReportItem[];
  statusScope: TaskDetailStatusScope;
  totalMinutes: number;
}) {
  const completedTasks = input.taskDetails.filter((task) => task.status === "completed");
  const incompleteTasks = input.taskDetails.filter((task) => task.status === "incomplete");
  const lines = [
    "Daily Report",
    `Scope: ${input.scopeLabel}`,
    `Date: ${formatDailyReportDate(input.selectedDate)}`,
    "",
    `Completed tasks: ${completedTasks.length}`,
  ];

  if (input.statusScope !== "completed") {
    lines.push(`Incomplete tasks with notes: ${incompleteTasks.length}`);
  }

  if (input.totalMinutes > 0) {
    lines.push(`Logged hours: ${formatHoursFromMinutes(input.totalMinutes)}`);
  }

  if (input.taskDetails.length === 0) {
    lines.push(
      input.statusScope === "incomplete-with-notes"
        ? "No incomplete tasks with notes were updated on this day."
        : input.statusScope === "both"
          ? "No completed tasks or incomplete tasks with notes were found for this day."
          : "No tasks were completed on this day."
    );
    return lines.join("\n");
  }

  function pushTask(task: TaskDetailReportItem, index: number) {
    lines.push(`${index + 1}. ${task.title}`);
    lines.push(`   Status: ${task.status === "completed" ? "Completed" : "Incomplete"}`);
    lines.push(`   Profile: ${task.profileName}`);
    lines.push(`   Project: ${task.projectName?.trim() || "Unassigned"}`);
    lines.push(`   Category: ${task.category?.trim() || "Uncategorized"}`);
    if (task.startDate) {
      lines.push(`   Start: ${task.startDate}`);
    }
    if (task.dueAt) {
      lines.push(`   Due: ${task.dueAt}`);
    }
    if (task.status === "completed" && task.completedOn) {
      lines.push(`   Completed: ${task.completedOn}`);
    }
    if (task.notes) {
      lines.push(`   Notes: ${task.notes}`);
    }
    lines.push("");
  }

  if (input.statusScope === "both") {
    if (completedTasks.length > 0) {
      lines.push("", `Completed tasks (${completedTasks.length})`);
      completedTasks.forEach(pushTask);
    }
    if (incompleteTasks.length > 0) {
      lines.push("", `Incomplete tasks with notes (${incompleteTasks.length})`);
      incompleteTasks.forEach(pushTask);
    }
  } else {
    lines.push("");
    input.taskDetails.forEach(pushTask);
  }

  return lines.join("\n").trimEnd();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDailyReportHTML(input: {
  scopeLabel: string;
  selectedDate: string;
  taskDetails: TaskDetailReportItem[];
  statusScope: TaskDetailStatusScope;
  totalMinutes: number;
}) {
  const completedTasks = input.taskDetails.filter((task) => task.status === "completed");
  const incompleteTasks = input.taskDetails.filter((task) => task.status === "incomplete");
  const header = `<p><strong>Daily Report</strong></p>`;
  const scopeBlock = `<p>Scope: ${escapeHtml(input.scopeLabel)}<br/>Date: ${escapeHtml(
    formatDailyReportDate(input.selectedDate)
  )}</p>`;

  const summaryLines = [
    `<strong>Completed tasks:</strong> ${completedTasks.length}`,
  ];

  if (input.statusScope !== "completed") {
    summaryLines.push(`<strong>Incomplete tasks with notes:</strong> ${incompleteTasks.length}`);
  }

  if (input.totalMinutes > 0) {
    summaryLines.push(
      `<strong>Logged hours:</strong> ${escapeHtml(formatHoursFromMinutes(input.totalMinutes))}`
    );
  }

  const summaryBlock = `<p>${summaryLines.join("<br/>")}</p>`;

  if (input.taskDetails.length === 0) {
    const emptyMessage =
      input.statusScope === "incomplete-with-notes"
        ? "No incomplete tasks with notes were updated on this day."
        : input.statusScope === "both"
          ? "No completed tasks or incomplete tasks with notes were found for this day."
          : "No tasks were completed on this day.";
    return `${header}${scopeBlock}${summaryBlock}<p>${escapeHtml(emptyMessage)}</p>`;
  }

  function buildTaskList(tasks: TaskDetailReportItem[]) {
    const items = tasks
    .map((task) => {
      const lines = [
        `<strong>${escapeHtml(task.title)}</strong>`,
        `Status: ${task.status === "completed" ? "Completed" : "Incomplete"}`,
        `Profile: ${escapeHtml(task.profileName)}`,
        `Project: ${escapeHtml(task.projectName?.trim() || "Unassigned")}`,
        `Category: ${escapeHtml(task.category?.trim() || "Uncategorized")}`,
      ];

      if (task.startDate) {
        lines.push(`Start: ${escapeHtml(task.startDate)}`);
      }
      if (task.dueAt) {
        lines.push(`Due: ${escapeHtml(task.dueAt)}`);
      }
      if (task.status === "completed" && task.completedOn) {
        lines.push(`Completed: ${escapeHtml(task.completedOn)}`);
      }
      if (task.notes) {
        lines.push(`Notes: ${escapeHtml(task.notes)}`);
      }

      return `<li>${lines.join("<br/>")}</li>`;
    })
    .join("");

    return `<ol>${items}</ol>`;
  }

  if (input.statusScope === "both") {
    const completedBlock =
      completedTasks.length > 0
        ? `<p><strong>Completed tasks (${completedTasks.length})</strong></p>${buildTaskList(completedTasks)}`
        : "";
    const incompleteBlock =
      incompleteTasks.length > 0
        ? `<p><strong>Incomplete tasks with notes (${incompleteTasks.length})</strong></p>${buildTaskList(incompleteTasks)}`
        : "";
    return `${header}${scopeBlock}${summaryBlock}${completedBlock}${incompleteBlock}`;
  }

  return `${header}${scopeBlock}${summaryBlock}${buildTaskList(input.taskDetails)}`;
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <article className="tm-card rounded-[12px] border p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {description && (
        <div className="mt-1 text-sm text-[color:var(--tm-muted)]">{description}</div>
      )}
    </article>
  );
}

function BreakdownList({
  title,
  items,
  formatter,
  emptyLabel,
}: {
  title: string;
  items: Array<{ label: string; count?: number; minutes?: number }>;
  formatter?: (item: { label: string; count?: number; minutes?: number }) => string;
  emptyLabel: string;
}) {
  return (
    <article className="tm-card rounded-[12px] border p-4 shadow-sm">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[color:var(--tm-muted)]">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-[color:var(--tm-border)] bg-white/40 px-3 py-2"
            >
              <span className="text-sm">{item.label}</span>
              <span className="text-sm font-medium">
                {formatter
                  ? formatter(item)
                  : typeof item.count === "number"
                    ? `${item.count}`
                    : formatHoursFromMinutes(item.minutes ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function InsightBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <article className="tm-card rounded-[12px] border p-4 shadow-sm">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/40 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
              {item.label}
            </div>
            <div className="mt-1 text-sm font-medium">{item.value}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function TaskDetailCard({ task }: { task: TaskDetailReportItem }) {
  return (
    <div className="rounded-[12px] border border-[color:var(--tm-border)] bg-white/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{task.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--tm-muted)]">
            <span className="tm-chip rounded-full border px-2 py-0.5">
              {task.profileName}
            </span>
            <span className="tm-chip rounded-full border px-2 py-0.5">
              {task.projectName?.trim() || "Unassigned project"}
            </span>
            <span className="tm-chip rounded-full border px-2 py-0.5">
              {task.category?.trim() || "Uncategorized"}
            </span>
            <span className="tm-chip rounded-full border px-2 py-0.5">
              {task.status === "completed" ? "Completed" : "Incomplete"}
            </span>
          </div>
        </div>
        <div className="text-sm text-[color:var(--tm-muted)]">
          {task.status === "completed" ? "Completed" : "Updated"}{" "}
          <span className="font-medium text-[color:var(--tm-text)]">
            {task.status === "completed" && task.completedAt
              ? new Date(task.completedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : task.activityDate}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-[color:var(--tm-muted)] md:grid-cols-3">
        <div>
          <span className="font-medium text-[color:var(--tm-text)]">Start:</span>{" "}
          {task.startDate || "—"}
        </div>
        <div>
          <span className="font-medium text-[color:var(--tm-text)]">Due:</span>{" "}
          {task.dueAt || "—"}
        </div>
        <div>
          <span className="font-medium text-[color:var(--tm-text)]">Completed:</span>{" "}
          {task.completedOn || "—"}
        </div>
      </div>

      {task.notes && (
        <div className="mt-3 rounded-[10px] border border-[color:var(--tm-border)] bg-[color:var(--tm-card)]/65 px-3 py-2 text-sm leading-6 text-[color:var(--tm-text)]">
          {task.notes}
        </div>
      )}
    </div>
  );
}

export function ReportsClient(props: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [taskDetailStatusScope, setTaskDetailStatusScope] =
    useState<TaskDetailStatusScope>("completed");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  function updateQuery(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function getMonthInputValue(dateValue: string) {
    return dateValue.slice(0, 7);
  }

  const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ];
  const visibleTaskDetails = useMemo(() => {
    if (taskDetailStatusScope === "completed") {
      return props.taskDetailReport.filter((task) => task.status === "completed");
    }

    if (taskDetailStatusScope === "incomplete-with-notes") {
      return props.taskDetailReport.filter((task) => task.status === "incomplete");
    }

    return props.taskDetailReport;
  }, [props.taskDetailReport, taskDetailStatusScope]);
  const visibleCompletedTaskDetails = visibleTaskDetails.filter(
    (task) => task.status === "completed"
  );
  const visibleIncompleteTaskDetails = visibleTaskDetails.filter(
    (task) => task.status === "incomplete"
  );
  const dailyReportText = useMemo(
    () =>
      buildDailyReportText({
        scopeLabel: props.scopeLabel,
        selectedDate: props.selectedDate,
        taskDetails: visibleTaskDetails,
        statusScope: taskDetailStatusScope,
        totalMinutes: props.time.totalMinutes,
      }),
    [
      props.scopeLabel,
      props.selectedDate,
      props.time.totalMinutes,
      taskDetailStatusScope,
      visibleTaskDetails,
    ]
  );
  const dailyReportHTML = useMemo(
    () =>
      buildDailyReportHTML({
        scopeLabel: props.scopeLabel,
        selectedDate: props.selectedDate,
        taskDetails: visibleTaskDetails,
        statusScope: taskDetailStatusScope,
        totalMinutes: props.time.totalMinutes,
      }),
    [
      props.scopeLabel,
      props.selectedDate,
      props.time.totalMinutes,
      taskDetailStatusScope,
      visibleTaskDetails,
    ]
  );

  async function handleCopyDailyReport() {
    try {
      if (
        typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard.write === "function"
      ) {
        const plainBlob = new Blob([dailyReportText], { type: "text/plain" });
        const htmlBlob = new Blob([dailyReportHTML], { type: "text/html" });

        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": plainBlob,
            "text/html": htmlBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(dailyReportText);
      }
      setCopyFeedback("Daily report copied");
    } catch {
      setCopyFeedback("Could not copy report");
    }

    window.setTimeout(() => {
      setCopyFeedback(null);
    }, 2400);
  }

  return (
    <main className="min-h-screen bg-[color:var(--tm-bg)] text-[color:var(--tm-text)]">
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:py-10 xl:px-8 2xl:px-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Reports</h1>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              Central reporting for productivity, time logged, and efficiency across TaskManager.
            </p>
          </div>
        </div>

        <section className="mt-4 tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_auto] xl:items-end">
            <label className="space-y-1.5 text-sm">
              <div className="font-medium">Scope</div>
              <select
                className={`${inputClass} w-full`}
                value={props.selectedScope}
                onChange={(event) =>
                  updateQuery({
                    scope: event.target.value,
                  })
                }
              >
                <option value="overview">Overview</option>
                {props.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1.5 text-sm">
              <div className="font-medium">Period</div>
              <div className={segmentClass}>
                {periodOptions.map((option) => {
                  const active = props.selectedPeriod === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? segmentButtonActiveClass : segmentButtonClass}
                      onClick={() =>
                        updateQuery({
                          period: option.value,
                        })
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className={buttonClass}
              onClick={() =>
                updateQuery({
                  date: props.previousDate,
                })
              }
            >
              Previous
            </button>

            {props.selectedPeriod === "month" ? (
              <label className="space-y-1.5 text-sm">
                <div className="font-medium">Month</div>
                <input
                  type="month"
                  className={inputClass}
                  value={getMonthInputValue(props.selectedDate)}
                  onChange={(event) =>
                    updateQuery({
                      date: `${event.target.value}-01`,
                    })
                  }
                />
              </label>
            ) : (
              <label className="space-y-1.5 text-sm">
                <div className="font-medium">{props.selectedPeriod === "week" ? "Week anchor" : "Day"}</div>
                <input
                  type="date"
                  className={inputClass}
                  value={props.selectedDate}
                  onChange={(event) =>
                    updateQuery({
                      date: event.target.value,
                    })
                  }
                />
              </label>
            )}

            <button
              type="button"
              className={buttonClass}
              onClick={() =>
                updateQuery({
                  date: props.nextDate,
                })
              }
            >
              Next
            </button>
          </div>

          <div className="mt-4 rounded-[12px] border border-[color:var(--tm-border)] bg-white/45 px-4 py-3 text-sm text-[color:var(--tm-muted)]">
            Scope: <span className="font-medium text-[color:var(--tm-text)]">{props.scopeLabel}</span>
            {" · "}
            Period: <span className="font-medium text-[color:var(--tm-text)]">{props.periodLabel}</span>
          </div>
          {copyFeedback && (
            <div className="mt-3 rounded-[10px] border border-[color:var(--tm-border)] bg-white/55 px-3 py-2 text-sm text-[color:var(--tm-muted)]">
              {copyFeedback}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Productivity</h2>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              Task creation, completion, backlog and breakdowns for the selected scope and period.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Tasks completed" value={`${props.productivity.completedCount}`} />
            <SummaryCard label="Tasks created" value={`${props.productivity.createdCount}`} />
            <SummaryCard label="Open tasks" value={`${props.productivity.openTasks}`} />
            <SummaryCard label="Overdue tasks" value={`${props.productivity.overdueTasks}`} />
            <SummaryCard
              label="Backlog / rolled over"
              value={`${props.productivity.backlogCount}`}
              description={
                props.productivity.averagePerDay !== null
                  ? `Avg completed/day ${props.productivity.averagePerDay.toFixed(1)}`
                  : undefined
              }
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Time</h2>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              Logged hours use the effective rounded duration stored with each timesheet entry.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard label="Total hours" value={formatHoursFromMinutes(props.time.totalMinutes)} />
            <SummaryCard
              label="Average hours / day"
              value={
                props.time.averagePerDay === null
                  ? "—"
                  : formatHoursFromMinutes(Math.round(props.time.averagePerDay))
              }
              description={
                props.selectedPeriod === "day"
                  ? undefined
                  : props.time.loggedDayCount === null
                    ? undefined
                    : props.time.loggedDayCount === 0
                      ? "No logged days in this period"
                      : `Based on ${props.time.loggedDayCount} logged day${props.time.loggedDayCount === 1 ? "" : "s"}`
              }
            />
            <SummaryCard
              label="Current scope"
              value={props.selectedScope === "overview" ? "All profiles" : "Single profile"}
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Efficiency</h2>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              Combined task and time measures for the selected scope and period.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard
              label="Completed tasks per hour"
              value={formatEfficiency(props.efficiency.tasksPerHour)}
              description="Based on total completed tasks divided by logged hours only."
            />
            <SummaryCard
              label="Hours per completed task"
              value={
                props.efficiency.hoursPerTask === null
                  ? "—"
                  : `${props.efficiency.hoursPerTask.toFixed(2)}h/task`
              }
              description="Based on total logged hours divided by completed tasks."
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <BreakdownList
            title="Top projects"
            items={props.productivity.topProjects}
            emptyLabel="No completed tasks in this period."
          />
          <BreakdownList
            title="Top categories"
            items={props.productivity.topCategories}
            emptyLabel="No completed tasks in this period."
          />
          <BreakdownList
            title={props.selectedPeriod === "month" ? "Hours by week" : "Hours by day"}
            items={props.time.breakdown.map((item) => ({ label: item.label, minutes: item.minutes }))}
            formatter={(item) => formatHoursFromMinutes(item.minutes ?? 0)}
            emptyLabel="No logged time in this period."
          />
          {props.selectedScope === "overview" ? (
            <BreakdownList
              title="Profile comparisons"
              items={props.profileComparisons.map((item) => ({
                label: item.label,
                minutes: item.minutes,
                count: item.completed,
              }))}
              formatter={(item) => `${item.count ?? 0} tasks · ${formatHoursFromMinutes(item.minutes ?? 0)}`}
              emptyLabel="No profile activity in this period."
            />
          ) : (
            <InsightBlock
              title="Definitions"
              items={[
                {
                  label: "Productivity",
                  value: "Most productive periods are ranked by completed task count.",
                },
                {
                  label: "Time",
                  value: "Most hours periods are ranked by effective logged duration.",
                },
                {
                  label: "Efficiency",
                  value: "Best efficiency periods are ranked by completed tasks per hour.",
                },
              ]}
            />
          )}
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-3">
          <InsightBlock
            title="Best productivity periods"
            items={[
              {
                label: "Most productive day",
                value: props.bestTaskPeriods.bestDay
                  ? `${formatBestPeriodLabel(props.bestTaskPeriods.bestDay.key, "day")} · ${props.bestTaskPeriods.bestDay.value} tasks`
                  : "No completed task history yet",
              },
              {
                label: "Most productive week",
                value: props.bestTaskPeriods.bestWeek
                  ? `${formatBestPeriodLabel(props.bestTaskPeriods.bestWeek.key, "week")} · ${props.bestTaskPeriods.bestWeek.value} tasks`
                  : "No completed task history yet",
              },
              {
                label: "Most productive month",
                value: props.bestTaskPeriods.bestMonth
                  ? `${formatBestPeriodLabel(props.bestTaskPeriods.bestMonth.key, "month-key")} · ${props.bestTaskPeriods.bestMonth.value} tasks`
                  : "No completed task history yet",
              },
            ]}
          />
          <InsightBlock
            title="Best time periods"
            items={[
              {
                label: "Most hours day",
                value: props.bestTimePeriods.bestDay
                  ? `${formatBestPeriodLabel(props.bestTimePeriods.bestDay.key, "day")} · ${formatHoursFromMinutes(props.bestTimePeriods.bestDay.value)}`
                  : "No logged time history yet",
              },
              {
                label: "Most hours week",
                value: props.bestTimePeriods.bestWeek
                  ? `${formatBestPeriodLabel(props.bestTimePeriods.bestWeek.key, "week")} · ${formatHoursFromMinutes(props.bestTimePeriods.bestWeek.value)}`
                  : "No logged time history yet",
              },
              {
                label: "Most hours month",
                value: props.bestTimePeriods.bestMonth
                  ? `${formatBestPeriodLabel(props.bestTimePeriods.bestMonth.key, "month-key")} · ${formatHoursFromMinutes(props.bestTimePeriods.bestMonth.value)}`
                  : "No logged time history yet",
              },
            ]}
          />
          <InsightBlock
            title="Best efficiency periods"
            items={[
              {
                label: "Best efficiency day",
                value: props.bestEfficiencyPeriods.bestDay
                  ? `${formatBestPeriodLabel(props.bestEfficiencyPeriods.bestDay.key, "day")} · ${formatEfficiency(
                      props.bestEfficiencyPeriods.bestDay.completed /
                        (props.bestEfficiencyPeriods.bestDay.minutes / 60)
                    )}`
                  : "No valid task/time overlap yet",
              },
              {
                label: "Best efficiency week",
                value: props.bestEfficiencyPeriods.bestWeek
                  ? `${formatBestPeriodLabel(props.bestEfficiencyPeriods.bestWeek.key, "week")} · ${formatEfficiency(
                      props.bestEfficiencyPeriods.bestWeek.completed /
                        (props.bestEfficiencyPeriods.bestWeek.minutes / 60)
                    )}`
                  : "No valid task/time overlap yet",
              },
              {
                label: "Best efficiency month",
                value: props.bestEfficiencyPeriods.bestMonth
                  ? `${formatBestPeriodLabel(props.bestEfficiencyPeriods.bestMonth.key, "month-key")} · ${formatEfficiency(
                      props.bestEfficiencyPeriods.bestMonth.completed /
                        (props.bestEfficiencyPeriods.bestMonth.minutes / 60)
                    )}`
                  : "No valid task/time overlap yet",
              },
            ]}
          />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Task Detail Report</h2>
              <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
                Detailed task activity for the selected scope and period. This filter only changes the detail report and daily copy output.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {props.selectedPeriod === "day" && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => void handleCopyDailyReport()}
                >
                  Copy Daily Report
                </button>
              )}
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                Detail status
              </span>
              <div className={segmentClass}>
                {taskDetailStatusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      taskDetailStatusScope === option.value
                        ? segmentButtonActiveClass
                        : segmentButtonClass
                    }
                    onClick={() => setTaskDetailStatusScope(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <article className="tm-card rounded-[12px] border p-4 shadow-sm">
            {visibleTaskDetails.length === 0 ? (
              <p className="text-sm text-[color:var(--tm-muted)]">
                {taskDetailStatusScope === "incomplete-with-notes"
                  ? "No incomplete tasks with notes were updated in this period."
                  : taskDetailStatusScope === "both"
                    ? "No completed tasks or incomplete tasks with notes in this period."
                    : "No completed tasks in this period."}
              </p>
            ) : taskDetailStatusScope === "both" ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                    Completed tasks ({visibleCompletedTaskDetails.length})
                  </h3>
                  {visibleCompletedTaskDetails.length === 0 ? (
                    <p className="mt-3 text-sm text-[color:var(--tm-muted)]">
                      No completed tasks in this period.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {visibleCompletedTaskDetails.map((task) => (
                        <TaskDetailCard key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
                    Incomplete tasks with notes ({visibleIncompleteTaskDetails.length})
                  </h3>
                  {visibleIncompleteTaskDetails.length === 0 ? (
                    <p className="mt-3 text-sm text-[color:var(--tm-muted)]">
                      No incomplete tasks with notes were updated in this period.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {visibleIncompleteTaskDetails.map((task) => (
                        <TaskDetailCard key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleTaskDetails.map((task) => (
                  <TaskDetailCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
