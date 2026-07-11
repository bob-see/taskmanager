"use client";

import { useMemo, useState } from "react";

type NotificationPreference = {
  notificationType: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
};

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

export function NotificationSettingsClient({
  initialNotificationPushEnabled,
  initialPreferences,
}: NotificationSettingsClientProps) {
  const [notificationPushEnabled] = useState(initialNotificationPushEnabled);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [savedPreferences, setSavedPreferences] = useState(initialPreferences);
  const [savedNotificationPushEnabled] = useState(initialNotificationPushEnabled);
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

  function setInAppEnabled(notificationType: string, inAppEnabled: boolean) {
    setPreferences((current) =>
      current.map((preference) =>
        preference.notificationType === notificationType
          ? { ...preference, inAppEnabled }
          : preference
      )
    );
  }

  async function savePreferences() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPushEnabled,
          preferences,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !Array.isArray(data.preferences)) {
        throw new Error(data?.error ?? "Could not save notification settings");
      }

      setPreferences(data.preferences);
      setSavedPreferences(data.preferences);
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

  return (
    <div className="space-y-6">
      <section className="tm-card rounded-[14px] border p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Global</h2>
            <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
              Browser push notifications become active in the next release.
            </p>
          </div>
          <label className={toggleClass(notificationPushEnabled, true)}>
            <input
              type="checkbox"
              className="sr-only"
              checked={notificationPushEnabled}
              disabled
              readOnly
            />
            Browser Push
          </label>
        </div>
      </section>

      <section className="tm-card rounded-[14px] border shadow-sm">
        <div className="border-b border-[color:var(--tm-border)] p-4 md:p-5">
          <h2 className="text-base font-semibold">Delegated Tasks</h2>
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
                <div className="flex items-center gap-2">
                  <label className={toggleClass(preference.pushEnabled, true)}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={preference.pushEnabled}
                      disabled
                      readOnly
                    />
                    Push
                  </label>
                  <span className="text-xs text-[color:var(--tm-muted)]">
                    Next release
                  </span>
                </div>
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
          disabled={saving || !hasChanges}
          onClick={() => void savePreferences()}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
