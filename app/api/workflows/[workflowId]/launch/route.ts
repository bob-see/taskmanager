import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { calculateWorkflowDates } from "@/app/lib/workflow-dates";
import { dateOnlyToUtcDate } from "@/app/lib/date-time";
import { parseDateOnlyInput } from "../../shared";

type Ctx = { params: Promise<{ workflowId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => ({}));
  const workflowId = (await ctx.params).workflowId;
  const launchName = typeof body.launchName === "string" ? body.launchName.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!launchName) return Response.json({ error: "Run name is required" }, { status: 400 });
  if (!idempotencyKey) return Response.json({ error: "Idempotency key is required" }, { status: 400 });
  if (launchName.length > 191 || idempotencyKey.length > 191) {
    return Response.json({ error: "Run name or idempotency key is too long" }, { status: 400 });
  }

  let workflowDate: string;
  try {
    workflowDate = parseDateOnlyInput(body.workflowDate, "workflowDate");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid Workflow Date" }, { status: 400 });
  }
  const profileId = typeof body.profileId === "string" ? body.profileId : "";
  if (!profileId) return Response.json({ error: "Profile is required" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) throw new Error("Authenticated user not found");

      const existingRun = await tx.workflowRun.findFirst({
        where: { userId: user.id, idempotencyKey },
        include: { tasks: { orderBy: { createdAt: "asc" } } },
      });
      if (existingRun) return { run: existingRun, reused: true };

      const workflow = await tx.workflow.findFirst({
        where: { id: workflowId, userId: user.id, status: "ACTIVE" },
        include: { tasks: { orderBy: { position: "asc" } } },
      });
      if (!workflow) throw new Error("Active Workflow not found");

      const profile = await tx.profile.findFirst({ where: { id: profileId, userId: user.id }, select: { id: true } });
      if (!profile) throw new Error("Profile not found");
      if (workflow.tasks.length === 0) throw new Error("Workflow has no tasks");

      const rawOverrides = body.taskOverrides && typeof body.taskOverrides === "object" ? body.taskOverrides : {};
      const overrides = rawOverrides as Record<string, unknown>;
      const orderResult = await tx.task.aggregate({ where: { profileId }, _max: { orderIndex: true } });
      const tasks = workflow.tasks.map((template, index) => {
        const raw = overrides[template.id];
        const override = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const calculated = calculateWorkflowDates(workflowDate, {
          startOffsetDays: template.startOffsetDays,
          dueRule: template.dueRule as "NONE" | "START_DATE" | "WORKFLOW_DATE" | "OFFSET",
          dueOffsetDays: template.dueOffsetDays,
        });
        const startDate = typeof override.startDate === "string" ? parseDateOnlyInput(override.startDate, "startDate") : calculated.startDate;
        const dueDate = typeof override.dueDate === "string" ? parseDateOnlyInput(override.dueDate, "dueDate") : calculated.dueDate;
        if (dueDate && dueDate < startDate) throw new Error(`Due date cannot be before start date for "${template.title}"`);
        const notes = typeof override.notes === "string" ? override.notes.trim() || null : template.notes;
        const isPriority = typeof override.isPriority === "boolean" ? override.isPriority : template.isPriority;
        return {
          title: template.title,
          notes,
          startDate: dateOnlyToUtcDate(startDate),
          dueAt: dueDate ? dateOnlyToUtcDate(dueDate) : null,
          isPriority,
          category: workflow.category,
          profileId,
          workflowRunId: "__RUN__",
          orderIndex: (orderResult._max.orderIndex ?? -1) + index + 1,
        };
      });

      const run = await tx.workflowRun.create({
        data: {
          workflowId,
          userId: user.id,
          profileId,
          launchName,
          workflowNameSnapshot: workflow.name,
          categorySnapshot: workflow.category,
          workflowDate: dateOnlyToUtcDate(workflowDate),
          idempotencyKey,
          createdTaskCount: tasks.length,
        },
      });

      await tx.task.createMany({ data: tasks.map(({ workflowRunId: _placeholder, ...task }) => ({ ...task, workflowRunId: run.id })) });
      const createdRun = await tx.workflowRun.findUniqueOrThrow({
        where: { id: run.id },
        include: { tasks: { orderBy: { createdAt: "asc" } } },
      });
      return { run: createdRun, reused: false };
    }, { maxWait: 10_000, timeout: 15_000 });

    return Response.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not launch Workflow" }, { status: 400 });
  }
}
