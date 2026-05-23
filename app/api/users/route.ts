import { prisma } from "@/app/lib/prisma";
import { getCurrentUserOr401 } from "@/app/api/spaces/shared";

export async function GET() {
  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const users = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return Response.json(
    users.map((user) => ({
      ...user,
      name: user.name || user.email,
    }))
  );
}
