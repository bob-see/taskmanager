import { clearAllNotifications } from "@/app/lib/notifications";
import {
  getNotificationUserOr401,
  notificationResponseHeaders,
} from "../shared";

export async function PATCH() {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const result = await clearAllNotifications(currentUser.user.id);
  return Response.json(
    { cleared: result.count },
    { headers: notificationResponseHeaders }
  );
}

export const POST = PATCH;
