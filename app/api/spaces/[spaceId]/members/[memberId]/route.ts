import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  requireSpaceOwner,
} from "@/app/api/spaces/shared";
import { createActivityLog } from "@/app/lib/activity-log";

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
    select: {
      id: true,
      role: true,
      userId: true,
      user: { select: { name: true, email: true } },
      space: { select: { name: true } },
    },
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

  await prisma.$transaction(async (tx) => {
    await tx.spaceMember.delete({
      where: { id: member.id },
    });

    const memberName = member.user.name || member.user.email;
    await createActivityLog(tx, {
      userId: currentUser.user.id,
      spaceId,
      type: "space.member_remove",
      description: `Removed member "${memberName}" from "${member.space.name}"`,
      metadata: {
        spaceId,
        spaceName: member.space.name,
        memberId: member.id,
        memberUserId: member.userId,
        memberName,
        previousValue: member.role,
      },
    });
  });

  return Response.json({ ok: true });
}
