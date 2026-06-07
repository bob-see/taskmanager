import {
  DelegatedStatusBadge,
  type DelegatedTaskStatus,
} from "./delegated-status-badge";

type DelegatedSender = {
  name: string | null;
  email: string | null;
} | null;

const delegatedStatuses: DelegatedTaskStatus[] = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
  "DECLINED",
];

function isDelegatedTaskStatus(status: string): status is DelegatedTaskStatus {
  return delegatedStatuses.includes(status as DelegatedTaskStatus);
}

function getSenderLabel(sender: DelegatedSender) {
  if (!sender) return "Unknown sender";
  return sender.name?.trim() || sender.email || "Unknown sender";
}

function getSenderInitials(sender: DelegatedSender) {
  const label = getSenderLabel(sender);
  const nameParts = sender?.name
    ?.trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts && nameParts.length > 0) {
    const first = nameParts[0]?.[0] ?? "";
    const second = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] ?? "" : "";
    return `${first}${second}`.toUpperCase();
  }

  const emailName = sender?.email?.split("@")[0] ?? label;
  return emailName.slice(0, 2).toUpperCase();
}

export function DelegatedSenderBadge({ sender }: { sender: DelegatedSender }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-sky-800"
      title={`Delegated by ${getSenderLabel(sender)}`}
      aria-label={`Delegated by ${getSenderLabel(sender)}`}
    >
      {getSenderInitials(sender)}
    </span>
  );
}

export function DelegatedTaskStatusPill({ status }: { status: string }) {
  if (!isDelegatedTaskStatus(status)) return null;
  return <DelegatedStatusBadge status={status} />;
}
