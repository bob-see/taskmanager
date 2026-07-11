import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

function hashPushEndpoint(endpoint) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function validateBrowserPushSubscription(value) {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Invalid push subscription" };
  }

  if (!value.keys || typeof value.keys !== "object") {
    return { ok: false, error: "Invalid push subscription keys" };
  }

  if (typeof value.endpoint !== "string" || !value.endpoint.trim()) {
    return { ok: false, error: "Push subscription endpoint is required" };
  }

  if (
    typeof value.keys.p256dh !== "string" ||
    !value.keys.p256dh.trim() ||
    typeof value.keys.auth !== "string" ||
    !value.keys.auth.trim()
  ) {
    return { ok: false, error: "Push subscription keys are required" };
  }

  let endpointUrl;
  try {
    endpointUrl = new URL(value.endpoint.trim());
  } catch {
    return { ok: false, error: "Push subscription endpoint is invalid" };
  }

  if (!["https:", "http:"].includes(endpointUrl.protocol)) {
    return { ok: false, error: "Push subscription endpoint is invalid" };
  }

  return {
    ok: true,
    subscription: {
      endpoint: value.endpoint.trim(),
      keys: {
        p256dh: value.keys.p256dh.trim(),
        auth: value.keys.auth.trim(),
      },
    },
  };
}

test("push endpoint hash is a deterministic sha256 hex digest", () => {
  const endpoint = "https://push.example.test/subscriptions/abc123";
  assert.equal(hashPushEndpoint(endpoint), createHash("sha256").update(endpoint).digest("hex"));
  assert.match(hashPushEndpoint(endpoint), /^[a-f0-9]{64}$/);
});

test("push subscription validation accepts the standard browser shape", () => {
  const result = validateBrowserPushSubscription({
    endpoint: " https://push.example.test/subscriptions/abc123 ",
    keys: {
      p256dh: " p256dh-key ",
      auth: " auth-key ",
    },
    userId: "ignored-client-value",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.subscription, {
    endpoint: "https://push.example.test/subscriptions/abc123",
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key",
    },
  });
});

test("push subscription validation rejects missing keys and unsafe endpoints", () => {
  assert.equal(
    validateBrowserPushSubscription({
      endpoint: "https://push.example.test/subscriptions/abc123",
      keys: { p256dh: "p256dh-key" },
    }).ok,
    false
  );

  assert.equal(
    validateBrowserPushSubscription({
      endpoint: "javascript:alert(1)",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    }).ok,
    false
  );
});
