# Push Notifications

TaskManager supports browser Web Push for delegated task notifications.

## Architecture

Notification delivery starts in the existing notification dispatcher:

```text
Delegated task event
  -> notification dispatcher
     -> in-app Notification row, when in-app preference allows it
     -> Web Push delivery, when global and per-type push preferences allow it
```

The push path reuses:

- `Notification.type`
- `NotificationPreference.pushEnabled`
- `User.notificationPushEnabled`
- `PushSubscription`
- existing delegated task target URLs
- the root-scoped service worker at `/sw.js`

Push delivery is handled by `app/lib/push-delivery.ts` and the testable core in
`app/lib/push-delivery-core.ts`. It uses the `web-push` package server-side.

## Commit Boundaries

Commit 4 added subscription infrastructure: manifest identity, service worker,
subscription APIs, settings UI and `PushSubscription` storage.

Commit 5 connects the dispatcher to Web Push for delegated task events:

- New delegated task
- Accepted
- Declined
- Note added
- Completed
- Closed

No separate notification system exists. Non-delegated application events do not
send push unless they are later routed through the dispatcher with push
preferences.

## Environment Variables

Required:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@example.com"
```

Only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is available to browser code. Keep
`VAPID_PRIVATE_KEY` server-only in local environment files and Vercel
environment variables. `VAPID_SUBJECT` must be a valid `mailto:` or HTTPS
contact value.

Generate a VAPID key pair with:

```bash
npx web-push generate-vapid-keys
```

## Preference Logic

Push is sent only when both conditions are true:

- `User.notificationPushEnabled`
- the matching `NotificationPreference.pushEnabled`

Missing `NotificationPreference` rows default to push disabled. This keeps
existing users opt-in for push delivery.

In-app delivery is independent:

- In-app enabled, Push disabled: in-app row only.
- In-app disabled, Push enabled: push only.
- Both enabled: both channels.
- Both disabled: no delivery.

## Multiple Devices

Each browser or installed app stores its own `PushSubscription`. Delivery is
attempted independently for every active subscription belonging to the recipient.
One failed device does not block the other devices.

When delivery succeeds, `PushSubscription.lastUsedAt` is updated for that
subscription.

## Expired Subscription Cleanup

If the push provider returns `404` or `410`, TaskManager deletes only that exact
subscription row and continues with the remaining devices.

Temporary failures are logged and kept for a future delivery attempt.

Logs intentionally avoid full endpoints, push keys and VAPID private keys.

## Payload

Push payloads are concise JSON:

```json
{
  "title": "New delegated task",
  "body": "Bob assigned you: Call vendor",
  "url": "/delegated/assigned-to-me",
  "tag": "delegated:task-id:created",
  "notificationId": "notification-id-or-null",
  "type": "DELEGATED_TASK_RECEIVED",
  "badgeCount": 3
}
```

The body reuses the in-app notification copy. The URL must be a same-origin app
path. The service worker rejects external URLs.

## Deep Links

Notification clicks:

- close the browser notification
- focus an existing TaskManager window when one exists
- navigate that window to the target path when needed
- otherwise open a new TaskManager window

Current delegated task targets:

- Assignee events: `/delegated/assigned-to-me`
- Delegator events: `/delegated/assigned-by-me`

If the session has expired, normal authentication redirect behaviour applies.

## Badge Support

The push payload includes `badgeCount`, based on the recipient's unread in-app
notification count at send time.

The service worker calls the Badging API when available. Badge updates are
progressive enhancement only. Reading or clearing notifications does not yet
perform full real-time badge synchronisation.

## iPhone Home Screen Requirement

On iPhone and iPad, browser notifications require TaskManager to be installed to
the Home Screen and opened from the installed icon. If TaskManager is opened in
Safari, Settings -> Notifications explains that the user should add the app to
the Home Screen before enabling notifications.

## Desktop Manual Test

1. Subscribe Bob and Ella on separate browsers or browser profiles.
2. Enable Browser Notifications globally.
3. Enable Push for New delegated task.
4. Close or background Ella's TaskManager window.
5. Bob delegates a task to Ella.
6. Confirm Ella receives a desktop notification.
7. Click it.
8. Confirm TaskManager opens or focuses on Assigned To Me.
9. Disable the New delegated task Push preference.
10. Delegate another task.
11. Confirm in-app notification behaviour follows its own preference and no Push appears.
12. Test accept, decline, note, complete and close.
13. Confirm multiple subscribed devices receive alerts.

## iPhone Manual Test

1. Confirm Ella's account has a valid iPhone `PushSubscription`.
2. Open the installed Home Screen TaskManager app.
3. Enable Browser Notifications globally.
4. Enable Push for New delegated task.
5. Close TaskManager completely or leave it backgrounded.
6. From Bob's account, delegate a new task to Ella.
7. Confirm Ella receives an iOS Lock Screen or banner notification.
8. Confirm title and body are correct.
9. Tap the notification.
10. Confirm the installed TaskManager app opens.
11. Confirm it navigates to the appropriate delegated task route.
12. Accept the task as Ella.
13. Confirm Bob receives Push if his preference and subscription are enabled.
14. Test note, complete and close flows.
15. Turn off one per-type Push preference and confirm only that category stops.
16. Confirm in-app settings remain independent.
17. Disable Browser Notifications on Ella's iPhone and confirm further Push delivery stops.

## Troubleshooting

- Permission denied: browser settings must be changed by the user before TaskManager can request permission again.
- No active subscription: use Settings -> Notifications -> Repair Subscription.
- Expired subscription: a `404` or `410` provider response removes only the stale device row.
- VAPID misconfiguration: delivery is skipped with a server-side warning; delegated actions still complete.
- Push received but click route fails: verify the payload URL is a same-origin path and the user is still authenticated.
- Push absent while in-app appears: verify `notificationPushEnabled`, the per-type Push toggle, active subscriptions and VAPID environment variables.
