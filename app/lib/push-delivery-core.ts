export type PushDeliveryInput = {
  recipientUserId: string;
  type: string;
  title: string;
  body?: string | null;
  targetUrl: string;
  notificationId?: string | null;
  eventKey?: string | null;
};

export type PushDeliveryResult = {
  attempted: number;
  delivered: number;
  failed: number;
  expiredRemoved: number;
  skippedReason:
    | "global-disabled"
    | "type-disabled"
    | "no-subscriptions"
    | "missing-vapid"
    | null;
};

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  endpointHash: string;
  p256dh: string;
  auth: string;
};

export type PushDeliveryCoreDatabase = {
  user: {
    findUnique(input: {
      where: { id: string };
      select: { notificationPushEnabled: true };
    }): Promise<{ notificationPushEnabled: boolean } | null>;
  };
  notificationPreference: {
    findUnique(input: {
      where: {
        userId_notificationType: {
          userId: string;
          notificationType: string;
        };
      };
      select: { pushEnabled: true };
    }): Promise<{ pushEnabled: boolean } | null>;
  };
  pushSubscription: {
    findMany(input: {
      where: { userId: string };
      select: {
        id: true;
        endpoint: true;
        endpointHash: true;
        p256dh: true;
        auth: true;
      };
    }): Promise<PushSubscriptionRow[]>;
    updateMany(input: {
      where: { id: string; userId: string };
      data: { lastUsedAt: Date };
    }): Promise<unknown>;
    deleteMany(input: {
      where: { id: string; userId: string };
    }): Promise<unknown>;
  };
  notification: {
    count(input: {
      where: {
        recipientUserId: string;
        readAt: null;
        clearedAt: null;
      };
    }): Promise<number>;
  };
};

export type PushDeliveryTransport = {
  sendNotification(
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload: string,
    options: { TTL: number }
  ): Promise<unknown>;
};

export type PushDeliveryLogger = {
  info(message: string, detail: Record<string, unknown>): void;
  warn(message: string, detail: Record<string, unknown>): void;
};

export type PushDeliveryConfigResult =
  | { ok: true }
  | { ok: false; reason: string };

const emptyDeliveryResult: PushDeliveryResult = {
  attempted: 0,
  delivered: 0,
  failed: 0,
  expiredRemoved: 0,
  skippedReason: null,
};

export function sanitizePushTargetUrl(value: string) {
  try {
    const url = new URL(value, "https://taskmanager.local");
    if (url.origin !== "https://taskmanager.local") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function buildPushPayload(
  input: PushDeliveryInput,
  badgeCount: number | null
) {
  return JSON.stringify({
    title: input.title,
    body: input.body?.trim() || undefined,
    url: sanitizePushTargetUrl(input.targetUrl),
    tag: input.eventKey?.trim() || input.notificationId || `${input.type}:untagged`,
    notificationId: input.notificationId ?? null,
    type: input.type,
    badgeCount,
  });
}

export function isExpiredPushSubscriptionError(error: unknown) {
  const statusCode =
    error && typeof error === "object" && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode
      : null;
  return statusCode === 404 || statusCode === 410;
}

async function getPushEligibility(
  db: PushDeliveryCoreDatabase,
  recipientUserId: string,
  type: string
) {
  const [user, preference] = await Promise.all([
    db.user.findUnique({
      where: { id: recipientUserId },
      select: { notificationPushEnabled: true },
    }),
    db.notificationPreference.findUnique({
      where: {
        userId_notificationType: {
          userId: recipientUserId,
          notificationType: type,
        },
      },
      select: { pushEnabled: true },
    }),
  ]);

  if (!user?.notificationPushEnabled) return "global-disabled" as const;
  if (!preference?.pushEnabled) return "type-disabled" as const;
  return null;
}

export async function deliverWebPushNotificationCore(
  input: PushDeliveryInput,
  options: {
    db: PushDeliveryCoreDatabase;
    transport: PushDeliveryTransport;
    configureVapid: () => PushDeliveryConfigResult;
    logger: PushDeliveryLogger;
  }
): Promise<PushDeliveryResult> {
  const { db, transport, configureVapid, logger } = options;
  const skipped = await getPushEligibility(db, input.recipientUserId, input.type);

  if (skipped) {
    logger.info(`skipped: ${skipped}`, {
      recipientUserId: input.recipientUserId,
      type: input.type,
      eventKey: input.eventKey,
    });
    return { ...emptyDeliveryResult, skippedReason: skipped };
  }

  const vapid = configureVapid();
  if (!vapid.ok) {
    logger.warn("skipped: missing-vapid", {
      reason: vapid.reason,
      recipientUserId: input.recipientUserId,
      type: input.type,
      eventKey: input.eventKey,
    });
    return { ...emptyDeliveryResult, skippedReason: "missing-vapid" };
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: input.recipientUserId },
    select: {
      id: true,
      endpoint: true,
      endpointHash: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    logger.info("skipped: no-subscriptions", {
      recipientUserId: input.recipientUserId,
      type: input.type,
      eventKey: input.eventKey,
    });
    return { ...emptyDeliveryResult, skippedReason: "no-subscriptions" };
  }

  const badgeCount = await db.notification.count({
    where: {
      recipientUserId: input.recipientUserId,
      readAt: null,
      clearedAt: null,
    },
  });
  const payload = buildPushPayload(input, badgeCount);
  const result: PushDeliveryResult = { ...emptyDeliveryResult };

  await Promise.all(
    subscriptions.map(async (subscription) => {
      result.attempted += 1;

      try {
        await transport.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { TTL: 60 * 60 }
        );
        result.delivered += 1;

        try {
          await db.pushSubscription.updateMany({
            where: { id: subscription.id, userId: input.recipientUserId },
            data: { lastUsedAt: new Date() },
          });
        } catch (lastUsedError) {
          logger.warn("lastUsedAt update failed", {
            subscriptionId: subscription.id,
            endpointHash: subscription.endpointHash,
            error:
              lastUsedError instanceof Error
                ? lastUsedError.message
                : "Unknown error",
          });
        }
      } catch (sendError) {
        if (isExpiredPushSubscriptionError(sendError)) {
          result.expiredRemoved += 1;
          await db.pushSubscription.deleteMany({
            where: { id: subscription.id, userId: input.recipientUserId },
          });
          return;
        }

        result.failed += 1;
        logger.warn("temporary delivery failure", {
          subscriptionId: subscription.id,
          endpointHash: subscription.endpointHash,
          statusCode:
            sendError && typeof sendError === "object" && "statusCode" in sendError
              ? (sendError as { statusCode?: unknown }).statusCode
              : null,
          error: sendError instanceof Error ? sendError.message : "Unknown error",
        });
      }
    })
  );

  logger.info("delivery result", {
    recipientUserId: input.recipientUserId,
    type: input.type,
    eventKey: input.eventKey,
    attempted: result.attempted,
    delivered: result.delivered,
    failed: result.failed,
    expiredRemoved: result.expiredRemoved,
  });

  return result;
}
