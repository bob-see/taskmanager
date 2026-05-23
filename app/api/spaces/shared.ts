import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";

export const columnTypes = [
  "status",
  "text",
  "number",
  "date",
  "checkbox",
  "user",
] as const;

export type MatrixColumnType = (typeof columnTypes)[number];

export async function getCurrentUserOr401() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
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

export async function requireSpaceMember(spaceId: string, userId: string) {
  const member = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId,
        userId,
      },
    },
    select: { id: true, role: true },
  });

  if (!member) {
    return {
      error: Response.json(
        { error: "You do not have access to this space" },
        { status: 403 }
      ),
    };
  }

  return { member };
}

export async function requireSpaceOwner(spaceId: string, userId: string) {
  const membership = await requireSpaceMember(spaceId, userId);
  if (membership.error) return membership;

  if (membership.member.role !== "owner") {
    return {
      error: Response.json(
        { error: "Only owners can manage members" },
        { status: 403 }
      ),
    };
  }

  return membership;
}

export const memberSelect = {
  id: true,
  role: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export function validateColumnType(value: unknown) {
  if (typeof value !== "string") {
    return {
      error: Response.json({ error: "Column type is required" }, { status: 400 }),
    };
  }

  if (!columnTypes.includes(value as MatrixColumnType)) {
    return {
      error: Response.json({ error: "Invalid column type" }, { status: 400 }),
    };
  }

  return { value: value as MatrixColumnType };
}

export function parseCellValue(type: MatrixColumnType, value: unknown) {
  const data = {
    textValue: null as string | null,
    numberValue: null as number | null,
    dateValue: null as Date | null,
    booleanValue: null as boolean | null,
    statusOptionId: null as string | null,
    userIdValue: null as string | null,
  };

  if (value === null || value === undefined || value === "") {
    return { data };
  }

  if (type === "text") {
    if (typeof value !== "string") {
      return {
        error: Response.json({ error: "Value must be text" }, { status: 400 }),
      };
    }
    return { data: { ...data, textValue: value } };
  }

  if (type === "number") {
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;

    if (!Number.isFinite(numberValue)) {
      return {
        error: Response.json({ error: "Value must be a number" }, { status: 400 }),
      };
    }
    return { data: { ...data, numberValue } };
  }

  if (type === "date") {
    if (typeof value !== "string") {
      return {
        error: Response.json({ error: "Value must be a date" }, { status: 400 }),
      };
    }

    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      return {
        error: Response.json({ error: "Value must be a valid date" }, { status: 400 }),
      };
    }
    return { data: { ...data, dateValue } };
  }

  if (type === "checkbox") {
    if (typeof value !== "boolean") {
      return {
        error: Response.json({ error: "Value must be a boolean" }, { status: 400 }),
      };
    }
    return { data: { ...data, booleanValue: value } };
  }

  if (type === "user") {
    if (typeof value !== "string") {
      return {
        error: Response.json({ error: "Value must be a user id" }, { status: 400 }),
      };
    }
    return { data: { ...data, userIdValue: value } };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json(
        { error: "Value must be a status option id" },
        { status: 400 }
      ),
    };
  }

  return { data: { ...data, statusOptionId: value } };
}
