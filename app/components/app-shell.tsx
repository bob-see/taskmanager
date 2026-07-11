import type { ReactNode } from "react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { ServiceWorkerRegistration } from "@/app/components/service-worker-registration";
import { HatchStatusWidget } from "@/app/lost/hatch-status-widget";
import { LostTimerProvider } from "@/app/lost/lost-timer-provider";

type ShellProfile = {
  id: string;
  name: string;
};

type ShellUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type DelegatedCounts = {
  assignedToMe: number;
  assignedByMe: number;
};

type AppShellProps = {
  children: ReactNode;
  profiles: ShellProfile[];
  currentUser: ShellUser;
  delegatedCounts: DelegatedCounts;
  showLostAccess: boolean;
};

export function AppShell({
  children,
  profiles,
  currentUser,
  delegatedCounts,
  showLostAccess,
}: AppShellProps) {
  const shell = (
    <div className="min-h-screen overflow-x-clip bg-[color:var(--tm-bg)] text-[color:var(--tm-text)] md:flex">
      <AppSidebar
        profiles={profiles}
        currentUser={currentUser}
        delegatedCounts={delegatedCounts}
      />
      <div className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">{children}</div>
      {showLostAccess ? <HatchStatusWidget /> : null}
      <ServiceWorkerRegistration />
    </div>
  );

  return showLostAccess ? <LostTimerProvider>{shell}</LostTimerProvider> : shell;
}
