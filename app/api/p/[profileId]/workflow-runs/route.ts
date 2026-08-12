import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";

type Ctx = { params: Promise<{ profileId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { profileId } = await ctx.params;
  const profile = await prisma.profile.findFirst({ where: { id: profileId, user: { email: session.user.email } }, select: { id: true } });
  if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

  const runs = await prisma.workflowRun.findMany({
    where: { profileId },
    orderBy: { launchedAt: "desc" },
    include: {
      tasks: {
        select: {
          id: true,
          title: true,
          notes: true,
          startDate: true,
          dueAt: true,
          completedAt: true,
          completedOn: true,
          isPriority: true,
          noteHistory: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              content: true,
              waitingOn: true,
              createdAt: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return Response.json(runs);
}
