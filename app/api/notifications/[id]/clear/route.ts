import { clearNotification } from "@/app/lib/notifications";
import {
  getNotificationUserOr401,
  notificationResponseHeaders,
} from "../../shared";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: Ctx) {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const { id } = await ctx.params;
  const cleared = await clearNotification(currentUser.user.id, id);

  if (!cleared) {
    return Response.json(
      { error: "Notification not found" },
      { status: 404, headers: notificationResponseHeaders }
    );
  }

  return Response.json({ cleared: true }, { headers: notificationResponseHeaders });
}

export const POST = PATCH;
