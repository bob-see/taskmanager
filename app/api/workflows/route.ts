import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { parseWorkflowDefinition, WORKFLOW_STATUS } from "./shared";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") === WORKFLOW_STATUS.ARCHIVED
    ? WORKFLOW_STATUS.ARCHIVED
    : WORKFLOW_STATUS.ACTIVE;
  const workflows = await prisma.workflow.findMany({
    where: { user: { email: session.user.email }, status },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      tasks: { orderBy: { position: "asc" } },
      runs: { select: { tasks: { select: { completedAt: true } } } },
    },
  });
  return Response.json(workflows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  try {
    const definition = parseWorkflowDefinition(body);
    const workflow = await prisma.workflow.create({
      data: {
        user: { connect: { email: session.user.email } },
        name: definition.name,
        description: definition.description,
        category: definition.category,
        tasks: {
          create: definition.tasks.map((task, position) => ({ ...task, position })),
        },
      },
      include: { tasks: { orderBy: { position: "asc" } } },
    });
    return Response.json(workflow, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid Workflow" }, { status: 400 });
  }
}
