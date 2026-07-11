import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPushPayload,
  deliverWebPushNotificationCore,
  sanitizePushTargetUrl,
} from "../app/lib/push-delivery-core.ts";

const baseInput = {
  recipientUserId: "user-1",
  type: "DELEGATED_TASK_RECEIVED",
  title: "New delegated task",
  body: "Bob assigned you: Call vendor",
  targetUrl: "/delegated/assigned-to-me",
  notificationId: "notification-1",
  eventKey: "delegated:task-1:created",
};

function subscription(id) {
  return {
    id,
    endpoint: `https://push.example.test/${id}`,
    endpointHash: `hash-${id}`,
    p256dh: `p256dh-${id}`,
    auth: `auth-${id}`,
  };
}

function createMockDb(options = {}) {
  const state = {
    globalEnabled: options.globalEnabled ?? true,
    pushEnabled: options.pushEnabled ?? true,
    subscriptions: options.subscriptions ?? [subscription("a")],
    unreadCount: options.unreadCount ?? 3,
    updated: [],
    deleted: [],
  };

  return {
    state,
    db: {
      user: {
        async findUnique() {
          return { notificationPushEnabled: state.globalEnabled };
        },
      },
      notificationPreference: {
        async findUnique() {
          return options.preferenceMissing
            ? null
            : { pushEnabled: state.pushEnabled };
        },
      },
      pushSubscription: {
        async findMany() {
          return state.subscriptions;
        },
        async updateMany(input) {
          state.updated.push(input);
        },
        async deleteMany(input) {
          state.deleted.push(input);
        },
      },
      notification: {
        async count() {
          return state.unreadCount;
        },
      },
    },
  };
}

function createLogger() {
  return {
    info: () => {},
    warn: () => {},
  };
}

function createTransport(handler = async () => {}) {
  const calls = [];
  return {
    calls,
    transport: {
      async sendNotification(...args) {
        calls.push(args);
        return handler(...args);
      },
    },
  };
}

test("global push disabled is skipped", async () => {
  const { db } = createMockDb({ globalEnabled: false });
  const { calls, transport } = createTransport();

  const result = await deliverWebPushNotificationCore(baseInput, {
    db,
    transport,
    configureVapid: () => ({ ok: true }),
    logger: createLogger(),
  });

  assert.equal(result.skippedReason, "global-disabled");
  assert.equal(calls.length, 0);
});

test("missing or disabled per-type preference is skipped", async () => {
  for (const options of [{ pushEnabled: false }, { preferenceMissing: true }]) {
    const { db } = createMockDb(options);
    const { calls, transport } = createTransport();

    const result = await deliverWebPushNotificationCore(baseInput, {
      db,
      transport,
      configureVapid: () => ({ ok: true }),
      logger: createLogger(),
    });

    assert.equal(result.skippedReason, "type-disabled");
    assert.equal(calls.length, 0);
  }
});

test("missing vapid configuration skips safely", async () => {
  const { db } = createMockDb();
  const { calls, transport } = createTransport();

  const result = await deliverWebPushNotificationCore(baseInput, {
    db,
    transport,
    configureVapid: () => ({ ok: false, reason: "missing" }),
    logger: createLogger(),
  });

  assert.equal(result.skippedReason, "missing-vapid");
  assert.equal(calls.length, 0);
});

test("no subscriptions is skipped", async () => {
  const { db } = createMockDb({ subscriptions: [] });
  const { calls, transport } = createTransport();

  const result = await deliverWebPushNotificationCore(baseInput, {
    db,
    transport,
    configureVapid: () => ({ ok: true }),
    logger: createLogger(),
  });

  assert.equal(result.skippedReason, "no-subscriptions");
  assert.equal(calls.length, 0);
});

test("multiple subscriptions are all attempted and successful deliveries update lastUsedAt", async () => {
  const { db, state } = createMockDb({
    subscriptions: [subscription("a"), subscription("b")],
  });
  const { calls, transport } = createTransport();

  const result = await deliverWebPushNotificationCore(baseInput, {
    db,
    transport,
    configureVapid: () => ({ ok: true }),
    logger: createLogger(),
  });

  assert.equal(result.attempted, 2);
  assert.equal(result.delivered, 2);
  assert.equal(result.failed, 0);
  assert.equal(calls.length, 2);
  assert.equal(state.updated.length, 2);
});

test("one temporary failure does not block other subscriptions", async () => {
  const { db, state } = createMockDb({
    subscriptions: [subscription("a"), subscription("b")],
  });
  const { calls, transport } = createTransport(async (pushSubscription) => {
    if (pushSubscription.endpoint.endsWith("/a")) {
      const error = new Error("temporary failure");
      error.statusCode = 500;
      throw error;
    }
  });

  const result = await deliverWebPushNotificationCore(baseInput, {
    db,
    transport,
    configureVapid: () => ({ ok: true }),
    logger: createLogger(),
  });

  assert.equal(result.attempted, 2);
  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 1);
  assert.equal(calls.length, 2);
  assert.equal(state.updated.length, 1);
});

test("404 and 410 responses remove only the expired subscription", async () => {
  for (const statusCode of [404, 410]) {
    const { db, state } = createMockDb({
      subscriptions: [subscription("a"), subscription("b")],
    });
    const { transport } = createTransport(async (pushSubscription) => {
      if (pushSubscription.endpoint.endsWith("/a")) {
        const error = new Error("expired");
        error.statusCode = statusCode;
        throw error;
      }
    });

    const result = await deliverWebPushNotificationCore(baseInput, {
      db,
      transport,
      configureVapid: () => ({ ok: true }),
      logger: createLogger(),
    });

    assert.equal(result.expiredRemoved, 1);
    assert.equal(result.delivered, 1);
    assert.deepEqual(state.deleted[0].where, {
      id: "a",
      userId: baseInput.recipientUserId,
    });
  }
});

test("in-app disabled does not affect push delivery when push preferences allow it", async () => {
  const { db } = createMockDb();
  const { calls, transport } = createTransport();

  const result = await deliverWebPushNotificationCore(
    { ...baseInput, notificationId: null },
    {
      db,
      transport,
      configureVapid: () => ({ ok: true }),
      logger: createLogger(),
    }
  );

  assert.equal(result.delivered, 1);
  const payload = JSON.parse(calls[0][1]);
  assert.equal(payload.notificationId, null);
  assert.equal(payload.url, "/delegated/assigned-to-me");
});

test("push target urls are limited to same-origin paths", () => {
  assert.equal(sanitizePushTargetUrl("/delegated/assigned-by-me"), "/delegated/assigned-by-me");
  assert.equal(sanitizePushTargetUrl("https://evil.example.test/steal"), "/");
  assert.equal(sanitizePushTargetUrl("//evil.example.test/steal"), "/");
});

test("payload mapping keeps delegated notification fields concise", () => {
  const payload = JSON.parse(buildPushPayload(baseInput, 7));

  assert.deepEqual(payload, {
    title: "New delegated task",
    body: "Bob assigned you: Call vendor",
    url: "/delegated/assigned-to-me",
    tag: "delegated:task-1:created",
    notificationId: "notification-1",
    type: "DELEGATED_TASK_RECEIVED",
    badgeCount: 7,
  });
});
