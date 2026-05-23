import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceOwner,
} from "@/app/api/spaces/shared";

type Ctx = {
  params: Promise<{ spaceId: string; memberId: string }>;
};

export async function DELETE(_req: Request, ctx: Ctx) {
  const { spaceId, memberId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const ownership = await requireSpaceOwner(spaceId, currentUser.user.id);
  if (ownership.error) return ownership.error;

  const member = await prisma.spaceMember.findFirst({
    where: { id: memberId, spaceId },
    select: { id: true, role: true, userId: true },
  });

  if (!member) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  if (member.role === "owner" && member.userId === currentUser.user.id) {
    const ownerCount = await prisma.spaceMember.count({
      where: { spaceId, role: "owner" },
    });

    if (ownerCount <= 1) {
      return Response.json(
        { error: "Cannot remove the only owner" },
        { status: 400 }
      );
    }
  }

  await prisma.spaceMember.delete({
    where: { id: member.id },
  });

  return Response.json({ ok: true });
}
