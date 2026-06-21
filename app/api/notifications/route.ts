import { getNotificationUserOr401, notificationResponseHeaders } from "./shared";
import {
  getNotificationsForUser,
  InvalidNotificationCursorError,
} from "@/app/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const requestedLimit = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isInteger(requestedLimit) ? requestedLimit : 20;

  try {
    const result = await getNotificationsForUser(currentUser.user.id, {
      cursor,
      limit,
    });

    return Response.json(result, { headers: notificationResponseHeaders });
  } catch (error) {
    if (error instanceof InvalidNotificationCursorError) {
      return Response.json(
        { error: error.message },
        { status: 400, headers: notificationResponseHeaders }
      );
    }

    throw error;
  }
}
