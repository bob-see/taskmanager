"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProfile = {
  id: string;
  name: string;
};

type AppSidebarProps = {
  profiles: SidebarProfile[];
};

function itemClassName(active: boolean, disabled = false) {
  return [
    "flex items-center rounded-xl px-3 py-2 text-sm transition",
    active
      ? "bg-white text-[color:var(--tm-text)] shadow-sm ring-1 ring-[color:var(--tm-border)]"
      : "text-[color:var(--tm-muted)] hover:bg-white/80 hover:text-[color:var(--tm-text)]",
    disabled ? "cursor-default opacity-60 hover:bg-transparent hover:text-[color:var(--tm-muted)]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function AppSidebar({ profiles }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-[color:var(--tm-border)] bg-[color:var(--tm-card)]/80 md:sticky md:top-0 md:h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="flex h-full flex-col px-4 py-4 md:px-5 md:py-6">
        <div className="mb-5 flex items-center gap-3 px-2">
          <Image
            src="/logo.png"
            alt="TaskManager logo"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div>
            <p className="text-sm font-semibold tracking-tight text-[color:var(--tm-text)]">
              TaskManager
            </p>
            <p className="text-xs text-[color:var(--tm-muted)]">Workspaces</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto">
          <section>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Profiles
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              <Link href="/overview" className={itemClassName(pathname === "/overview")}>
                Overview
              </Link>
              {profiles.map((profile) => {
                const href = `/p/${profile.id}`;
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <Link
                    key={profile.id}
                    href={href}
                    className={itemClassName(active)}
                  >
                    <span className="truncate">{profile.name}</span>
                  </Link>
                );
              })}
            </nav>
          </section>

          <section className="border-t border-[color:var(--tm-border)] pt-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Tools
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              <Link href="/timesheets" className={itemClassName(pathname === "/timesheets")}>
                Timesheets
              </Link>
            </nav>
          </section>

          <section className="border-t border-[color:var(--tm-border)] pt-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Reports
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              <Link href="/reports" className={itemClassName(pathname === "/reports")}>
                Reports
              </Link>
            </nav>
          </section>
        </div>
      </div>
    </aside>
  );
}
