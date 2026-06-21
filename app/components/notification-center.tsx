"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  targetUrl: string;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type NotificationListResponse = {
  notifications: NotificationItem[];
  nextCursor: string | null;
};

const POLL_INTERVAL_MS = 60_000;

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function unreadLabel(count: number) {
  if (count === 0) return "Notifications";
  return `${count} unread notification${count === 1 ? "" : "s"}`;
}

export function NotificationCenter() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || typeof data.count !== "number") {
        throw new Error(data?.error ?? "Could not load unread notifications");
      }

      setUnreadCount(data.count);
    } catch {
      // Polling is opportunistic. Panel loading exposes actionable errors.
    }
  }, []);

  const loadNotifications = useCallback(async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/notifications?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | NotificationListResponse
        | { error?: string }
        | null;

      if (!res.ok || !data || !("notifications" in data)) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Could not load notifications"
        );
      }

      setNotifications((current) =>
        cursor ? [...current, ...data.notifications] : data.notifications
      );
      setNextCursor(data.nextCursor);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load notifications"
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [loadNotifications, open]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function markOneRead(id: string) {
    setError("");

    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error ?? "Could not mark notification as read");
    }

    const readAt = new Date().toISOString();
    const wasUnread = notifications.some(
      (item) => item.id === id && item.readAt === null
    );
    setNotifications((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return { ...item, readAt: item.readAt ?? readAt };
      })
    );
    if (wasUnread) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  }

  async function handleMarkOneRead(id: string) {
    try {
      await markOneRead(id);
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Could not mark notification as read"
      );
    }
  }

  async function handleNotificationClick(item: NotificationItem) {
    if (!item.readAt) {
      try {
        await markOneRead(item.id);
      } catch {
        // Navigation remains useful if updating read state fails.
      }
    }

    setOpen(false);
    router.push(item.targetUrl);
  }

  async function markAllRead() {
    setError("");

    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not mark notifications as read");
      }

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? readAt }))
      );
      setUnreadCount(0);
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Could not mark notifications as read"
      );
    }
  }

  return (
    <div ref={containerRef}>
      <button
        type="button"
        className="tm-button fixed right-[4.75rem] top-3 z-[70] inline-flex h-10 w-10 items-center justify-center rounded-xl border md:left-[13.75rem] md:right-auto md:top-5"
        aria-label={unreadLabel(unreadCount)}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.9 18a3 3 0 0 1-5.8 0m9.4-2.5H5.5c1.1-1.2 1.8-2.7 1.8-4.4V9a4.7 4.7 0 0 1 9.4 0v2.1c0 1.7.7 3.2 1.8 4.4Z"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          id="notification-panel"
          aria-label="Notifications"
          className="tm-card fixed left-3 right-3 top-16 z-[80] max-h-[min(38rem,calc(100vh-5rem))] overflow-hidden rounded-[14px] border shadow-2xl md:left-72 md:right-auto md:top-5 md:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--tm-border)] px-4 py-3">
            <div>
              <h2 className="font-semibold">Notifications</h2>
              <p className="text-xs text-[color:var(--tm-muted)]">
                {unreadCount} unread
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-[color:var(--tm-muted)] underline-offset-4 hover:underline disabled:opacity-50"
                disabled={unreadCount === 0}
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
              <button
                type="button"
                className="tm-button inline-flex h-8 items-center rounded-lg border px-2 text-xs"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[min(32rem,calc(100vh-10rem))] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-[color:var(--tm-muted)]">
                Loading notifications…
              </p>
            ) : error && notifications.length === 0 ? (
              <div className="space-y-3 px-4 py-8 text-center">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  className="tm-button inline-flex h-9 items-center rounded-[10px] border px-3 text-sm"
                  onClick={() => void loadNotifications()}
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">No notifications</p>
                <p className="mt-1 text-xs text-[color:var(--tm-muted)]">
                  New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--tm-border)]">
                {error ? (
                  <p className="bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>
                ) : null}
                {notifications.map((item) => (
                  <article
                    key={item.id}
                    className={`px-4 py-3 ${item.readAt ? "bg-transparent" : "bg-white/60"}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => void handleNotificationClick(item)}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-sky-600"}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-5">
                            {item.title}
                          </span>
                          {item.body ? (
                            <span className="mt-1 block whitespace-pre-wrap text-sm leading-5 text-[color:var(--tm-muted)]">
                              {item.body}
                            </span>
                          ) : null}
                          <span className="mt-1.5 block text-xs text-[color:var(--tm-muted)]">
                            {formatTimestamp(item.createdAt)}
                          </span>
                        </span>
                      </div>
                    </button>
                    {!item.readAt ? (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          className="text-xs font-medium text-[color:var(--tm-muted)] underline-offset-4 hover:underline"
                          onClick={() => void handleMarkOneRead(item.id)}
                        >
                          Mark read
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {nextCursor ? (
                  <div className="p-3 text-center">
                    <button
                      type="button"
                      className="tm-button inline-flex h-9 items-center rounded-[10px] border px-3 text-sm disabled:opacity-50"
                      disabled={loadingMore}
                      onClick={() => void loadNotifications(nextCursor)}
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
