import { prisma } from "@/app/lib/prisma";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateInput(
  value: unknown,
  field: string
): { value?: Date | null; error?: Response } {
  if (value === undefined) {
    return {};
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json(
        { error: `${field} must be a YYYY-MM-DD string, ISO string, or null` },
        { status: 400 }
      ),
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      error: Response.json(
        { error: `${field} must not be empty` },
        { status: 400 }
      ),
    };
  }

  let parsed: Date;

  if (DATE_ONLY_RE.test(trimmed)) {
    parsed = new Date(`${trimmed}T12:00:00.000Z`);
  } else {
    parsed = new Date(trimmed);
  }

  if (Number.isNaN(parsed.getTime())) {
    return {
      error: Response.json(
        { error: `${field} must be a valid YYYY-MM-DD string, ISO string, or null` },
        { status: 400 }
      ),
    };
  }

  return { value: parsed };
}

export function parseOptionalTextInput(
  value: unknown,
  field: string
): { value?: string | null; error?: Response } {
  if (value === undefined) {
    return {};
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return {
      error: Response.json(
        { error: `${field} must be a string or null` },
        { status: 400 }
      ),
    };
  }

  const trimmed = value.trim();
  return { value: trimmed ? trimmed : null };
}

export async function ensureProfile(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });

  return profile;
}
