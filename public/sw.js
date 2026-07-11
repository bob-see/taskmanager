self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function safeTaskManagerUrl(value) {
  try {
    const url = new URL(value || "/", self.location.origin);
    if (url.origin !== self.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function applyBadgeCount(value) {
  if (!("setAppBadge" in self.navigator)) return Promise.resolve();
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return Promise.resolve();
  }

  return self.navigator.setAppBadge(value).catch(() => undefined);
}

self.addEventListener("push", (event) => {
  const fallback = {
    title: "TaskManager",
    body: "You have a new TaskManager notification.",
    url: "/",
  };

  let payload = fallback;
  if (event.data) {
    try {
      payload = { ...fallback, ...event.data.json() };
    } catch {
      payload = { ...fallback, body: event.data.text() || fallback.body };
    }
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : fallback.title;
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : fallback.body;
  const url = safeTaskManagerUrl(payload.url);
  const tag =
    typeof payload.tag === "string" && payload.tag.trim()
      ? payload.tag.trim()
      : undefined;
  const badgeCount =
    typeof payload.badgeCount === "number" && Number.isFinite(payload.badgeCount)
      ? payload.badgeCount
      : null;

  event.waitUntil(
    Promise.all([
      applyBadgeCount(badgeCount),
      self.registration.showNotification(title, {
        body,
        tag,
        icon: "/logo.png",
        badge: "/logo.png",
        data: {
          url,
          notificationId: payload.notificationId ?? null,
          type: payload.type ?? null,
        },
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = safeTaskManagerUrl(event.notification.data?.url);
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            if ("navigate" in client && client.url !== targetUrl) {
              return client.navigate(targetUrl).then((navigatedClient) => {
                if (navigatedClient && "focus" in navigatedClient) {
                  return navigatedClient.focus();
                }
                return undefined;
              });
            }
            if ("focus" in client) return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
