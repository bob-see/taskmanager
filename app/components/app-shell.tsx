import type { ReactNode } from "react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { HatchStatusWidget } from "@/app/lost/hatch-status-widget";

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
};

export function AppShell({
  children,
  profiles,
  currentUser,
  delegatedCounts,
}: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[color:var(--tm-bg)] text-[color:var(--tm-text)] md:flex">
      <AppSidebar
        profiles={profiles}
        currentUser={currentUser}
        delegatedCounts={delegatedCounts}
      />
      <div className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">{children}</div>
      <HatchStatusWidget />
    </div>
  );
}
