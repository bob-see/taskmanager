export type DelegatedTaskStatus =
  | "PENDING"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "DECLINED";

const statusStyles: Record<DelegatedTaskStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  ACCEPTED: "border-sky-200 bg-sky-50 text-sky-800",
  IN_PROGRESS: "border-indigo-200 bg-indigo-50 text-indigo-800",
  COMPLETED: "border-teal-300 bg-teal-50 text-teal-900 shadow-sm",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600",
  DECLINED: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusLabels: Record<DelegatedTaskStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  COMPLETED: "Awaiting review",
  CLOSED: "Closed",
  DECLINED: "Declined",
};

export function DelegatedStatusBadge({ status }: { status: DelegatedTaskStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
