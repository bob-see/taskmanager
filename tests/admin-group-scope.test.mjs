import assert from "node:assert/strict";
import test from "node:test";

import { resolveAdminGroupScope } from "../app/lib/admin-group-scope.ts";

test("standard users do not receive an empty admin scope", () => {
  assert.equal(
    resolveAdminGroupScope({ role: "user" }, ["personal"]),
    null
  );
});

test("one-group admins retain their restricted scope", () => {
  assert.deepEqual(
    resolveAdminGroupScope({ role: "admin" }, ["personal"]),
    ["personal"]
  );
});

test("admins with zero or multiple groups retain global access", () => {
  assert.equal(resolveAdminGroupScope({ role: "admin" }, []), null);
  assert.equal(
    resolveAdminGroupScope({ role: "admin" }, ["dream", "personal"]),
    null
  );
});
