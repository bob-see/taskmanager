import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReadOnlySql,
  IMPACT_QUERIES,
  relationshipAuditSql,
  RELATIONSHIPS,
  ROOT_CAUSE_QUERIES,
  runConsistentReadAudit,
  SNAPSHOT_ISOLATION_SQL,
  START_READ_ONLY_SNAPSHOT_SQL,
} from "../scripts/audit-orphan-integrity.mjs";

test("integrity audit covers the 28 Prisma relationships", () => {
  assert.equal(RELATIONSHIPS.length, 28);
  assert.equal(new Set(RELATIONSHIPS.map(({ child, field }) => `${child}.${field}`)).size, 28);
});

test("all integrity audit statements are single read-only aggregate queries", () => {
  const statements = [
    ...RELATIONSHIPS.map(relationshipAuditSql),
    ...IMPACT_QUERIES.map(({ sql }) => sql),
    ...ROOT_CAUSE_QUERIES.map(({ sql }) => sql),
  ];

  for (const sql of statements) {
    assert.doesNotThrow(() => assertReadOnlySql(sql));
    assert.match(sql.trim(), /^(SELECT|WITH)/i);
    assert.equal(sql.includes(";"), false);
  }
});

test("integrity audit rejects mutation statements and mutation keywords", () => {
  assert.throws(() => assertReadOnlySql("DELETE FROM task"), /refused/);
  assert.throws(
    () => assertReadOnlySql("SELECT 1; UPDATE task SET title = 'unsafe'"),
    /refused/,
  );
});

test("integrity audit uses one read-only consistent snapshot and rolls it back", async () => {
  const events = [];
  const connection = {
    async query(sql) {
      events.push(sql);
    },
    async rollback() {
      events.push("ROLLBACK");
    },
  };
  const expectedResult = { relationships: [] };

  const result = await runConsistentReadAudit(connection, async (auditConnection) => {
    assert.equal(auditConnection, connection);
    events.push("AUDIT");
    return expectedResult;
  });

  assert.equal(result, expectedResult);
  assert.deepEqual(events, [
    SNAPSHOT_ISOLATION_SQL,
    START_READ_ONLY_SNAPSHOT_SQL,
    "AUDIT",
    "ROLLBACK",
  ]);
});

test("integrity audit rolls back its snapshot when a query fails", async () => {
  const events = [];
  const connection = {
    async query(sql) {
      events.push(sql);
    },
    async rollback() {
      events.push("ROLLBACK");
    },
  };
  const auditError = new Error("query failed");

  await assert.rejects(
    runConsistentReadAudit(connection, async () => {
      events.push("AUDIT");
      throw auditError;
    }),
    auditError,
  );

  assert.deepEqual(events, [
    SNAPSHOT_ISOLATION_SQL,
    START_READ_ONLY_SNAPSHOT_SQL,
    "AUDIT",
    "ROLLBACK",
  ]);
});
