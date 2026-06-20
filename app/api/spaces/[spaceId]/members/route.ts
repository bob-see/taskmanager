import { prisma } from "@/app/lib/prisma";
import {
  getCurrentUserOr401,
  memberSelect,
  requireSpaceMember,
  requireSpaceOwner,
} from "@/app/api/spaces/shared";
import { canSeeUser, scopedVisibleUserWhere } from "@/app/api/users/visibility";
import { createActivityLog } from "@/app/lib/activity-log";

type Ctx = {
  params: Promise<{ spaceId: string }>;
};

function normalizeRole(value: unknown) {
  if (value !== "member" && value !== "owner") {
    return null;
  }

  return value;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { spaceId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const membership = await requireSpaceMember(spaceId, currentUser.user.id);
  if (membership.error) return membership.error;

  const members = await prisma.spaceMember.findMany({
    where: {
      spaceId,
      user: await scopedVisibleUserWhere(currentUser.user),
    },
    orderBy: [{ role: "desc" }, { id: "asc" }],
    select: memberSelect,
  });

  return Response.json(members);
}

export async function POST(req: Request, ctx: Ctx) {
  const { spaceId } = await ctx.params;

  const currentUser = await getCurrentUserOr401();
  if (currentUser.error) return currentUser.error;

  const ownership = await requireSpaceOwner(spaceId, currentUser.user.id);
  if (ownership.error) return ownership.error;

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const role = normalizeRole(body?.role ?? "member");

  if (!userId && !email) {
    return Response.json({ error: "Select a user" }, { status: 400 });
  }

  if (!role) {
    return Response.json(
      { error: "role must be member or owner" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return Response.json(
      { error: "No user found with that email" },
      { status: 404 }
    );
  }

  if (!(await canSeeUser(currentUser.user, user.id))) {
    return Response.json(
      { error: "You cannot add users outside your Groups" },
      { status: 403 }
    );
  }

  const existingMember = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId,
        userId: user.id,
      },
    },
    select: { id: true },
  });

  if (existingMember) {
    return Response.json(
      { error: "User is already a member" },
      { status: 409 }
    );
  }

  const member = await prisma.$transaction(async (tx) => {
    const space = await tx.collaborativeSpace.findUniqueOrThrow({
      where: { id: spaceId },
      select: { name: true },
    });
    const createdMember = await tx.spaceMember.create({
      data: {
        spaceId,
        userId: user.id,
        role,
      },
      select: memberSelect,
    });

    await createActivityLog(tx, {
      userId: currentUser.user.id,
      spaceId,
      type: "space.member_add",
      description: `Added member "${user.name || user.email}" to "${space.name}"`,
      metadata: {
        spaceId,
        spaceName: space.name,
        memberId: createdMember.id,
        memberUserId: user.id,
        memberName: user.name || user.email,
        newValue: role,
      },
    });

    return createdMember;
  });

  return Response.json(member, { status: 201 });
}
