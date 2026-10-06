import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { getProfileTaskBadges } from "@/app/lib/profile-task-badges";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.profile.findMany({
    where: { user: { email: session.user.email } },
    select: { id: true, taskBadgeLastSeenAt: true },
  });

  return Response.json({ badges: await getProfileTaskBadges(profiles) });
}
