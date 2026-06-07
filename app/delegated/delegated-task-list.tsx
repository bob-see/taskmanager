import { Fragment, type ReactNode } from "react";
import { DelegatedTaskNotes, type DelegatedTaskNote } from "./delegated-task-notes";
import { DelegatedSenderBadge } from "./delegated-task-indicators";
import { DelegatedStatusBadge, type DelegatedTaskStatus } from "./delegated-status-badge";

export type DelegatedTaskListItem = {
  id: string;
  status: DelegatedTaskStatus;
  createdAt: Date;
  task: {
    id: string;
    title: string;
    dueAt: Date | null;
    noteHistory: DelegatedTaskNote[];
  };
  user: {
    name: string | null;
    email: string | null;
  } | null;
  sender: {
    name: string | null;
    email: string | null;
  } | null;
};

type DelegatedTaskListProps = {
  items: DelegatedTaskListItem[];
  emptyMessage: string;
  userColumnLabel: string;
  renderActions?: (item: DelegatedTaskListItem) => ReactNode;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
  }).format(value);
}

function formatUser(user: DelegatedTaskListItem["user"]) {
  if (!user) return "Unknown user";

  if (user.name && user.email) return `${user.name} (${user.email})`;
  return user.name ?? user.email ?? "Unknown user";
}

export function DelegatedTaskList({
  items,
  emptyMessage,
  userColumnLabel,
  renderActions,
}: DelegatedTaskListProps) {
  const columnCount = renderActions ? 6 : 5;

  return (
    <section className="mt-6 tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[color:var(--tm-border)] text-left text-xs uppercase tracking-[0.12em] text-[color:var(--tm-muted)]">
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">{userColumnLabel}</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Due</th>
              {renderActions ? <th className="px-3 py-2 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[color:var(--tm-muted)]" colSpan={columnCount}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <Fragment key={item.id}>
                  <tr className="tm-table-row border-b-0 border-l-4 border-l-sky-200/70">
                    <td className="max-w-md px-3 py-3 font-medium">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <DelegatedSenderBadge sender={item.sender} />
                        <span className="line-clamp-2">{item.task.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <DelegatedStatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                      {formatUser(item.user)}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--tm-muted)]">
                      {item.task.dueAt ? formatDate(item.task.dueAt) : "None"}
                    </td>
                    {renderActions ? (
                      <td className="px-3 py-3 text-right">{renderActions(item)}</td>
                    ) : null}
                  </tr>
                  <tr className="border-b last:border-0">
                    <td className="px-3 pb-4" colSpan={columnCount}>
                      <DelegatedTaskNotes
                        delegatedTaskId={item.id}
                        notes={item.task.noteHistory}
                      />
                    </td>
                  </tr>
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
