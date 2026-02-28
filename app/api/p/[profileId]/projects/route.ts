import { prisma } from "@/app/lib/prisma";
import {
  ensureProfile,
  parseDateInput,
  parseOptionalTextInput,
} from "@/app/api/p/tasks-shared";

type Ctx = {
  params: Promise<{ profileId: string }>;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;

  const profile = await ensureProfile(profileId);
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const projects = await prisma.project.findMany({
    where: { profileId },
    orderBy: [{ createdAt: "desc" }],
  });

  return Response.json(projects);
}

export async function POST(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;

  const profile = await ensureProfile(profileId);
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const startDate = parseDateInput(body?.startDate ?? null, "startDate");
  if (startDate.error) return startDate.error;

  const dueAt = parseDateInput(body?.dueAt, "dueAt");
  if (dueAt.error) return dueAt.error;

  const category = parseOptionalTextInput(body?.category, "category");
  if (category.error) return category.error;

  const defaultStartDate = new Date();
  defaultStartDate.setHours(0, 0, 0, 0);

  const project = await prisma.project.create({
    data: {
      name,
      profileId,
      startDate: startDate.value ?? defaultStartDate,
      ...(dueAt.value !== undefined ? { dueAt: dueAt.value } : {}),
      ...(category.value !== undefined ? { category: category.value } : {}),
    },
  });

  return Response.json(project, { status: 201 });
}
