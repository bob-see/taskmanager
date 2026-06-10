import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!currentUser) {
    return Response.json({ error: "Authenticated user not found" }, { status: 401 });
  }

  const [assignedToMe, assignedByMe] = await Promise.all([
    prisma.delegatedTask.count({
      where: {
        assignedToUserId: currentUser.id,
        status: "PENDING",
      },
    }),
    prisma.delegatedTask.count({
      where: {
        assignedByUserId: currentUser.id,
        status: {
          not: "CLOSED",
        },
      },
    }),
  ]);

  return Response.json({ assignedToMe, assignedByMe });
}
