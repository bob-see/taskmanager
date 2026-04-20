import type { ReactNode } from "react";
import { AppSidebar } from "@/app/components/app-sidebar";

type ShellProfile = {
  id: string;
  name: string;
};

type AppShellProps = {
  children: ReactNode;
  profiles: ShellProfile[];
};

export function AppShell({ children, profiles }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--tm-bg)] text-[color:var(--tm-text)] md:flex">
      <AppSidebar profiles={profiles} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
