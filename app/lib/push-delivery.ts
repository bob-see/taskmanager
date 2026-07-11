import type { NotificationType } from "@prisma/client";
import webPush from "web-push";
import {
  deliverWebPushNotificationCore,
  sanitizePushTargetUrl,
  type PushDeliveryCoreDatabase,
  type PushDeliveryResult,
} from "./push-delivery-core";
import { prisma } from "./prisma";

export type PushDeliveryInput = {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  targetUrl: string;
  notificationId?: string | null;
  eventKey?: string | null;
};

type VapidConfig =
  | {
      ok: true;
      publicKey: string;
      privateKey: string;
      subject: string;
    }
  | {
      ok: false;
      reason: string;
    };

let configuredVapidSignature: string | null = null;

function readVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    return { ok: false, reason: "missing VAPID environment variables" };
  }

  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    return { ok: false, reason: "VAPID_SUBJECT must be mailto: or https://" };
  }

  return { ok: true, publicKey, privateKey, subject };
}

function configureVapid() {
  const config = readVapidConfig();
  if (!config.ok) return config;

  const signature = `${config.subject}:${config.publicKey}`;
  if (configuredVapidSignature !== signature) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredVapidSignature = signature;
  }

  return { ok: true as const };
}

const logger = {
  info(message: string, detail: Record<string, unknown>) {
    console.info("[push]", message, detail);
  },
  warn(message: string, detail: Record<string, unknown>) {
    console.warn("[push]", message, detail);
  },
};

const pushDeliveryDb: PushDeliveryCoreDatabase = {
  user: {
    findUnique(input) {
      return prisma.user.findUnique(input);
    },
  },
  notificationPreference: {
    findUnique(input) {
      return prisma.notificationPreference.findUnique({
        where: {
          userId_notificationType: {
            userId: input.where.userId_notificationType.userId,
            notificationType: input.where.userId_notificationType
              .notificationType as NotificationType,
          },
        },
        select: input.select,
      });
    },
  },
  pushSubscription: {
    findMany(input) {
      return prisma.pushSubscription.findMany(input);
    },
    updateMany(input) {
      return prisma.pushSubscription.updateMany(input);
    },
    deleteMany(input) {
      return prisma.pushSubscription.deleteMany(input);
    },
  },
  notification: {
    count(input) {
      return prisma.notification.count(input);
    },
  },
};

export { sanitizePushTargetUrl };
export type { PushDeliveryResult };

export function deliverWebPushNotification(
  input: PushDeliveryInput
): Promise<PushDeliveryResult> {
  return deliverWebPushNotificationCore(input, {
    db: pushDeliveryDb,
    transport: webPush,
    configureVapid,
    logger,
  });
}
