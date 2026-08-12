#!/usr/bin/env node

import "dotenv/config";
import path from "node:path";
import process from "node:process";

import { verifyBackup } from "./verify-backup.mjs";
import { readKeychainPassphrase } from "./run-scheduled-backup.mjs";

const requestedFile = process.argv[2];

if (!requestedFile) {
  console.error("Usage: npm run db:backup:verify:scheduled -- /absolute/path/to/taskmanager-...sql.gz.enc");
  process.exitCode = 1;
} else {
  readKeychainPassphrase()
    .then((passphrase) => verifyBackup(path.resolve(requestedFile), { environment: { ...process.env, TASKMANAGER_BACKUP_PASSPHRASE: passphrase } }))
    .catch((error) => {
      console.error(`Scheduled backup verification failed: ${error.message}`);
      process.exitCode = 1;
    });
}
