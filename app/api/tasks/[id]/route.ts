import { prisma } from "@/app/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const completed =
    typeof body?.completed === "boolean" ? body.completed : undefined;

  if (completed === undefined) {
    return Response.json(
      { error: "Body must include { completed: true|false }" },
      { status: 400 }
    );
  }

  const task = await prisma.task.update({
    where: { id },
    data: { completedAt: completed ? new Date() : null },
  });

  return Response.json(task);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  await prisma.task.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
