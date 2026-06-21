import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";

export async function getNotificationUserOr401() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return {
      error: Response.json(
        { error: "Authenticated user not found" },
        { status: 401 }
      ),
    };
  }

  return { user };
}

export const notificationResponseHeaders = {
  "Cache-Control": "no-store",
};
