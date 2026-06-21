import { getUnreadNotificationCount } from "@/app/lib/notifications";
import {
  getNotificationUserOr401,
  notificationResponseHeaders,
} from "../shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const count = await getUnreadNotificationCount(currentUser.user.id);
  return Response.json({ count }, { headers: notificationResponseHeaders });
}
