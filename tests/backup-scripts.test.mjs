import assert from "node:assert/strict";
import test from "node:test";

import { backupBaseName, dumpArguments, parseDatabaseUrl, runBackup, safeLabel } from "../scripts/backup-database.mjs";
import { keychainLookupArguments } from "../scripts/run-scheduled-backup.mjs";

test("backup URL parsing accepts MariaDB-style connection URLs without exposing credentials", () => {
  assert.deepEqual(parseDatabaseUrl("mysql://backup%40user:correct%20horse@db.example:3307/taskmanager"), {
    host: "db.example",
    port: "3307",
    user: "backup@user",
    password: "correct horse",
    database: "taskmanager",
  });
  assert.throws(() => parseDatabaseUrl("postgres://user:password@example.com/taskmanager"), /mysql/);
});

test("backup labels and filenames cannot create paths", () => {
  assert.equal(safeLabel(" Before / migration! "), "before-migration");
  assert.equal(backupBaseName(new Date("2026-08-05T01:02:03.456Z"), "Before migration"), "taskmanager-2026-08-05T01-02-03-456Z-before-migration");
  assert.throws(() => safeLabel("---"), /letters or numbers/);
});

test("backup dump arguments require a locked full logical dump", () => {
  assert.deepEqual(dumpArguments("/private/tmp/client.cnf", "taskmanager"), [
    "--defaults-extra-file=/private/tmp/client.cnf",
    "--lock-all-tables",
    "--routines",
    "--events",
    "--triggers",
    "--hex-blob",
    "--add-drop-table",
    "--databases",
    "taskmanager",
  ]);
});

test("backup refuses to connect until an operator acknowledges the write lock", async () => {
  await assert.rejects(runBackup({ environment: {}, cwd: process.cwd() }), /TASKMANAGER_BACKUP_ALLOW_WRITE_LOCK=yes/);
});

test("scheduled backup reads only the named Keychain item", () => {
  assert.deepEqual(keychainLookupArguments(), [
    "find-generic-password",
    "-s", "TaskManager Backup Encryption",
    "-a", "taskmanager-backup",
    "-w",
  ]);
});
