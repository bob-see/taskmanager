"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type NotificationPreference = {
  notificationType: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
};

type SavedPushSubscription = {
  endpointHash: string;
  userAgent: string | null;
  deviceLabel: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

type SubscriptionStatus =
  | "loading"
  | "unsupported"
  | "ios-not-installed"
  | "missing-config"
  | "not-requested"
  | "denied"
  | "subscribed"
  | "missing-subscription"
  | "failed"
  | "unsubscribed";

type NotificationSettingsClientProps = {
  initialNotificationPushEnabled: boolean;
  initialPreferences: NotificationPreference[];
};

const labels: Record<string, string> = {
  DELEGATED_TASK_RECEIVED: "New delegated task",
  DELEGATED_TASK_ACCEPTED: "Task accepted",
  DELEGATED_TASK_DECLINED: "Task declined",
  DELEGATED_TASK_NOTE_ADDED: "Task note",
  DELEGATED_TASK_COMPLETED: "Task completed",
  DELEGATED_TASK_CLOSED: "Task closed",
};

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function toggleClass(enabled: boolean, disabled = false) {
  return [
    "inline-flex min-h-9 items-center justify-center rounded-[10px] border px-3 text-sm font-medium transition",
    enabled
      ? "border-[color:var(--tm-text)] bg-[color:var(--tm-text)] text-white"
      : "tm-button",
    disabled ? "cursor-not-allowed opacity-55" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function actionButtonClass(kind: "primary" | "secondary" = "secondary") {
  return [
    kind === "primary" ? "tm-button-primary" : "tm-button",
    "inline-flex min-h-10 items-center justify-center rounded-[10px] border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" ");
}

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isAppleMobileDevice() {
  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function hasPushSupport() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

async function hashEndpoint(endpoint: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getOrRegisterServiceWorker() {
  const existingRegistration = await navigator.serviceWorker.getRegistration("/");
  if (existingRegistration) return existingRegistration;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function readSavedSubscriptions() {
  const res = await fetch("/api/push-subscriptions", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !Array.isArray(data.subscriptions)) {
    throw new Error(data?.error ?? "Could not read push subscription status");
  }
  return data as {
    subscriptions: SavedPushSubscription[];
    count: number;
  };
}

export function NotificationSettingsClient({
  initialNotificationPushEnabled,
  initialPreferences,
}: NotificationSettingsClientProps) {
  const [notificationPushEnabled, setNotificationPushEnabled] = useState(
    initialNotificationPushEnabled
  );
  const [preferences, setPreferences] = useState(initialPreferences);
  const [savedPreferences, setSavedPreferences] = useState(initialPreferences);
  const [savedNotificationPushEnabled, setSavedNotificationPushEnabled] = useState(
    initialNotificationPushEnabled
  );
  const [pushStatus, setPushStatus] = useState<SubscriptionStatus>("loading");
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [pushError, setPushError] = useState("");
  const [busyPushAction, setBusyPushAction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasChanges = useMemo(
    () =>
      JSON.stringify({
        notificationPushEnabled,
        preferences,
      }) !==
      JSON.stringify({
        notificationPushEnabled: savedNotificationPushEnabled,
        preferences: savedPreferences,
      }),
    [
      notificationPushEnabled,
      preferences,
      savedNotificationPushEnabled,
      savedPreferences,
    ]
  );

  const saveNotificationSettings = useCallback(
    async (nextPushEnabled = notificationPushEnabled, nextPreferences = preferences) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPushEnabled: nextPushEnabled,
          preferences: nextPreferences,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !Array.isArray(data.preferences)) {
        throw new Error(data?.error ?? "Could not save notification settings");
      }

      setNotificationPushEnabled(data.notificationPushEnabled);
      setSavedNotificationPushEnabled(data.notificationPushEnabled);
      setPreferences(data.preferences);
      setSavedPreferences(data.preferences);
      return data;
    },
    [notificationPushEnabled, preferences]
  );

  const refreshPushStatus = useCallback(async () => {
    setPushStatus("loading");
    setPushError("");
    setStatusMessage("");

    if (isAppleMobileDevice() && !isStandaloneDisplay()) {
      setPushStatus("ios-not-installed");
      setStatusMessage(
        "To enable notifications on iPhone, add TaskManager to your Home Screen and open it from the new icon."
      );
      return;
    }

    if (!hasPushSupport()) {
      setPushStatus("unsupported");
      setStatusMessage("Browser notifications are not supported on this device.");
      return;
    }

    if (!vapidPublicKey) {
      setPushStatus("missing-config");
      setStatusMessage("Browser notifications need a VAPID public key before they can be enabled.");
      return;
    }

    if (Notification.permission === "denied") {
      setPushStatus("denied");
      setStatusMessage("Notification permission is blocked for this browser.");
      return;
    }

    try {
      const [registration, saved] = await Promise.all([
        getOrRegisterServiceWorker(),
        readSavedSubscriptions(),
      ]);
      const browserSubscription =
        await registration.pushManager.getSubscription();
      setSubscriptionCount(saved.count);

      if (browserSubscription) {
        const browserEndpointHash = await hashEndpoint(browserSubscription.endpoint);
        const storedForThisBrowser = saved.subscriptions.some(
          (subscription) => subscription.endpointHash === browserEndpointHash
        );

        if (storedForThisBrowser) {
          setPushStatus("subscribed");
          setStatusMessage(
            saved.count > 1
              ? `Browser notifications are enabled on this device and ${saved.count - 1} other device${saved.count === 2 ? "" : "s"}.`
              : "Browser notifications are enabled on this device."
          );
          return;
        }
      }

      if (Notification.permission === "granted") {
        setPushStatus("missing-subscription");
        setStatusMessage(
          "Notification permission is granted, but this browser does not have an active saved subscription."
        );
        return;
      }

      setPushStatus("not-requested");
      setStatusMessage("Browser notifications are available but not enabled on this device.");
    } catch (statusError) {
      setPushStatus("failed");
      setPushError(
        statusError instanceof Error
          ? statusError.message
          : "Could not check browser notification status"
      );
    }
  }, []);

  useEffect(() => {
    void refreshPushStatus();
  }, [refreshPushStatus]);

  function setInAppEnabled(notificationType: string, inAppEnabled: boolean) {
    setPreferences((current) =>
      current.map((preference) =>
        preference.notificationType === notificationType
          ? { ...preference, inAppEnabled }
          : preference
      )
    );
  }

  function setPushEnabled(notificationType: string, pushEnabled: boolean) {
    setPreferences((current) =>
      current.map((preference) =>
        preference.notificationType === notificationType
          ? { ...preference, pushEnabled }
          : preference
      )
    );
  }

  async function enableBrowserNotifications() {
    setBusyPushAction(true);
    setPushError("");
    setMessage("");
    setError("");

    try {
      if (isAppleMobileDevice() && !isStandaloneDisplay()) {
        setPushStatus("ios-not-installed");
        setStatusMessage(
          "To enable notifications on iPhone, add TaskManager to your Home Screen and open it from the new icon."
        );
        return;
      }

      if (!hasPushSupport()) {
        setPushStatus("unsupported");
        setStatusMessage("Browser notifications are not supported on this device.");
        return;
      }

      if (!vapidPublicKey) {
        setPushStatus("missing-config");
        setStatusMessage("Browser notifications need a VAPID public key before they can be enabled.");
        return;
      }

      if (Notification.permission === "denied") {
        setPushStatus("denied");
        setStatusMessage("Notification permission is blocked for this browser.");
        return;
      }

      const registration = await getOrRegisterServiceWorker();
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "denied" : "not-requested");
        setStatusMessage("Browser notifications were not enabled.");
        return;
      }

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const res = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.subscriptions)) {
        throw new Error(data?.error ?? "Could not save browser subscription");
      }

      setSubscriptionCount(data.count);
      await saveNotificationSettings(true);
      setPushStatus("subscribed");
      setStatusMessage("Browser notifications are enabled on this device.");
      await refreshPushStatus();
    } catch (enableError) {
      setPushStatus("failed");
      setPushError(
        enableError instanceof Error
          ? enableError.message
          : "Could not enable browser notifications"
      );
    } finally {
      setBusyPushAction(false);
    }
  }

  async function disableBrowserNotifications() {
    setBusyPushAction(true);
    setPushError("");
    setMessage("");
    setError("");

    try {
      if (!hasPushSupport()) {
        setPushStatus("unsupported");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      const browserSubscription =
        await registration?.pushManager.getSubscription();

      let endpoint: string | null = null;
      if (browserSubscription) {
        endpoint = browserSubscription.endpoint;
        await browserSubscription.unsubscribe();
      }

      const res = await fetch("/api/push-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data.count !== "number") {
        throw new Error(data?.error ?? "Could not remove browser subscription");
      }

      setSubscriptionCount(data.count);
      const nextPushEnabled = data.count > 0;
      await saveNotificationSettings(nextPushEnabled);
      setPushStatus("unsubscribed");
      setStatusMessage(
        nextPushEnabled
          ? "Browser notifications are disabled on this device. Other device subscriptions remain enabled."
          : "Browser notifications are disabled."
      );
    } catch (disableError) {
      setPushStatus("failed");
      setPushError(
        disableError instanceof Error
          ? disableError.message
          : "Could not disable browser notifications"
      );
    } finally {
      setBusyPushAction(false);
    }
  }

  async function savePreferences() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await saveNotificationSettings(notificationPushEnabled, preferences);
      setMessage("Notification settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save notification settings"
      );
    } finally {
      setSaving(false);
    }
  }

  const canEnable =
    pushStatus === "not-requested" ||
    pushStatus === "missing-subscription" ||
    pushStatus === "unsubscribed" ||
    pushStatus === "failed";
  const canDisable = pushStatus === "subscribed";

  return (
    <div className="space-y-6">
      <section className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            <h2 className="text-base font-semibold">Global</h2>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              Enable this browser or installed app to receive future push notifications.
            </p>
            <div aria-live="polite" className="mt-3 min-h-5 text-sm">
              {pushStatus === "loading" ? (
                <p className="text-[color:var(--tm-muted)]">Checking browser notification support...</p>
              ) : null}
              {statusMessage ? (
                <p className="text-[color:var(--tm-muted)]">{statusMessage}</p>
              ) : null}
              {pushError ? <p className="text-red-700">{pushError}</p> : null}
              {subscriptionCount > 0 && pushStatus !== "subscribed" ? (
                <p className="mt-1 text-xs text-[color:var(--tm-muted)]">
                  Saved device subscriptions: {subscriptionCount}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {canEnable ? (
              <button
                type="button"
                className={actionButtonClass("primary")}
                disabled={busyPushAction}
                onClick={() => void enableBrowserNotifications()}
              >
                {pushStatus === "missing-subscription" ? "Repair Subscription" : "Enable Browser Notifications"}
              </button>
            ) : null}
            {canDisable ? (
              <button
                type="button"
                className={actionButtonClass()}
                disabled={busyPushAction}
                onClick={() => void disableBrowserNotifications()}
              >
                Disable Browser Notifications
              </button>
            ) : null}
            {pushStatus === "failed" ? (
              <button
                type="button"
                className={actionButtonClass()}
                disabled={busyPushAction}
                onClick={() => void refreshPushStatus()}
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="tm-card rounded-[14px] border shadow-sm">
        <div className="border-b border-[color:var(--tm-border)] p-4 md:p-5">
          <h2 className="text-base font-semibold">Delegated Tasks</h2>
          <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
            Delegated task events use these settings for both in-app and Push notifications.
          </p>
        </div>
        <div className="divide-y divide-[color:var(--tm-border)]">
          {preferences.map((preference) => (
            <div
              key={preference.notificationType}
              className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-5"
            >
              <div>
                <p className="text-sm font-medium">
                  {labels[preference.notificationType] ?? preference.notificationType}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={toggleClass(preference.inAppEnabled)}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={preference.inAppEnabled}
                    onChange={(event) =>
                      setInAppEnabled(
                        preference.notificationType,
                        event.target.checked
                      )
                    }
                  />
                  In-App
                </label>
                <label className={toggleClass(preference.pushEnabled)}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={preference.pushEnabled}
                    onChange={(event) =>
                      setPushEnabled(
                        preference.notificationType,
                        event.target.checked
                      )
                    }
                  />
                  Push
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-sm">
          {error ? <p className="text-red-700">{error}</p> : null}
          {message && !error ? (
            <p className="text-[color:var(--tm-muted)]">{message}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-4 text-sm disabled:opacity-50"
          disabled={saving || busyPushAction || !hasChanges}
          onClick={() => void savePreferences()}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
