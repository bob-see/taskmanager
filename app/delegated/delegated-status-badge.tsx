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
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-700",
  DECLINED: "border-rose-200 bg-rose-50 text-rose-800",
};

const statusLabels: Record<DelegatedTaskStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  DECLINED: "Declined",
};

export function DelegatedStatusBadge({ status }: { status: DelegatedTaskStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
