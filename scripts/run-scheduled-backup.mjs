#!/usr/bin/env node

import { promisify } from "node:util";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { runBackup } from "./backup-database.mjs";

const execFileAsync = promisify(execFile);
export const DEFAULT_KEYCHAIN_SERVICE = "TaskManager Backup Encryption";
export const DEFAULT_KEYCHAIN_ACCOUNT = "taskmanager-backup";

export function keychainLookupArguments(environment = process.env) {
  return [
    "find-generic-password",
    "-s", environment.TASKMANAGER_BACKUP_KEYCHAIN_SERVICE || DEFAULT_KEYCHAIN_SERVICE,
    "-a", environment.TASKMANAGER_BACKUP_KEYCHAIN_ACCOUNT || DEFAULT_KEYCHAIN_ACCOUNT,
    "-w",
  ];
}

export async function readKeychainPassphrase({ environment = process.env, lookupPassphrase } = {}) {
  const readPassphrase = lookupPassphrase || (async () => {
    const { stdout } = await execFileAsync("security", keychainLookupArguments(environment), { maxBuffer: 4096 });
    return stdout.trim();
  });
  const passphrase = await readPassphrase();
  if (!passphrase) throw new Error("TaskManager backup passphrase was not available from Keychain");
  return passphrase;
}

export async function runScheduledBackup({ environment = process.env, lookupPassphrase } = {}) {
  const passphrase = await readKeychainPassphrase({ environment, lookupPassphrase });
  return runBackup({ environment: { ...environment, TASKMANAGER_BACKUP_PASSPHRASE: passphrase } });
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  runScheduledBackup().catch((error) => {
    console.error(`Scheduled backup not created: ${error.message}`);
    process.exitCode = 1;
  });
}
