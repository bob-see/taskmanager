#!/usr/bin/env node

import "dotenv/config";
import mysql from "mysql2/promise";

export const RELATIONSHIPS = [
  { child: "notification", field: "recipientUserId", parent: "user", required: true, onDelete: "Cascade", createdAt: true },
  { child: "notification", field: "actorUserId", parent: "user", required: false, onDelete: "SetNull", createdAt: true },
  { child: "notificationpreference", field: "userId", parent: "user", required: true, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "pushsubscription", field: "userId", parent: "user", required: true, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "usergroupmember", field: "userId", parent: "user", required: true, onDelete: "Cascade", createdAt: true },
  { child: "usergroupmember", field: "groupId", parent: "usergroup", required: true, onDelete: "Cascade", createdAt: true },
  { child: "task", field: "profileId", parent: "profile", required: false, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "task", field: "projectId", parent: "project", required: false, onDelete: "SetNull", createdAt: true, updatedAt: true },
  { child: "delegatedtask", field: "taskId", parent: "task", required: true, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "delegatedtask", field: "assignedByUserId", parent: "user", required: false, onDelete: "SetNull", createdAt: true, updatedAt: true },
  { child: "delegatedtask", field: "assignedToUserId", parent: "user", required: false, onDelete: "SetNull", createdAt: true, updatedAt: true },
  { child: "tasknote", field: "taskId", parent: "task", required: true, onDelete: "Cascade", createdAt: true },
  { child: "tasknote", field: "userId", parent: "user", required: false, onDelete: "SetNull", createdAt: true },
  { child: "profile", field: "userId", parent: "user", required: false, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "sundaycheckin", field: "profileId", parent: "profile", required: true, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "project", field: "profileId", parent: "profile", required: true, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "timeentry", field: "profileId", parent: "profile", required: true, onDelete: "Cascade", createdAt: true, updatedAt: true },
  { child: "spacemember", field: "spaceId", parent: "collaborativespace", required: true, onDelete: "Cascade" },
  { child: "spacemember", field: "userId", parent: "user", required: true, onDelete: "Cascade" },
  { child: "matrixrow", field: "spaceId", parent: "collaborativespace", required: true, onDelete: "Cascade", cuidCreatedAt: true },
  { child: "matrixcolumn", field: "spaceId", parent: "collaborativespace", required: true, onDelete: "Cascade", cuidCreatedAt: true },
  { child: "columnstatusoption", field: "columnId", parent: "matrixcolumn", required: true, onDelete: "Cascade" },
  { child: "matrixcell", field: "rowId", parent: "matrixrow", required: true, onDelete: "Cascade", updatedAt: true },
  { child: "matrixcell", field: "columnId", parent: "matrixcolumn", required: true, onDelete: "Cascade", updatedAt: true },
  { child: "matrixcell", field: "statusOptionId", parent: "columnstatusoption", required: false, onDelete: "SetNull", updatedAt: true },
  { child: "matrixcell", field: "userIdValue", parent: "user", required: false, onDelete: "SetNull", updatedAt: true },
  { child: "matrixcellnote", field: "cellId", parent: "matrixcell", required: true, onDelete: "Cascade", createdAt: true },
  { child: "matrixcellnote", field: "userId", parent: "user", required: true, onDelete: "Cascade", createdAt: true },
];

const quote = (identifier) => `\`${identifier}\``;

export function assertReadOnlySql(sql) {
  const normalised = sql.trim().replace(/^\(+/, "").toUpperCase();
  if (!normalised.startsWith("SELECT") && !normalised.startsWith("WITH")) {
    throw new Error("Integrity audit refused a non-read-only SQL statement");
  }
  const sqlWithoutStringLiterals = sql.replace(/'(?:''|[^'])*'/g, "''");
  if (/\b(INSERT|UPDATE|DELETE|ALTER|TRUNCATE|DROP|REPLACE|CREATE|RENAME|GRANT|REVOKE)\b/i.test(sqlWithoutStringLiterals)) {
    throw new Error("Integrity audit refused SQL containing a mutation keyword");
  }
}

export function relationshipAuditSql(relationship) {
  const timestampSelections = [];
  if (relationship.createdAt) {
    timestampSelections.push("MIN(c.`createdAt`) AS oldestCreatedAt", "MAX(c.`createdAt`) AS newestCreatedAt");
  }
  if (relationship.updatedAt) {
    timestampSelections.push("MIN(c.`updatedAt`) AS oldestUpdatedAt", "MAX(c.`updatedAt`) AS newestUpdatedAt");
  }
  if (relationship.cuidCreatedAt) {
    timestampSelections.push(
      "SUM(c.`id` REGEXP '^c[0-9a-z]{24}$') AS cuidCount",
      "FROM_UNIXTIME(MIN(CONV(SUBSTRING(c.`id`, 2, 8), 36, 10)) / 1000) AS inferredOldestCreatedAt",
      "FROM_UNIXTIME(MAX(CONV(SUBSTRING(c.`id`, 2, 8), 36, 10)) / 1000) AS inferredNewestCreatedAt",
    );
  }

  return `SELECT COUNT(*) AS orphanCount,
    COUNT(DISTINCT c.${quote(relationship.field)}) AS missingParentCount${timestampSelections.length ? `,\n    ${timestampSelections.join(",\n    ")}` : ""}
  FROM ${quote(relationship.child)} c
  LEFT JOIN ${quote(relationship.parent)} p ON p.\`id\` = c.${quote(relationship.field)}
  WHERE c.${quote(relationship.field)} IS NOT NULL AND p.\`id\` IS NULL`;
}

export const IMPACT_QUERIES = [
  {
    name: "task.profileId",
    sql: `SELECT
      COUNT(DISTINCT CASE WHEN t.\`completedAt\` IS NULL THEN t.\`id\` END) AS openCount,
      COUNT(DISTINCT d.\`id\`) AS delegatedReferenceCount,
      COUNT(DISTINCT n.\`id\`) AS noteReferenceCount,
      COUNT(DISTINCT a.\`id\`) AS activityReferenceCount
    FROM \`task\` t
    LEFT JOIN \`profile\` p ON p.\`id\` = t.\`profileId\`
    LEFT JOIN \`delegatedtask\` d ON d.\`taskId\` = t.\`id\`
    LEFT JOIN \`tasknote\` n ON n.\`taskId\` = t.\`id\`
    LEFT JOIN \`activitylog\` a ON a.\`taskId\` = t.\`id\`
    WHERE t.\`profileId\` IS NOT NULL AND p.\`id\` IS NULL`,
  },
  {
    name: "task.projectId",
    sql: `SELECT
      COUNT(DISTINCT CASE WHEN t.\`completedAt\` IS NULL THEN t.\`id\` END) AS openCount,
      COUNT(DISTINCT CASE WHEN owned.\`id\` IS NOT NULL THEN t.\`id\` END) AS taskWithExistingProfileCount,
      COUNT(DISTINCT a.\`id\`) AS activityReferenceCount
    FROM \`task\` t
    LEFT JOIN \`project\` p ON p.\`id\` = t.\`projectId\`
    LEFT JOIN \`profile\` owned ON owned.\`id\` = t.\`profileId\`
    LEFT JOIN \`activitylog\` a ON a.\`taskId\` = t.\`id\`
    WHERE t.\`projectId\` IS NOT NULL AND p.\`id\` IS NULL`,
  },
  {
    name: "tasknote.taskId",
    sql: `SELECT COUNT(DISTINCT n.\`taskId\`) AS missingTaskCount
    FROM \`tasknote\` n
    LEFT JOIN \`task\` t ON t.\`id\` = n.\`taskId\`
    WHERE t.\`id\` IS NULL`,
  },
  {
    name: "project.profileId",
    sql: `SELECT
      COUNT(DISTINCT CASE WHEN p.\`archived\` = FALSE THEN p.\`id\` END) AS unarchivedCount,
      COUNT(DISTINCT t.\`id\`) AS taskReferenceCount,
      COUNT(DISTINCT a.\`id\`) AS activityReferenceCount
    FROM \`project\` p
    LEFT JOIN \`profile\` owner ON owner.\`id\` = p.\`profileId\`
    LEFT JOIN \`task\` t ON t.\`projectId\` = p.\`id\`
    LEFT JOIN \`activitylog\` a ON a.\`projectId\` = p.\`id\`
    WHERE owner.\`id\` IS NULL`,
  },
  {
    name: "timeentry.profileId",
    sql: `SELECT
      COUNT(DISTINCT CASE WHEN e.\`endTime\` IS NULL THEN e.\`id\` END) AS activeTimerCount,
      COUNT(DISTINCT a.\`id\`) AS activityReferenceCount
    FROM \`timeentry\` e
    LEFT JOIN \`profile\` p ON p.\`id\` = e.\`profileId\`
    LEFT JOIN \`activitylog\` a ON a.\`timeEntryId\` = e.\`id\`
    WHERE p.\`id\` IS NULL`,
  },
  {
    name: "matrixcolumn.spaceId",
    sql: `SELECT
      COUNT(DISTINCT CASE WHEN c.\`archivedAt\` IS NULL THEN c.\`id\` END) AS unarchivedCount,
      COUNT(DISTINCT o.\`id\`) AS statusOptionReferenceCount,
      COUNT(DISTINCT cell.\`id\`) AS cellReferenceCount,
      COUNT(DISTINCT note.\`id\`) AS cellNoteReferenceCount
    FROM \`matrixcolumn\` c
    LEFT JOIN \`collaborativespace\` s ON s.\`id\` = c.\`spaceId\`
    LEFT JOIN \`columnstatusoption\` o ON o.\`columnId\` = c.\`id\`
    LEFT JOIN \`matrixcell\` cell ON cell.\`columnId\` = c.\`id\`
    LEFT JOIN \`matrixcellnote\` note ON note.\`cellId\` = cell.\`id\`
    WHERE s.\`id\` IS NULL`,
  },
  {
    name: "matrixrow.spaceId",
    sql: `SELECT
      COUNT(DISTINCT CASE WHEN r.\`isDone\` = FALSE THEN r.\`id\` END) AS notDoneCount,
      COUNT(DISTINCT cell.\`id\`) AS cellReferenceCount,
      COUNT(DISTINCT note.\`id\`) AS cellNoteReferenceCount
    FROM \`matrixrow\` r
    LEFT JOIN \`collaborativespace\` s ON s.\`id\` = r.\`spaceId\`
    LEFT JOIN \`matrixcell\` cell ON cell.\`rowId\` = r.\`id\`
    LEFT JOIN \`matrixcellnote\` note ON note.\`cellId\` = cell.\`id\`
    WHERE s.\`id\` IS NULL`,
  },
];

export const ROOT_CAUSE_QUERIES = [
  {
    name: "missing-profile-overlap",
    sql: `WITH missing AS (
      SELECT t.\`profileId\` AS parentId, 'task' AS source FROM \`task\` t LEFT JOIN \`profile\` p ON p.\`id\` = t.\`profileId\` WHERE t.\`profileId\` IS NOT NULL AND p.\`id\` IS NULL
      UNION ALL
      SELECT project.\`profileId\`, 'project' FROM \`project\` project LEFT JOIN \`profile\` p ON p.\`id\` = project.\`profileId\` WHERE p.\`id\` IS NULL
      UNION ALL
      SELECT e.\`profileId\`, 'timeentry' FROM \`timeentry\` e LEFT JOIN \`profile\` p ON p.\`id\` = e.\`profileId\` WHERE p.\`id\` IS NULL
    ), parents AS (SELECT DISTINCT parentId FROM missing)
    SELECT COUNT(*) AS distinctMissingProfileCount,
      SUM(EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'task')) AS referencedByTaskCount,
      SUM(EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'project')) AS referencedByProjectCount,
      SUM(EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'timeentry')) AS referencedByTimeEntryCount,
      SUM((EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'task')) + (EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'project')) + (EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'timeentry')) > 1) AS sharedAcrossClassesCount
    FROM parents`,
  },
  {
    name: "missing-space-overlap",
    sql: `WITH missing AS (
      SELECT r.\`spaceId\` AS parentId, 'row' AS source FROM \`matrixrow\` r LEFT JOIN \`collaborativespace\` s ON s.\`id\` = r.\`spaceId\` WHERE s.\`id\` IS NULL
      UNION ALL
      SELECT c.\`spaceId\`, 'column' FROM \`matrixcolumn\` c LEFT JOIN \`collaborativespace\` s ON s.\`id\` = c.\`spaceId\` WHERE s.\`id\` IS NULL
    ), parents AS (SELECT DISTINCT parentId FROM missing)
    SELECT COUNT(*) AS distinctMissingSpaceCount,
      SUM(EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'row')) AS referencedByRowCount,
      SUM(EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'column')) AS referencedByColumnCount,
      SUM((EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'row')) AND (EXISTS(SELECT 1 FROM missing m WHERE m.parentId = parents.parentId AND m.source = 'column'))) AS sharedAcrossClassesCount
    FROM parents`,
  },
  {
    name: "missing-profile-activity",
    sql: `WITH missing AS (
      SELECT t.\`profileId\` AS parentId FROM \`task\` t LEFT JOIN \`profile\` p ON p.\`id\` = t.\`profileId\` WHERE t.\`profileId\` IS NOT NULL AND p.\`id\` IS NULL
      UNION SELECT project.\`profileId\` FROM \`project\` project LEFT JOIN \`profile\` p ON p.\`id\` = project.\`profileId\` WHERE p.\`id\` IS NULL
      UNION SELECT e.\`profileId\` FROM \`timeentry\` e LEFT JOIN \`profile\` p ON p.\`id\` = e.\`profileId\` WHERE p.\`id\` IS NULL
    )
    SELECT a.\`type\`, COUNT(*) AS activityCount, MIN(a.\`createdAt\`) AS oldestActivityAt, MAX(a.\`createdAt\`) AS newestActivityAt
    FROM \`activitylog\` a JOIN missing m ON m.parentId = a.\`profileId\`
    GROUP BY a.\`type\` ORDER BY a.\`type\``,
  },
  {
    name: "missing-profile-delete-coverage",
    sql: `WITH missing AS (
      SELECT t.\`profileId\` AS parentId FROM \`task\` t LEFT JOIN \`profile\` p ON p.\`id\` = t.\`profileId\` WHERE t.\`profileId\` IS NOT NULL AND p.\`id\` IS NULL
      UNION SELECT project.\`profileId\` FROM \`project\` project LEFT JOIN \`profile\` p ON p.\`id\` = project.\`profileId\` WHERE p.\`id\` IS NULL
      UNION SELECT e.\`profileId\` FROM \`timeentry\` e LEFT JOIN \`profile\` p ON p.\`id\` = e.\`profileId\` WHERE p.\`id\` IS NULL
    )
    SELECT COUNT(DISTINCT m.parentId) AS missingProfileCount,
      COUNT(DISTINCT CASE WHEN a.\`type\` = 'profile.delete' THEN m.parentId END) AS withDeleteActivityCount
    FROM missing m LEFT JOIN \`activitylog\` a ON a.\`profileId\` = m.parentId`,
  },
  {
    name: "missing-project-activity",
    sql: `WITH missing AS (
      SELECT DISTINCT t.\`projectId\` FROM \`task\` t LEFT JOIN \`project\` p ON p.\`id\` = t.\`projectId\` WHERE t.\`projectId\` IS NOT NULL AND p.\`id\` IS NULL
    )
    SELECT a.\`type\`, COUNT(*) AS activityCount, MIN(a.\`createdAt\`) AS oldestActivityAt, MAX(a.\`createdAt\`) AS newestActivityAt
    FROM \`activitylog\` a JOIN missing m ON m.\`projectId\` = a.\`projectId\`
    GROUP BY a.\`type\` ORDER BY a.\`type\``,
  },
  {
    name: "missing-task-activity",
    sql: `WITH missing AS (
      SELECT DISTINCT n.\`taskId\` FROM \`tasknote\` n LEFT JOIN \`task\` t ON t.\`id\` = n.\`taskId\` WHERE t.\`id\` IS NULL
    )
    SELECT a.\`type\`, COUNT(*) AS activityCount, MIN(a.\`createdAt\`) AS oldestActivityAt, MAX(a.\`createdAt\`) AS newestActivityAt
    FROM \`activitylog\` a JOIN missing m ON m.\`taskId\` = a.\`taskId\`
    GROUP BY a.\`type\` ORDER BY a.\`type\``,
  },
  {
    name: "missing-space-activity",
    sql: `WITH missing AS (
      SELECT r.\`spaceId\` AS parentId FROM \`matrixrow\` r LEFT JOIN \`collaborativespace\` s ON s.\`id\` = r.\`spaceId\` WHERE s.\`id\` IS NULL
      UNION SELECT c.\`spaceId\` FROM \`matrixcolumn\` c LEFT JOIN \`collaborativespace\` s ON s.\`id\` = c.\`spaceId\` WHERE s.\`id\` IS NULL
    )
    SELECT a.\`type\`, COUNT(*) AS activityCount, MIN(a.\`createdAt\`) AS oldestActivityAt, MAX(a.\`createdAt\`) AS newestActivityAt
    FROM \`activitylog\` a JOIN missing m ON m.parentId = a.\`spaceId\`
    GROUP BY a.\`type\` ORDER BY a.\`type\``,
  },
  {
    name: "missing-space-cuid-time-range",
    sql: `WITH orphan_children AS (
      SELECT r.\`id\`, r.\`spaceId\` FROM \`matrixrow\` r LEFT JOIN \`collaborativespace\` s ON s.\`id\` = r.\`spaceId\` WHERE s.\`id\` IS NULL
      UNION ALL
      SELECT c.\`id\`, c.\`spaceId\` FROM \`matrixcolumn\` c LEFT JOIN \`collaborativespace\` s ON s.\`id\` = c.\`spaceId\` WHERE s.\`id\` IS NULL
    ), missing_spaces AS (SELECT DISTINCT spaceId FROM orphan_children)
    SELECT
      COUNT(*) AS orphanChildCount,
      SUM(id REGEXP '^c[0-9a-z]{24}$') AS cuidChildCount,
      FROM_UNIXTIME(MIN(CONV(SUBSTRING(id, 2, 8), 36, 10)) / 1000) AS inferredOldestChildCreatedAt,
      FROM_UNIXTIME(MAX(CONV(SUBSTRING(id, 2, 8), 36, 10)) / 1000) AS inferredNewestChildCreatedAt,
      (SELECT COUNT(*) FROM missing_spaces) AS missingSpaceCount,
      (SELECT SUM(spaceId REGEXP '^c[0-9a-z]{24}$') FROM missing_spaces) AS cuidSpaceCount,
      (SELECT FROM_UNIXTIME(MIN(CONV(SUBSTRING(spaceId, 2, 8), 36, 10)) / 1000) FROM missing_spaces) AS inferredOldestSpaceCreatedAt,
      (SELECT FROM_UNIXTIME(MAX(CONV(SUBSTRING(spaceId, 2, 8), 36, 10)) / 1000) FROM missing_spaces) AS inferredNewestSpaceCreatedAt
    FROM orphan_children`,
  },
  {
    name: "physical-foreign-keys",
    sql: `SELECT COUNT(*) AS foreignKeyCount
    FROM information_schema.\`REFERENTIAL_CONSTRAINTS\`
    WHERE \`CONSTRAINT_SCHEMA\` = DATABASE()`,
  },
];

export const SNAPSHOT_ISOLATION_SQL =
  "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ";
export const START_READ_ONLY_SNAPSHOT_SQL =
  "START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY";

export async function runAudit(connection) {
  const relationships = [];
  for (const relationship of RELATIONSHIPS) {
    const sql = relationshipAuditSql(relationship);
    assertReadOnlySql(sql);
    const [rows] = await connection.query(sql);
    relationships.push({ ...relationship, ...rows[0] });
  }

  const impact = [];
  for (const query of IMPACT_QUERIES) {
    assertReadOnlySql(query.sql);
    const [rows] = await connection.query(query.sql);
    impact.push({ name: query.name, ...rows[0] });
  }

  const rootCause = [];
  for (const query of ROOT_CAUSE_QUERIES) {
    assertReadOnlySql(query.sql);
    const [rows] = await connection.query(query.sql);
    rootCause.push({ name: query.name, rows });
  }

  const migrationSql = "SELECT COUNT(*) AS migrationCount, MAX(`finished_at`) AS latestFinishedAt FROM `_prisma_migrations` WHERE `finished_at` IS NOT NULL AND `rolled_back_at` IS NULL";
  assertReadOnlySql(migrationSql);
  const [migrationRows] = await connection.query(migrationSql);

  return {
    auditedAt: new Date().toISOString(),
    migration: migrationRows[0],
    relationships,
    impact,
    rootCause,
  };
}

export async function runConsistentReadAudit(connection, audit = runAudit) {
  await connection.query(SNAPSHOT_ISOLATION_SQL);
  await connection.query(START_READ_ONLY_SNAPSHOT_SQL);

  try {
    return await audit(connection);
  } finally {
    await connection.rollback();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (process.argv.slice(2).length > 0) {
    throw new Error("This count-only audit accepts no arguments and has no mutation mode");
  }

  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    multipleStatements: false,
  });
  try {
    const result = await runConsistentReadAudit(connection);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await connection.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Integrity audit failed");
    process.exitCode = 1;
  });
}
