import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { deliverWebPushNotification } from "@/app/lib/push-delivery";
import { prisma } from "@/app/lib/prisma";

export const configurableNotificationTypes = [
  "DELEGATED_TASK_RECEIVED",
  "DELEGATED_TASK_ACCEPTED",
  "DELEGATED_TASK_DECLINED",
  "DELEGATED_TASK_NOTE_ADDED",
  "DELEGATED_TASK_COMPLETED",
  "DELEGATED_TASK_CLOSED",
] as const satisfies readonly NotificationType[];

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  targetUrl: true,
  metadata: true,
  readAt: true,
  clearedAt: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export type NotificationDatabase = Pick<
  PrismaClient,
  "notification" | "notificationPreference" | "user"
>;

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

export type NotificationPreferenceValue = {
  notificationType: NotificationType;
  inAppEnabled: boolean;
  pushEnabled: boolean;
};

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
  const type = input.type ?? "GENERAL";

  return createNotificationWithPreferences(
    {
      ...input,
      recipientUserId,
      eventKey,
      title,
      targetUrl,
      type,
    },
    db
  );
}

async function createNotificationWithPreferences(
  input: Required<
    Pick<
      CreateNotificationInput,
      "recipientUserId" | "type" | "title" | "targetUrl" | "eventKey"
    >
  > &
    Omit<
      CreateNotificationInput,
      "recipientUserId" | "type" | "title" | "targetUrl" | "eventKey"
    >,
  db: NotificationDatabase
) {
  const preference = await db.notificationPreference.findUnique({
    where: {
      userId_notificationType: {
        userId: input.recipientUserId,
        notificationType: input.type,
      },
    },
    select: {
      inAppEnabled: true,
    },
  });

  const inAppEnabled = preference?.inAppEnabled ?? true;

  const notification = inAppEnabled
    ? await db.notification.upsert({
        where: { eventKey: input.eventKey },
        update: {},
        create: {
          recipientUserId: input.recipientUserId,
          actorUserId: input.actorUserId?.trim() || null,
          type: input.type,
          title: input.title,
          body: input.body?.trim() || null,
          targetUrl: input.targetUrl,
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          eventKey: input.eventKey,
        },
        select: notificationSelect,
      })
    : null;

  try {
    await deliverWebPushNotification({
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      targetUrl: input.targetUrl,
      notificationId: notification?.id ?? null,
      eventKey: input.eventKey,
    });
  } catch (error) {
    console.warn("[push] delivery failed after notification dispatch", {
      recipientUserId: input.recipientUserId,
      type: input.type,
      eventKey: input.eventKey,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return notification;
}

export async function getNotificationPreferences(
  userId: string,
  db: NotificationDatabase = prisma
) {
  const [user, preferences] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { notificationPushEnabled: true },
    }),
    db.notificationPreference.findMany({
      where: {
        userId,
        notificationType: { in: [...configurableNotificationTypes] },
      },
      select: {
        notificationType: true,
        inAppEnabled: true,
        pushEnabled: true,
      },
    }),
  ]);

  const preferencesByType = new Map(
    preferences.map((preference) => [preference.notificationType, preference])
  );

  return {
    notificationPushEnabled: user?.notificationPushEnabled ?? false,
    preferences: configurableNotificationTypes.map((notificationType) => {
      const preference = preferencesByType.get(notificationType);
      return {
        notificationType,
        inAppEnabled: preference?.inAppEnabled ?? true,
        pushEnabled: preference?.pushEnabled ?? false,
      };
    }),
  };
}

export async function saveNotificationPreferences(
  userId: string,
  input: {
    notificationPushEnabled: boolean;
    preferences: NotificationPreferenceValue[];
  },
  db: NotificationDatabase = prisma
) {
  const allowedTypes = new Set<NotificationType>(configurableNotificationTypes);
  const preferences = input.preferences.filter((preference) =>
    allowedTypes.has(preference.notificationType)
  );

  await db.user.update({
    where: { id: userId },
    data: { notificationPushEnabled: input.notificationPushEnabled },
    select: { id: true },
  });

  await Promise.all(
    preferences.map((preference) =>
      db.notificationPreference.upsert({
        where: {
          userId_notificationType: {
            userId,
            notificationType: preference.notificationType,
          },
        },
        update: {
          inAppEnabled: preference.inAppEnabled,
          pushEnabled: preference.pushEnabled,
        },
        create: {
          userId,
          notificationType: preference.notificationType,
          inAppEnabled: preference.inAppEnabled,
          pushEnabled: preference.pushEnabled,
        },
        select: { id: true },
      })
    )
  );

  return getNotificationPreferences(userId, db);
}

export function getUnreadNotificationCount(
  recipientUserId: string,
  db: NotificationDatabase = prisma
) {
  return db.notification.count({
    where: {
      recipientUserId,
      readAt: null,
      clearedAt: null,
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
    where: { recipientUserId, clearedAt: null },
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
      clearedAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function clearNotification(
  recipientUserId: string,
  notificationId: string,
  db: NotificationDatabase = prisma
) {
  const now = new Date();
  const result = await db.notification.updateMany({
    where: {
      id: notificationId,
      recipientUserId,
      clearedAt: null,
    },
    data: {
      clearedAt: now,
      readAt: now,
    },
  });

  return result.count === 1;
}

export function clearAllNotifications(
  recipientUserId: string,
  db: NotificationDatabase = prisma
) {
  const now = new Date();
  return db.notification.updateMany({
    where: {
      recipientUserId,
      clearedAt: null,
    },
    data: {
      clearedAt: now,
      readAt: now,
    },
  });
}
