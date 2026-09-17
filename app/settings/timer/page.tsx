import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { TimerSettingsClient } from "./timer-settings-client";

export default async function TimerSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return notFound();
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { timerWidgetEnabled: true },
  });
  if (!user) return notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Timer</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--tm-muted)]">Choose whether the compact Timesheet timer is available throughout TaskManager for your account.</p>
      </div>
      <TimerSettingsClient initialEnabled={user.timerWidgetEnabled} />
    </main>
  );
}
