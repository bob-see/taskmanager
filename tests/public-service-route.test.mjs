import assert from "node:assert/strict";
import test from "node:test";

import { isPublicServiceRoute } from "../app/lib/public-service-route.ts";

test("cron routes bypass session redirects so their own authorization can run", () => {
  assert.equal(isPublicServiceRoute("/api/cron/daily-task-digest"), true);
});

test("ordinary application API routes remain protected by the proxy", () => {
  assert.equal(isPublicServiceRoute("/api/delegated/users"), false);
});
