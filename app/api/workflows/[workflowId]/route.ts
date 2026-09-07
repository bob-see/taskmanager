import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { parseWorkflowDefinition, WORKFLOW_STATUS } from "../shared";

type Ctx = { params: Promise<{ workflowId: string }> };

async function ownedWorkflow(workflowId: string, email: string) {
  return prisma.workflow.findFirst({
    where: { id: workflowId, user: { email } },
    include: { tasks: { orderBy: { position: "asc" } } },
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const workflow = await prisma.workflow.findFirst({
    where: { id: (await ctx.params).workflowId, user: { email: session.user.email } },
    include: {
      tasks: { orderBy: { position: "asc" } },
      runs: {
        orderBy: { launchedAt: "desc" },
        select: {
          id: true,
          completedAt: true,
          launchedAt: true,
          profile: { select: { name: true } },
          tasks: { select: { completedAt: true } },
        },
      },
    },
  });
  return workflow ? Response.json(workflow) : Response.json({ error: "Workflow not found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const workflowId = (await ctx.params).workflowId;
  const existing = await ownedWorkflow(workflowId, session.user.email);
  if (!existing) return Response.json({ error: "Workflow not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "archive" || body.action === "restore") {
      const updated = await prisma.workflow.update({
        where: { id: workflowId },
        data: { status: body.action === "archive" ? WORKFLOW_STATUS.ARCHIVED : WORKFLOW_STATUS.ACTIVE },
        include: { tasks: { orderBy: { position: "asc" } } },
      });
      return Response.json(updated);
    }

    const definition = parseWorkflowDefinition(body);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.workflowTask.deleteMany({ where: { workflowId } });
      return tx.workflow.update({
        where: { id: workflowId },
        data: {
          name: definition.name,
          description: definition.description,
          category: definition.category,
          tasks: { create: definition.tasks.map((task, position) => ({ ...task, position })) },
        },
        include: { tasks: { orderBy: { position: "asc" } } },
      });
    });
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid Workflow" }, { status: 400 });
  }
}
