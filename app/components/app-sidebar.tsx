"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { canAccessLost } from "@/app/lost/access";
import { NotificationCenter } from "@/app/components/notification-center";

type SidebarProfile = {
  id: string;
  name: string;
  newTasks: number;
  overdueTasks: number;
};

type ProfileTaskBadgeData = {
  profileId: string;
  newTasks: number;
  overdueTasks: number;
};

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type DelegatedCounts = {
  assignedToMe: number;
  assignedByMe: number;
};

type AppSidebarProps = {
  profiles: SidebarProfile[];
  currentUser: SidebarUser;
  delegatedCounts: DelegatedCounts;
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

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full border border-[color:var(--tm-border)] bg-white/70 px-2 py-0.5 text-xs font-semibold text-[color:var(--tm-muted)]">
      {count}
    </span>
  );
}

function ProfileTaskBadges({ profile }: { profile: SidebarProfile }) {
  if (profile.newTasks <= 0 && profile.overdueTasks <= 0) return null;

  return (
    <span className="ml-auto flex shrink-0 items-center gap-1" aria-label={`${profile.newTasks} new task${profile.newTasks === 1 ? "" : "s"}, ${profile.overdueTasks} overdue task${profile.overdueTasks === 1 ? "" : "s"}`}>
      {profile.newTasks > 0 ? (
        <span
          title={`${profile.newTasks} new task${profile.newTasks === 1 ? "" : "s"}`}
          className="inline-flex min-w-5 items-center justify-center rounded-full border border-emerald-700/25 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(167,243,208,0.72))] px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_3px_rgba(6,95,70,0.12)]"
        >
          {profile.newTasks}
        </span>
      ) : null}
      {profile.overdueTasks > 0 ? (
        <span
          title={`${profile.overdueTasks} overdue task${profile.overdueTasks === 1 ? "" : "s"}`}
          className="inline-flex min-w-5 items-center justify-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
        >
          {profile.overdueTasks}
        </span>
      ) : null}
    </span>
  );
}

export function AppSidebar({
  profiles,
  currentUser,
  delegatedCounts,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveDelegatedCounts, setLiveDelegatedCounts] =
    useState<DelegatedCounts>(delegatedCounts);
  const [liveProfiles, setLiveProfiles] = useState<SidebarProfile[]>(profiles);
  const showLostLink = canAccessLost(currentUser.email);
  const activeProfile = profiles.find((profile) => {
    const href = `/p/${profile.id}`;
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  useEffect(() => {
    setLiveDelegatedCounts(delegatedCounts);
  }, [delegatedCounts]);

  useEffect(() => {
    setLiveProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    let cancelled = false;

    async function refreshDelegatedCounts() {
      try {
        const res = await fetch("/api/delegated/counts", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (
          !cancelled &&
          res.ok &&
          data &&
          typeof data.assignedToMe === "number" &&
          typeof data.assignedByMe === "number"
        ) {
          setLiveDelegatedCounts({
            assignedToMe: data.assignedToMe,
            assignedByMe: data.assignedByMe,
          });
        }
      } catch {
        // Badge refresh is opportunistic; navigation still gets fresh server counts.
      }
    }

    const intervalId = window.setInterval(refreshDelegatedCounts, 60_000);
    void refreshDelegatedCounts();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshProfileTaskBadges() {
      try {
        const res = await fetch("/api/profile-task-badges", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!cancelled && res.ok && Array.isArray(data?.badges)) {
          const badges = (data.badges as unknown[])
              .filter(
                (badge): badge is ProfileTaskBadgeData =>
                  typeof badge === "object" &&
                  badge !== null &&
                  typeof (badge as { profileId?: unknown }).profileId === "string" &&
                  typeof (badge as { newTasks?: unknown }).newTasks === "number" &&
                  typeof (badge as { overdueTasks?: unknown }).overdueTasks === "number"
              );
          const badgesByProfile = new Map<string, ProfileTaskBadgeData>(
            badges.map((badge) => [badge.profileId, badge])
          );

          setLiveProfiles((current) =>
            current.map((profile) => {
              const badge = badgesByProfile.get(profile.id);
              return badge
                ? { ...profile, newTasks: badge.newTasks, overdueTasks: badge.overdueTasks }
                : profile;
            })
          );
        }
      } catch {
        // Badge refresh is opportunistic; the next page load will try again.
      }
    }

    function clearNewTaskBadge(event: Event) {
      const profileId = (event as CustomEvent<{ profileId?: string }>).detail?.profileId;
      if (!profileId) return;

      setLiveProfiles((current) =>
        current.map((profile) =>
          profile.id === profileId ? { ...profile, newTasks: 0 } : profile
        )
      );
    }

    window.addEventListener("profile-task-badge-seen", clearNewTaskBadge);
    const intervalId = window.setInterval(refreshProfileTaskBadges, 60_000);
    void refreshProfileTaskBadges();

    return () => {
      cancelled = true;
      window.removeEventListener("profile-task-badge-seen", clearNewTaskBadge);
      window.clearInterval(intervalId);
    };
  }, []);

  const currentSection =
    activeProfile?.name ??
    (pathname === "/overview"
      ? "Overview"
      : pathname === "/delegated/assigned-to-me"
        ? "Assigned To Me"
      : pathname === "/delegated/assigned-by-me"
        ? "Assigned By Me"
      : pathname === "/spaces"
        ? "Collaborative Spaces"
      : pathname === "/workflows"
        ? "Workflows"
      : pathname === "/timesheets"
        ? "Timesheets"
        : pathname === "/activity"
          ? "Activity"
          : pathname === "/users"
            ? "Users"
            : pathname === "/settings/notifications"
              ? "Notifications"
              : pathname === "/settings/timer"
                ? "Timer"
            : pathname === "/lost"
              ? "Hatch Countdown"
              : pathname === "/reports" || pathname.startsWith("/reports/")
                ? "Reports"
                : "Workspace");

  function renderNavigation(onNavigate?: () => void) {
    return (
      <>
        <Link href="/" className="mb-5 flex items-center gap-3 px-2">
          <Image
            src="/logo.png"
            alt="TaskManager logo"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-[color:var(--tm-text)]">
              TaskManager
            </p>
            <p className="text-xs text-[color:var(--tm-muted)]">Workspaces</p>
          </div>
        </Link>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          <section>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Profiles
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              <Link
                href="/overview"
                className={itemClassName(pathname === "/overview")}
                onClick={onNavigate}
              >
                Overview
              </Link>
              {liveProfiles.map((profile) => {
                const href = `/p/${profile.id}`;
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <Link
                    key={profile.id}
                    href={href}
                    className={itemClassName(active)}
                    onClick={onNavigate}
                  >
                    <span className="truncate">{profile.name}</span>
                    <ProfileTaskBadges profile={profile} />
                  </Link>
                );
              })}
            </nav>
          </section>

          <section className="border-t border-[color:var(--tm-border)] pt-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Delegated
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              <Link
                href="/delegated/assigned-to-me"
                className={itemClassName(pathname === "/delegated/assigned-to-me")}
                onClick={onNavigate}
              >
                <span className="truncate">Assigned To Me</span>
                <CountBadge count={liveDelegatedCounts.assignedToMe} />
              </Link>
              <Link
                href="/delegated/assigned-by-me"
                className={itemClassName(pathname === "/delegated/assigned-by-me")}
                onClick={onNavigate}
              >
                <span className="truncate">Assigned By Me</span>
                <CountBadge count={liveDelegatedCounts.assignedByMe} />
              </Link>
            </nav>
          </section>

          <section className="border-t border-[color:var(--tm-border)] pt-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Tools
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              <Link
                href="/spaces"
                className={itemClassName(pathname === "/spaces")}
                onClick={onNavigate}
              >
                Collaborative Spaces
              </Link>
              <Link
                href="/workflows"
                className={itemClassName(pathname === "/workflows")}
                onClick={onNavigate}
              >
                Workflows
              </Link>
              <Link
                href="/timesheets"
                className={itemClassName(pathname === "/timesheets")}
                onClick={onNavigate}
              >
                Timesheets
              </Link>
              <Link
                href="/activity"
                className={itemClassName(pathname === "/activity")}
                onClick={onNavigate}
              >
                Activity
              </Link>
              {showLostLink ? (
                <Link
                  href="/lost"
                  className={itemClassName(pathname === "/lost")}
                  onClick={onNavigate}
                >
                  LOST
                </Link>
              ) : null}
              {currentUser.role === "admin" ? (
                <Link
                  href="/users"
                  className={itemClassName(pathname === "/users")}
                  onClick={onNavigate}
                >
                  Users
                </Link>
              ) : null}
            </nav>
          </section>

          {currentUser.role === "admin" ? (
            <section className="border-t border-[color:var(--tm-border)] pt-4">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
                Reports
              </p>
              <nav className="mt-2 flex flex-col gap-1">
                <Link
                  href="/reports"
                  className={itemClassName(pathname === "/reports")}
                  onClick={onNavigate}
                >
                  Reports
                </Link>
                <Link
                  href="/reports/user-activity"
                  className={itemClassName(pathname === "/reports/user-activity")}
                  onClick={onNavigate}
                >
                  User Activity
                </Link>
              </nav>
            </section>
          ) : null}

          <section className="border-t border-[color:var(--tm-border)] pt-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Settings
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              <Link
                href="/settings/notifications"
                className={itemClassName(pathname === "/settings/notifications")}
                onClick={onNavigate}
              >
                Notifications
              </Link>
              <Link
                href="/settings/timer"
                className={itemClassName(pathname === "/settings/timer")}
                onClick={onNavigate}
              >
                Timer
              </Link>
            </nav>
          </section>
        </div>
        <div className="mt-auto border-t border-[color:var(--tm-border)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-6">
          <div className="mb-3 px-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
              Logged in as
            </p>
            <p className="mt-1 truncate text-sm font-medium text-[color:var(--tm-text)]">
              {currentUser.name || "User"}
            </p>
            {currentUser.email ? (
              <p className="truncate text-xs text-[color:var(--tm-muted)]">
                {currentUser.email}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={itemClassName(false)}
          >
            Logout
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <NotificationCenter placement="desktop" />
      <header className="sticky top-0 z-40 border-b border-[color:var(--tm-border)] bg-[color:var(--tm-card)]/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="TaskManager logo"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">TaskManager</p>
              <p className="truncate text-xs text-[color:var(--tm-muted)]">{currentSection}</p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {!mobileMenuOpen ? <NotificationCenter placement="mobile" /> : null}
            <button
              type="button"
              className="tm-button inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border px-3 text-sm"
              onClick={() => setMobileMenuOpen(true)}
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      <aside className="hidden shrink-0 border-[color:var(--tm-border)] bg-[color:var(--tm-card)]/80 md:sticky md:top-0 md:flex md:h-screen md:w-72 md:border-r">
        <div className="flex h-full w-full flex-col px-5 py-6">
          {renderNavigation()}
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="tm-card relative flex h-full w-[min(20rem,82vw)] flex-col border-r border-[color:var(--tm-border)] px-4 py-4 shadow-2xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="tm-button inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                Close
              </button>
            </div>
            {renderNavigation(() => setMobileMenuOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}
