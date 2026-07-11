import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { getNotificationPreferences } from "@/app/lib/notifications";
import { NotificationSettingsClient } from "./notification-settings-client";

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!currentUser) return notFound();

  const settings = await getNotificationPreferences(currentUser.id);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
          Settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Notifications
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--tm-muted)]">
          Choose which delegated task events appear in the notification centre.
        </p>
      </div>

      <NotificationSettingsClient
        initialNotificationPushEnabled={settings.notificationPushEnabled}
        initialPreferences={settings.preferences}
      />
    </main>
  );
}
