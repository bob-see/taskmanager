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

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: { title },
  });

  return Response.json(task, { status: 201 });
}
