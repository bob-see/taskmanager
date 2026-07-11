import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

type PushSubscriptionDatabase = Pick<
  PrismaClient,
  "pushSubscription" | "user"
>;

export type BrowserPushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushSubscriptionValidationResult =
  | { ok: true; subscription: BrowserPushSubscriptionInput }
  | { ok: false; error: string };

const endpointHashPattern = /^[a-f0-9]{64}$/;

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isUsableText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function hashPushEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export function isEndpointHash(value: unknown): value is string {
  return typeof value === "string" && endpointHashPattern.test(value);
}

export function validateBrowserPushSubscription(
  value: unknown
): PushSubscriptionValidationResult {
  const body = readObject(value);
  if (!body) return { ok: false, error: "Invalid push subscription" };

  const keys = readObject(body.keys);
  if (!keys) return { ok: false, error: "Invalid push subscription keys" };

  if (!isUsableText(body.endpoint, 4096)) {
    return { ok: false, error: "Push subscription endpoint is required" };
  }
  const endpoint = body.endpoint.trim();

  if (!isUsableText(keys.p256dh, 255) || !isUsableText(keys.auth, 255)) {
    return { ok: false, error: "Push subscription keys are required" };
  }
  const p256dh = keys.p256dh.trim();
  const auth = keys.auth.trim();

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return { ok: false, error: "Push subscription endpoint is invalid" };
  }

  if (!["https:", "http:"].includes(endpointUrl.protocol)) {
    return { ok: false, error: "Push subscription endpoint is invalid" };
  }

  return {
    ok: true,
    subscription: {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
    },
  };
}

export function normalizeUserAgent(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.length > 1000 ? normalized.slice(0, 1000) : normalized;
}

export async function listPushSubscriptionsForUser(
  userId: string,
  db: PushSubscriptionDatabase = prisma
) {
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      endpointHash: true,
      userAgent: true,
      deviceLabel: true,
      createdAt: true,
      updatedAt: true,
      lastUsedAt: true,
    },
  });

  return {
    subscriptions,
    count: subscriptions.length,
  };
}

export async function upsertPushSubscriptionForUser(
  userId: string,
  input: BrowserPushSubscriptionInput,
  options: { userAgent?: string | null } = {},
  db: PushSubscriptionDatabase = prisma
) {
  const now = new Date();
  const endpointHash = hashPushEndpoint(input.endpoint);

  await db.pushSubscription.upsert({
    where: { endpointHash },
    update: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: normalizeUserAgent(options.userAgent ?? null),
      lastUsedAt: now,
    },
    create: {
      userId,
      endpoint: input.endpoint,
      endpointHash,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: normalizeUserAgent(options.userAgent ?? null),
      lastUsedAt: now,
    },
    select: { id: true },
  });

  return listPushSubscriptionsForUser(userId, db);
}

export async function deletePushSubscriptionForUser(
  userId: string,
  input: { endpoint?: string | null; endpointHash?: string | null },
  db: PushSubscriptionDatabase = prisma
) {
  const endpointHash =
    input.endpointHash && isEndpointHash(input.endpointHash)
      ? input.endpointHash
      : input.endpoint
        ? hashPushEndpoint(input.endpoint)
        : null;

  if (!endpointHash) {
    return listPushSubscriptionsForUser(userId, db);
  }

  await db.pushSubscription.deleteMany({
    where: {
      userId,
      endpointHash,
    },
  });

  return listPushSubscriptionsForUser(userId, db);
}
