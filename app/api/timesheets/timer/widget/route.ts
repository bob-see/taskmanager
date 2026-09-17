import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, timerWidgetEnabled: true } });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ timerWidgetEnabled: user.timerWidgetEnabled }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body?.timerWidgetEnabled !== "boolean") {
    return Response.json({ error: "timerWidgetEnabled must be a boolean" }, { status: 400 });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { timerWidgetEnabled: body.timerWidgetEnabled },
    select: { timerWidgetEnabled: true },
  });
  return Response.json(updated, { headers: { "Cache-Control": "no-store" } });
}
