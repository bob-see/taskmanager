import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      defaultView: true,
      averageBasis: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(profiles);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const profile = await prisma.profile.create({ data: { name } });
  return Response.json(profile, { status: 201 });
}
