import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  targetUrl: true,
  metadata: true,
  readAt: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export type NotificationDatabase = Pick<PrismaClient, "notification">;

export type CreateNotificationInput = {
  recipientUserId: string;
  actorUserId?: string | null;
  type?: NotificationType;
  title: string;
  body?: string | null;
  targetUrl: string;
  metadata?: Prisma.InputJsonValue;
  eventKey: string;
};

export class InvalidNotificationCursorError extends Error {
  constructor() {
    super("Invalid notification cursor");
    this.name = "InvalidNotificationCursorError";
  }
}

function requireText(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function requireInternalTargetUrl(value: string) {
  const normalized = requireText(value, "targetUrl");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    throw new Error("targetUrl must be an internal application path");
  }
  return normalized;
}

export function createNotification(
  input: CreateNotificationInput,
  db: NotificationDatabase = prisma
) {
  const recipientUserId = requireText(input.recipientUserId, "recipientUserId");
  const eventKey = requireText(input.eventKey, "eventKey");
  const title = requireText(input.title, "title");
  const targetUrl = requireInternalTargetUrl(input.targetUrl);

  return db.notification.upsert({
    where: { eventKey },
    update: {},
    create: {
      recipientUserId,
      actorUserId: input.actorUserId?.trim() || null,
      type: input.type ?? "GENERAL",
      title,
      body: input.body?.trim() || null,
      targetUrl,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      eventKey,
    },
    select: notificationSelect,
  });
}

export function getUnreadNotificationCount(
  recipientUserId: string,
  db: NotificationDatabase = prisma
) {
  return db.notification.count({
    where: {
      recipientUserId,
      readAt: null,
    },
  });
}

export async function getNotificationsForUser(
  recipientUserId: string,
  options: { cursor?: string | null; limit?: number } = {},
  db: NotificationDatabase = prisma
) {
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const cursor = options.cursor?.trim() || null;

  if (cursor) {
    const ownedCursor = await db.notification.findFirst({
      where: {
        id: cursor,
        recipientUserId,
      },
      select: { id: true },
    });

    if (!ownedCursor) {
      throw new InvalidNotificationCursorError();
    }
  }

  const rows = await db.notification.findMany({
    where: { recipientUserId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: notificationSelect,
  });

  const hasMore = rows.length > limit;
  const notifications = hasMore ? rows.slice(0, limit) : rows;

  return {
    notifications,
    nextCursor: hasMore ? notifications.at(-1)?.id ?? null : null,
  };
}

export async function markNotificationRead(
  recipientUserId: string,
  notificationId: string,
  db: NotificationDatabase = prisma
) {
  const result = await db.notification.updateMany({
    where: {
      id: notificationId,
      recipientUserId,
    },
    data: {
      readAt: new Date(),
    },
  });

  return result.count === 1;
}

export function markAllNotificationsRead(
  recipientUserId: string,
  db: NotificationDatabase = prisma
) {
  return db.notification.updateMany({
    where: {
      recipientUserId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}
