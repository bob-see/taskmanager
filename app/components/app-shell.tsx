import type { ReactNode } from "react";
import { AppSidebar } from "@/app/components/app-sidebar";

type ShellProfile = {
  id: string;
  name: string;
};

type ShellUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type AppShellProps = {
  children: ReactNode;
  profiles: ShellProfile[];
  currentUser: ShellUser;
};

export function AppShell({ children, profiles, currentUser }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[color:var(--tm-bg)] text-[color:var(--tm-text)] md:flex">
      <AppSidebar profiles={profiles} currentUser={currentUser} />
      <div className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  );
}
