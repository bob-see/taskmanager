import {
  deletePushSubscriptionForUser,
  listPushSubscriptionsForUser,
  upsertPushSubscriptionForUser,
  validateBrowserPushSubscription,
} from "@/app/lib/push-subscriptions";
import {
  getNotificationUserOr401,
  notificationResponseHeaders,
} from "@/app/api/notifications/shared";

function readRequestUserAgent(req: Request) {
  return req.headers.get("user-agent");
}

export async function GET() {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const result = await listPushSubscriptionsForUser(currentUser.user.id);
  return Response.json(result, { headers: notificationResponseHeaders });
}

export async function POST(req: Request) {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const body = await req.json().catch(() => null);
  const validation = validateBrowserPushSubscription(body);
  if (!validation.ok) {
    return Response.json(
      { error: validation.error },
      { status: 400, headers: notificationResponseHeaders }
    );
  }

  const result = await upsertPushSubscriptionForUser(
    currentUser.user.id,
    validation.subscription,
    { userAgent: readRequestUserAgent(req) }
  );

  return Response.json(result, { headers: notificationResponseHeaders });
}

export async function DELETE(req: Request) {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const body = await req.json().catch(() => null);
  const endpoint =
    body && typeof body === "object" && "endpoint" in body
      ? body.endpoint
      : null;
  const endpointHash =
    body && typeof body === "object" && "endpointHash" in body
      ? body.endpointHash
      : null;

  const result = await deletePushSubscriptionForUser(currentUser.user.id, {
    endpoint: typeof endpoint === "string" ? endpoint : null,
    endpointHash: typeof endpointHash === "string" ? endpointHash : null,
  });

  return Response.json(result, { headers: notificationResponseHeaders });
}
