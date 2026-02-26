import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
  });

  return Response.json(tasks);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const dueAtInput = body?.dueAt;
  let dueAt: Date | null | undefined = undefined;

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (dueAtInput === null) {
    dueAt = null;
  } else if (dueAtInput === undefined) {
    dueAt = undefined;
  } else if (typeof dueAtInput === "string") {
    const parsed = new Date(dueAtInput);
    if (Number.isNaN(parsed.getTime())) {
      return Response.json(
        { error: "dueAt must be an ISO datetime string or null" },
        { status: 400 }
      );
    }
    dueAt = parsed;
  } else {
    return Response.json(
      { error: "dueAt must be an ISO datetime string or null" },
      { status: 400 }
    );
  }

  const task = await prisma.task.create({
    data: { title, ...(dueAt !== undefined ? { dueAt } : {}) },
  });

  return Response.json(task, { status: 201 });
}
