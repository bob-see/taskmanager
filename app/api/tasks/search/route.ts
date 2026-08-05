import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { getBrisbaneDate } from "@/app/lib/date-time";

const MAX_QUERY_LENGTH = 100;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const VALID_STATUSES = new Set(["all", "open", "done"]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status") ?? "all";
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (!query) {
    return Response.json({ results: [] });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json(
      { error: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  if (!VALID_STATUSES.has(status)) {
    return Response.json({ error: "Invalid task status" }, { status: 400 });
  }

  const statusWhere =
    status === "open"
      ? { completedOn: null }
      : status === "done"
        ? { completedOn: { not: null } }
        : {};

  const results = await prisma.task.findMany({
    where: {
      ...statusWhere,
      profile: {
        user: { email: session.user.email },
      },
      OR: [
        { title: { contains: query } },
        { notes: { contains: query } },
        { category: { contains: query } },
        { profile: { name: { contains: query } } },
        { project: { name: { contains: query } } },
        { noteHistory: { some: { content: { contains: query } } } },
      ],
    },
    orderBy: [{ completedOn: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      notes: true,
      startDate: true,
      category: true,
      dueAt: true,
      completedOn: true,
      isPriority: true,
      projectId: true,
      repeatEnabled: true,
      repeatPattern: true,
      repeatInterval: true,
      repeatDays: true,
      repeatWeeklyDay: true,
      repeatMonthlyDay: true,
      repeatPaused: true,
      repeatPauseUntil: true,
      repeatPauseNote: true,
      noteHistory: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          waitingOn: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      profile: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return Response.json({
    results: results.map((task) => ({
      ...task,
      startDate: getBrisbaneDate(task.startDate),
      dueAt: task.dueAt ? getBrisbaneDate(task.dueAt) : null,
      completedOn: task.completedOn ? getBrisbaneDate(task.completedOn) : null,
      repeatPauseUntil: task.repeatPauseUntil
        ? getBrisbaneDate(task.repeatPauseUntil)
        : null,
      noteHistory: task.noteHistory.map((note) => ({
        ...note,
        createdAt: note.createdAt.toISOString(),
      })),
    })),
  });
}
