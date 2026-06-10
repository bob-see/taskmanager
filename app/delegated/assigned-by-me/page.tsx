import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { DelegatedLifecycleActions } from "../delegated-lifecycle-actions";
import { DelegatedTaskList, type DelegatedTaskListItem } from "../delegated-task-list";
import { NewDelegatedTaskButton } from "../new-delegated-task-button";

const CLOSED_PAGE_SIZE = 10;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function makeHref(view: "open" | "closed", query = "", offset = 0) {
  const params = new URLSearchParams();
  if (view === "closed") params.set("view", "closed");
  if (query.trim()) params.set("q", query.trim());
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return qs ? `/delegated/assigned-by-me?${qs}` : "/delegated/assigned-by-me";
}

export default async function AssignedByMePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  const resolvedSearchParams = (await searchParams) ?? {};
  const view = getParam(resolvedSearchParams, "view") === "closed" ? "closed" : "open";
  const closedQuery = getParam(resolvedSearchParams, "q")?.trim() ?? "";
  const offset = Math.max(0, Number(getParam(resolvedSearchParams, "offset") ?? 0) || 0);
  const isClosedView = view === "closed";

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!currentUser) return notFound();

  const delegatedTasks = await prisma.delegatedTask.findMany({
    where: {
      assignedByUserId: currentUser.id,
      status: isClosedView ? "CLOSED" : { not: "CLOSED" },
      ...(isClosedView && closedQuery
        ? {
            task: {
              OR: [
                { title: { contains: closedQuery } },
                { noteHistory: { some: { content: { contains: closedQuery } } } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    skip: isClosedView ? offset : undefined,
    take: isClosedView ? CLOSED_PAGE_SIZE + 1 : undefined,
    select: {
      id: true,
      status: true,
      createdAt: true,
      task: {
        select: {
          id: true,
          title: true,
          dueAt: true,
          noteHistory: {
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      assignedToUser: {
        select: {
          name: true,
          email: true,
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
  const hasMoreClosed = isClosedView && delegatedTasks.length > CLOSED_PAGE_SIZE;
  const visibleDelegatedTasks = isClosedView
    ? delegatedTasks.slice(0, CLOSED_PAGE_SIZE)
    : delegatedTasks;

  const items: DelegatedTaskListItem[] = visibleDelegatedTasks.map((item) => ({
    id: item.id,
    status: item.status,
    createdAt: item.createdAt,
    task: item.task,
    user: item.assignedToUser,
    sender: item.assignedByUser,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
            Delegated
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Assigned By Me</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-[color:var(--tm-border)] bg-white/70 px-3 py-1 text-sm font-medium">
            {isClosedView ? offset + items.length : items.length} {isClosedView ? "closed" : "open"}
          </div>
          <NewDelegatedTaskButton />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="tm-tabset inline-flex w-fit rounded-full border p-1 text-sm">
          <a className={`tm-tab rounded-full px-3 py-1.5 ${!isClosedView ? "tm-tab-active" : ""}`} href={makeHref("open")}>
            Open
          </a>
          <a className={`tm-tab rounded-full px-3 py-1.5 ${isClosedView ? "tm-tab-active" : ""}`} href={makeHref("closed", closedQuery)}>
            Closed
          </a>
        </div>
        {isClosedView ? (
          <form className="flex w-full gap-2 sm:w-auto" action="/delegated/assigned-by-me">
            <input type="hidden" name="view" value="closed" />
            <input
              className="tm-input h-10 min-w-0 flex-1 rounded-[10px] border px-3 text-sm outline-none sm:w-72"
              name="q"
              placeholder="Search closed tasks"
              defaultValue={closedQuery}
            />
            <button className="tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm" type="submit">
              Search
            </button>
          </form>
        ) : null}
      </div>

      <DelegatedTaskList
        items={items}
        emptyMessage={
          isClosedView
            ? "No closed delegated tasks match this view."
            : "You have not delegated any tasks."
        }
        userColumnLabel="Assigned To"
        renderActions={(item) =>
          item.status === "COMPLETED" ? (
            <DelegatedLifecycleActions delegatedTaskId={item.id} action="close" />
          ) : null
        }
      />
      {hasMoreClosed ? (
        <div className="mt-4 flex justify-center">
          <a
            className="tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-4 text-sm"
            href={makeHref("closed", closedQuery, offset + CLOSED_PAGE_SIZE)}
          >
            Load more
          </a>
        </div>
      ) : null}
    </main>
  );
}
