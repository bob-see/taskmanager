#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";

function commandExists(command) {
  return spawnSync(command, ["version"], { stdio: "ignore" }).status === 0 || spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function requiredCommand(command, description) {
  if (!commandExists(command)) throw new Error(`${description} is required`);
  return command;
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function waitForSuccess(child, name) {
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
  return new Promise((resolve, reject) => {
    child.once("error", (error) => reject(new Error(`${name} could not start: ${error.message}`)));
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${name} failed${stderr.trim() ? `: ${stderr.trim()}` : ""}`)));
  });
}

export async function verifyBackup(file, { environment = process.env } = {}) {
  if (!environment.TASKMANAGER_BACKUP_PASSPHRASE) throw new Error("TASKMANAGER_BACKUP_PASSPHRASE is not configured");
  const encryptedFile = path.resolve(file);
  if (!encryptedFile.endsWith(".sql.gz.enc")) throw new Error("Backup file must end in .sql.gz.enc");
  const manifestFile = encryptedFile.replace(/\.sql\.gz\.enc$/, ".manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  const actualHash = await sha256(encryptedFile);
  if (actualHash !== manifest.sha256) throw new Error("SHA-256 does not match the backup manifest");

  const openssl = requiredCommand("openssl", "OpenSSL");
  const gzip = requiredCommand("gzip", "gzip");
  const decrypt = spawn(openssl, ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "250000", "-pass", "env:TASKMANAGER_BACKUP_PASSPHRASE"], { env: environment, stdio: ["pipe", "pipe", "pipe"] });
  const decompress = spawn(gzip, ["-d", "-c"], { stdio: ["pipe", "ignore", "pipe"] });
  createReadStream(encryptedFile).pipe(decrypt.stdin);
  decrypt.stdout.pipe(decompress.stdin);
  await Promise.all([waitForSuccess(decrypt, "OpenSSL decryption"), waitForSuccess(decompress, "gzip decompression")]);
  console.log(`Backup verified: ${encryptedFile}`);
}

const requestedFile = process.argv[2];
if (requestedFile && process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  verifyBackup(requestedFile).catch((error) => {
    console.error(`Backup verification failed: ${error.message}`);
    process.exitCode = 1;
  });
} else if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  console.error("Usage: npm run db:backup:verify -- /absolute/path/to/taskmanager-...sql.gz.enc");
  process.exitCode = 1;
}
