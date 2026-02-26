import { prisma } from "@/app/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const completed =
    typeof body?.completed === "boolean" ? body.completed : undefined;
  const dueAtInput = body?.dueAt;
  let dueAt: Date | null | undefined = undefined;

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

  if (completed === undefined && dueAt === undefined) {
    return Response.json(
      { error: "Body must include completed and/or dueAt" },
      { status: 400 }
    );
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(completed !== undefined
        ? { completedAt: completed ? new Date() : null }
        : {}),
      ...(dueAt !== undefined ? { dueAt } : {}),
    },
  });

  return Response.json(task);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  await prisma.task.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
