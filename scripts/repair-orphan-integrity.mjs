#!/usr/bin/env node

import "dotenv/config";
import mysql from "mysql2/promise";
import { runAudit } from "./audit-orphan-integrity.mjs";

const APPROVED_BASELINE = {
  "task.profileId": 6,
  "task.projectId": 1,
  "tasknote.taskId": 5,
  "project.profileId": 2,
  "timeentry.profileId": 4,
  "matrixcolumn.spaceId": 32,
  "matrixrow.spaceId": 80,
};

const APPROVED_CLASSES = new Set([
  "task.profileId",
  "task.projectId",
  "tasknote.taskId",
  "project.profileId",
]);

const EXPECTED_APPROVAL = "tasks-projects,task-notes";

function relationshipCounts(audit) {
  return Object.fromEntries(audit.relationships.map((item) => [item.child + "." + item.field, Number(item.orphanCount)]));
}

function assertBaseline(audit) {
  const counts = relationshipCounts(audit);
  for (const [name, expected] of Object.entries(APPROVED_BASELINE)) {
    if (counts[name] !== expected) {
      throw new Error(`Baseline mismatch for ${name}: expected ${expected}, found ${counts[name]}`);
    }
  }

  const impact = Object.fromEntries(audit.impact.map((item) => [item.name, item]));
  if (Number(impact["timeentry.profileId"]?.activeTimerCount) !== 0) {
    throw new Error("Baseline mismatch: an orphaned time entry is an active timer");
  }
  if (Number(impact["task.profileId"]?.delegatedReferenceCount) !== 0 || Number(impact["task.profileId"]?.noteReferenceCount) !== 0) {
    throw new Error("Baseline mismatch: orphaned profile tasks have delegated or note children");
  }
  if (Number(audit.rootCause.find((item) => item.name === "missing-space-overlap")?.rows[0]?.sharedAcrossClassesCount) !== 7) {
    throw new Error("Baseline mismatch: missing-Space overlap changed");
  }
}

function assertPostTreatment(audit) {
  const counts = relationshipCounts(audit);
  for (const [name, before] of Object.entries(APPROVED_BASELINE)) {
    const expected = APPROVED_CLASSES.has(name) ? 0 : before;
    if (counts[name] !== expected) {
      throw new Error(`Post-treatment mismatch for ${name}: expected ${expected}, found ${counts[name]}`);
    }
  }

  const impact = Object.fromEntries(audit.impact.map((item) => [item.name, item]));
  if (Number(impact["timeentry.profileId"]?.activeTimerCount) !== 0) {
    throw new Error("Post-treatment mismatch: an active timer changed state");
  }
  if (Number(impact["matrixcolumn.spaceId"]?.cellReferenceCount) !== 17 || Number(impact["matrixrow.spaceId"]?.cellReferenceCount) !== 17) {
    throw new Error("Post-treatment mismatch: inaccessible Space cell references changed");
  }
}

function treatmentSummary(audit) {
  const counts = relationshipCounts(audit);
  return {
    mode: "dry-run",
    approvedClasses: [...APPROVED_CLASSES],
    intendedEffects: {
      orphanTaskNotesForDeletedTasks: counts["tasknote.taskId"],
      orphanTasksWithMissingProfiles: counts["task.profileId"],
      orphanProjectsWithMissingProfiles: counts["project.profileId"],
      historicalTimeEntriesRetained: counts["timeentry.profileId"],
      inaccessibleSpaceRowsUntouched: counts["matrixrow.spaceId"],
      inaccessibleSpaceColumnsUntouched: counts["matrixcolumn.spaceId"],
    },
  };
}

async function deleteApprovedData(connection) {
  const [notes] = await connection.query(
    "DELETE n FROM tasknote n LEFT JOIN task t ON t.id = n.taskId WHERE t.id IS NULL",
  );
  const [tasks] = await connection.query(
    "DELETE t FROM task t LEFT JOIN profile p ON p.id = t.profileId WHERE t.profileId IS NOT NULL AND p.id IS NULL",
  );
  const [projects] = await connection.query(
    "DELETE p FROM project p LEFT JOIN profile owner ON owner.id = p.profileId WHERE owner.id IS NULL",
  );
  return { notes: notes.affectedRows, tasks: tasks.affectedRows, projects: projects.affectedRows };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const argumentsList = process.argv.slice(2);
  const apply = argumentsList.includes("--apply");
  if (argumentsList.some((argument) => !["--apply"].includes(argument))) {
    throw new Error("Usage: node scripts/repair-orphan-integrity.mjs [--apply]");
  }

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: false });
  try {
    if (!apply) {
      await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
      try {
        const audit = await runAudit(connection);
        assertBaseline(audit);
        console.log(JSON.stringify({ auditedAt: audit.auditedAt, ...treatmentSummary(audit) }, null, 2));
      } finally {
        await connection.rollback();
      }
      return;
    }

    if (process.env.ORPHAN_REPAIR_APPROVAL !== EXPECTED_APPROVAL) {
      throw new Error(`Refusing apply: set ORPHAN_REPAIR_APPROVAL=${EXPECTED_APPROVAL}`);
    }
    if (process.env.ORPHAN_REPAIR_BACKUP_VERIFIED !== "yes") {
      throw new Error("Refusing apply: set ORPHAN_REPAIR_BACKUP_VERIFIED=yes only after independent backup verification");
    }
    if (!process.env.ORPHAN_REPAIR_BACKUP_REFERENCE) {
      throw new Error("Refusing apply: set ORPHAN_REPAIR_BACKUP_REFERENCE to the verified backup manifest reference");
    }

    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.beginTransaction();
    try {
      const before = await runAudit(connection);
      assertBaseline(before);
      const affected = await deleteApprovedData(connection);
      const after = await runAudit(connection);
      assertPostTreatment(after);
      await connection.commit();
      console.log(JSON.stringify({
        mode: "apply",
        auditedAt: after.auditedAt,
        backupReference: process.env.ORPHAN_REPAIR_BACKUP_REFERENCE,
        affected,
        preserved: { orphanedTimeEntries: APPROVED_BASELINE["timeentry.profileId"], inaccessibleSpaceRows: APPROVED_BASELINE["matrixrow.spaceId"], inaccessibleSpaceColumns: APPROVED_BASELINE["matrixcolumn.spaceId"] },
      }, null, 2));
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Orphan repair refused or failed: ${error.message}`);
  process.exitCode = 1;
});
