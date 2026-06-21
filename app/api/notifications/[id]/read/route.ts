import { markNotificationRead } from "@/app/lib/notifications";
import {
  getNotificationUserOr401,
  notificationResponseHeaders,
} from "../../shared";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: Ctx) {
  const currentUser = await getNotificationUserOr401();
  if (currentUser.error) return currentUser.error;

  const { id } = await ctx.params;
  const marked = await markNotificationRead(currentUser.user.id, id);

  if (!marked) {
    return Response.json(
      { error: "Notification not found" },
      { status: 404, headers: notificationResponseHeaders }
    );
  }

  return Response.json({ read: true }, { headers: notificationResponseHeaders });
}

export const POST = PATCH;
