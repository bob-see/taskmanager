import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createActivityLog } from "@/app/lib/activity-log";

const ALLOWED_VIEW_MODES = new Set(["day", "week", "month"]);
const ALLOWED_AVERAGE_BASES = new Set(["calendar-days", "work-week"]);
const profileSelect = {
  id: true,
  name: true,
  order: true,
  defaultView: true,
  averageBasis: true,
  createdAt: true,
  updatedAt: true,
} as const;

function parseOptionalPreference(
  value: unknown,
  allowedValues: Set<string>,
  fieldName: string
) {
  if (value === undefined) {
    return { ok: true as const, value: undefined };
  }

  if (value === null) {
    return { ok: true as const, value: null };
  }

  if (typeof value === "string" && allowedValues.has(value)) {
    return { ok: true as const, value };
  }

  return {
    ok: false as const,
    error: `${fieldName} must be one of ${Array.from(allowedValues).join(", ")} or null`,
  };
}

function parseOptionalName(value: unknown) {
  if (value === undefined) {
    return { ok: true as const, value: undefined };
  }

  if (typeof value !== "string") {
    return { ok: false as const, error: "name must be a string" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false as const, error: "name is required" };
  }

  return { ok: true as const, value: trimmed };
}

function parseOptionalOrder(value: unknown) {
  if (value === undefined) {
    return { ok: true as const, value: undefined };
  }

  if (!Number.isInteger(value) || Number(value) < 0) {
    return {
      ok: false as const,
      error: "order must be a non-negative integer",
    };
  }

  return { ok: true as const, value: Number(value) };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const nameResult = parseOptionalName(body?.name);

  if (!nameResult.ok) {
    return Response.json({ error: nameResult.error }, { status: 400 });
  }

  const orderResult = parseOptionalOrder(body?.order);
  if (!orderResult.ok) {
    return Response.json({ error: orderResult.error }, { status: 400 });
  }

  const defaultViewResult = parseOptionalPreference(
    body?.defaultView,
    ALLOWED_VIEW_MODES,
    "defaultView"
  );
  if (!defaultViewResult.ok) {
    return Response.json({ error: defaultViewResult.error }, { status: 400 });
  }

  const averageBasisResult = parseOptionalPreference(
    body?.averageBasis,
    ALLOWED_AVERAGE_BASES,
    "averageBasis"
  );
  if (!averageBasisResult.ok) {
    return Response.json({ error: averageBasisResult.error }, { status: 400 });
  }

  const data = Object.fromEntries(
    Object.entries({
      name: nameResult.value,
      order: orderResult.value,
      defaultView: defaultViewResult.value,
      averageBasis: averageBasisResult.value,
    }).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error:
          "At least one supported profile field is required",
      },
      { status: 400 }
    );
  }

  const existingProfile = await prisma.profile.findFirst({
    where: {
      id,
      user: {
        email: session.user.email,
      },
    },
    select: { id: true, name: true, userId: true },
  });

  if (!existingProfile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const profile = await prisma.$transaction(async (tx: any) => {
      const updatedProfile = await tx.profile.update({
        where: { id },
        data,
        select: profileSelect,
      });

      if (existingProfile.userId) {
        await createActivityLog(tx as any, {
          userId: existingProfile.userId,
          profileId: updatedProfile.id,
          type: "profile.update",
          description: `Updated profile "${updatedProfile.name}"`,
        });
      }

      return updatedProfile;
    });

    return Response.json(profile);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    throw error;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingProfile = await prisma.profile.findFirst({
    where: {
      id,
      user: {
        email: session.user.email,
      },
    },
    select: { id: true, name: true, userId: true },
  });

  if (!existingProfile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx: any) => {
    if (existingProfile.userId) {
      await createActivityLog(tx as any, {
        userId: existingProfile.userId,
        profileId: existingProfile.id,
        type: "profile.delete",
        description: `Deleted profile "${existingProfile.name}"`,
      });
    }

    await tx.profile.delete({
      where: { id: existingProfile.id },
    });
  });

  return new Response(null, { status: 204 });
}
