import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { DelegatedTaskList, type DelegatedTaskListItem } from "../delegated-task-list";
import { DelegatedResponseActions } from "../delegated-response-actions";

export default async function AssignedToMePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!currentUser) return notFound();

  const delegatedTasks = await prisma.delegatedTask.findMany({
    where: {
      assignedToUserId: currentUser.id,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      task: {
        select: {
          title: true,
          dueAt: true,
        },
      },
      assignedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const items: DelegatedTaskListItem[] = delegatedTasks.map((item) => ({
    id: item.id,
    status: item.status,
    createdAt: item.createdAt,
    task: item.task,
    user: item.assignedByUser,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
            Delegated
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Assigned To Me</h1>
        </div>
        <div className="rounded-full border border-[color:var(--tm-border)] bg-white/70 px-3 py-1 text-sm font-medium">
          {items.length} total
        </div>
      </div>

      <DelegatedTaskList
        items={items}
        emptyMessage="Nothing has been delegated to you."
        userColumnLabel="Assigned By"
        renderActions={(item) =>
          item.status === "PENDING" ? (
            <DelegatedResponseActions delegatedTaskId={item.id} />
          ) : null
        }
      />
    </main>
  );
}
