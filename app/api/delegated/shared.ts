import { prisma } from "@/app/lib/prisma";
import { canSeeUser } from "@/app/api/users/visibility";
import type { PrismaClient } from "@prisma/client";

export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export const DELEGATED_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 20_000,
} as const;

type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
};

export function readOptionalText(value: unknown, fieldName: string) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") {
    return {
      error: Response.json({ error: `${fieldName} must be text` }, { status: 400 }),
    };
  }

  const trimmed = value.trim();
  return { value: trimmed || null };
}

export function formatUserName(user: { name: string | null; email: string | null }) {
  return user.name?.trim() || user.email || "Unknown user";
}

export async function validateDelegationReceiver(
  currentUser: CurrentUser,
  assignedToUserId: unknown
) {
  if (typeof assignedToUserId !== "string" || !assignedToUserId.trim()) {
    return {
      error: Response.json({ error: "Assign to is required" }, { status: 400 }),
    };
  }

  const receiverId = assignedToUserId.trim();
  if (receiverId === currentUser.id) {
    return {
      error: Response.json(
        { error: "You cannot delegate a task to yourself" },
        { status: 400 }
      ),
    };
  }

  const isVisible = await canSeeUser(currentUser, receiverId);
  if (!isVisible) {
    return {
      error: Response.json({ error: "Assigned user not found" }, { status: 404 }),
    };
  }

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!receiver) {
    return {
      error: Response.json({ error: "Assigned user not found" }, { status: 404 }),
    };
  }

  return { receiver };
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
