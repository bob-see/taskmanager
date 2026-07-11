# Push Notifications

TaskManager currently supports browser push subscription infrastructure only.

Implemented in Commit 4:

- Stable web app manifest identity.
- Root-scoped service worker registration.
- Push event and notification-click handlers for future delivery.
- Authenticated push subscription status, subscribe and unsubscribe APIs.
- Multi-device `PushSubscription` storage for each user.
- Settings -> Notifications controls for enabling and disabling browser notifications on the current device.
- Stored global and per-type push preferences.

Not implemented until the push delivery commit:

- Sending Web Push from delegated task events.
- Sending Web Push from any other application event.
- App badge updates.
- Push retry, batching or delivery failure reporting.

## Environment Variables

Required for subscription support:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@example.com"
```

Only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is available to browser code. Keep
`VAPID_PRIVATE_KEY` server-only in local environment files and Vercel
environment variables. `VAPID_SUBJECT` should be a valid `mailto:` or HTTPS
contact value.

Generate a local VAPID key pair with:

```bash
npx web-push generate-vapid-keys
```

Add the generated public key to `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key
to `VAPID_PRIVATE_KEY`, and an appropriate contact value to `VAPID_SUBJECT` in
local configuration and Vercel.

## iPhone Home Screen Requirement

On iPhone and iPad, browser notifications require TaskManager to be installed
to the Home Screen and opened from the installed icon. If TaskManager is opened
in Safari, Settings -> Notifications explains that the user should add the app
to the Home Screen before enabling notifications.

## Commit Boundary

Commit 4 stores subscriptions and preferences only. Delegated task actions still
create in-app notifications only. Push delivery should be implemented in the next
commit by reading stored subscriptions, checking `notificationPushEnabled` plus
per-type push preferences, and sending Web Push from the existing notification
dispatcher.
