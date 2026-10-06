import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";

type Ctx = { params: Promise<{ profileId: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  const { profileId } = await params;

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, user: { email: session.user.email } },
    select: { id: true },
  });

  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { taskBadgeLastSeenAt: new Date() },
  });

  return Response.json({ ok: true });
}
