import type { NotificationType } from "@prisma/client";
import {
  configurableNotificationTypes,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferenceValue,
} from "@/app/lib/notifications";
import {
  getNotificationUserOr401,
  notificationResponseHeaders,
} from "../shared";

const configurableTypeSet = new Set<NotificationType>(configurableNotificationTypes);

function readBoolean(value: unknown, defaultValue: boolean) {
  return typeof value === "boolean" ? value : defaultValue;
}

function readPreferences(value: unknown): NotificationPreferenceValue[] | null {
  if (!Array.isArray(value)) return null;

  const preferences: NotificationPreferenceValue[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;

    const notificationType = "notificationType" in item ? item.notificationType : null;
    if (
      typeof notificationType !== "string" ||
      !configurableTypeSet.has(notificationType as NotificationType)
    ) {
      return null;
    }

    preferences.push({
      notificationType: notificationType as NotificationType,
      inAppEnabled: readBoolean(
        "inAppEnabled" in item ? item.inAppEnabled : undefined,
        true
      ),
      pushEnabled: readBoolean("pushEnabled" in item ? item.pushEnabled : undefined, false),
    });
  }

  return preferences;
}

export async function GET() {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const preferences = await getNotificationPreferences(currentUser.user.id);
  return Response.json(preferences, { headers: notificationResponseHeaders });
}

export async function PATCH(req: Request) {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "Invalid notification preferences" },
      { status: 400, headers: notificationResponseHeaders }
    );
  }

  const preferences = readPreferences(
    "preferences" in body ? body.preferences : undefined
  );
  if (!preferences) {
    return Response.json(
      { error: "Invalid notification preferences" },
      { status: 400, headers: notificationResponseHeaders }
    );
  }

  const saved = await saveNotificationPreferences(currentUser.user.id, {
    notificationPushEnabled: readBoolean(
      "notificationPushEnabled" in body
        ? body.notificationPushEnabled
        : undefined,
      false
    ),
    preferences,
  });

  return Response.json(saved, { headers: notificationResponseHeaders });
}

export const POST = PATCH;
