#!/usr/bin/env node

import "dotenv/config";
import { createHash } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";

const REQUIRED_WRITE_LOCK_ACKNOWLEDGEMENT = "yes";
const OPENSSL_ITERATIONS = "250000";

export function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use the mysql: or mariadb: protocol");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !url.username || !database) {
    throw new Error("DATABASE_URL must include host, username and database name");
  }

  return {
    host: url.hostname,
    port: url.port || "3306",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

export function safeLabel(value) {
  const label = (value || "manual").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!label) throw new Error("Backup label must contain letters or numbers");
  return label.slice(0, 60);
}

export function backupBaseName(timestamp, label) {
  return `taskmanager-${timestamp.toISOString().replace(/[:.]/g, "-")}-${safeLabel(label)}`;
}

export function dumpArguments(defaultsFile, database) {
  return [
    `--defaults-extra-file=${defaultsFile}`,
    "--lock-all-tables",
    "--routines",
    "--events",
    "--triggers",
    "--hex-blob",
    "--add-drop-table",
    "--databases",
    database,
  ];
}

function commandExists(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function resolveCommand(candidates, description) {
  const command = candidates.find(commandExists);
  if (!command) {
    throw new Error(`${description} is required. Install a MariaDB/MySQL client providing mariadb-dump or mysqldump.`);
  }
  return command;
}

function quotedOption(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function createDefaultsFile(connection) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "taskmanager-backup-"));
  const file = path.join(directory, "client.cnf");
  const contents = [
    "[client]",
    `host=${quotedOption(connection.host)}`,
    `port=${quotedOption(connection.port)}`,
    `user=${quotedOption(connection.user)}`,
    `password=${quotedOption(connection.password)}`,
    "",
  ].join("\n");
  await fs.writeFile(file, contents, { mode: 0o600 });
  return { directory, file };
}

function collectStderr(child) {
  let output = "";
  child.stderr.on("data", (chunk) => {
    output = `${output}${chunk}`.slice(-4000);
  });
  return () => output.trim();
}

function waitForSuccess(child, name, stderr) {
  return new Promise((resolve, reject) => {
    child.once("error", (error) => reject(new Error(`${name} could not start: ${error.message}`)));
    child.once("close", (code) => {
      if (code === 0) return resolve();
      const detail = stderr();
      reject(new Error(`${name} failed${detail ? `: ${detail}` : ""}`));
    });
  });
}

async function sha256(file) {
  const hash = createHash("sha256");
  const stream = (await import("node:fs")).createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function assertOutsideRepository(directory) {
  const repository = path.resolve(process.cwd());
  const target = path.resolve(directory);
  const relative = path.relative(repository, target);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("TASKMANAGER_BACKUP_DIR must be outside the repository so encrypted production backups cannot be committed accidentally");
  }
}

export async function runBackup({ environment = process.env, cwd = process.cwd() } = {}) {
  if (environment.TASKMANAGER_BACKUP_ALLOW_WRITE_LOCK !== REQUIRED_WRITE_LOCK_ACKNOWLEDGEMENT) {
    throw new Error("Refusing backup until TASKMANAGER_BACKUP_ALLOW_WRITE_LOCK=yes is set. This dump briefly locks writes so legacy non-transactional tables are captured consistently.");
  }
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!environment.TASKMANAGER_BACKUP_DIR) throw new Error("TASKMANAGER_BACKUP_DIR is not configured");
  if (!environment.TASKMANAGER_BACKUP_PASSPHRASE) throw new Error("TASKMANAGER_BACKUP_PASSPHRASE is not configured");

  process.chdir(cwd);
  assertOutsideRepository(environment.TASKMANAGER_BACKUP_DIR);
  const connection = parseDatabaseUrl(environment.DATABASE_URL);
  const dumpCommand = resolveCommand([
    "mariadb-dump",
    "mysqldump",
    "/opt/homebrew/opt/mysql-client/bin/mysqldump",
    "/usr/local/opt/mysql-client/bin/mysqldump",
  ], "Database dump tool");
  const gzipCommand = resolveCommand(["gzip"], "gzip");
  const opensslCommand = resolveCommand(["openssl"], "OpenSSL");
  const backupDirectory = path.resolve(environment.TASKMANAGER_BACKUP_DIR);
  const baseName = backupBaseName(new Date(), environment.TASKMANAGER_BACKUP_LABEL);
  const encryptedFile = path.join(backupDirectory, `${baseName}.sql.gz.enc`);
  const temporaryFile = `${encryptedFile}.part`;
  const manifestFile = path.join(backupDirectory, `${baseName}.manifest.json`);

  await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(backupDirectory, 0o700);
  const defaults = await createDefaultsFile(connection);

  try {
    const dump = spawn(dumpCommand, dumpArguments(defaults.file, connection.database), { stdio: ["ignore", "pipe", "pipe"] });
    const gzip = spawn(gzipCommand, ["-9", "-c"], { stdio: ["pipe", "pipe", "pipe"] });
    const encrypt = spawn(opensslCommand, ["enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-iter", OPENSSL_ITERATIONS, "-pass", "env:TASKMANAGER_BACKUP_PASSPHRASE"], {
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output = createWriteStream(temporaryFile, { mode: 0o600, flags: "wx" });
    const dumpStderr = collectStderr(dump);
    const gzipStderr = collectStderr(gzip);
    const encryptStderr = collectStderr(encrypt);

    dump.stdout.pipe(gzip.stdin);
    gzip.stdout.pipe(encrypt.stdin);
    encrypt.stdout.pipe(output);

    await Promise.all([
      waitForSuccess(dump, dumpCommand, dumpStderr),
      waitForSuccess(gzip, gzipCommand, gzipStderr),
      waitForSuccess(encrypt, opensslCommand, encryptStderr),
      new Promise((resolve, reject) => output.once("finish", resolve).once("error", reject)),
    ]);

    await fs.rename(temporaryFile, encryptedFile);
    const stat = await fs.stat(encryptedFile);
    const manifest = {
      format: "taskmanager-mariadb-sql-gzip-openssl-aes-256-cbc-v1",
      createdAt: new Date().toISOString(),
      encryptedFile: path.basename(encryptedFile),
      sha256: await sha256(encryptedFile),
      bytes: stat.size,
      database: connection.database,
      consistency: "lock-all-tables",
    };
    await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    console.log(`Backup created: ${encryptedFile}`);
    console.log(`Manifest created: ${manifestFile}`);
  } catch (error) {
    await fs.rm(temporaryFile, { force: true });
    throw error;
  } finally {
    await fs.rm(defaults.directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  runBackup().catch((error) => {
    console.error(`Backup not created: ${error.message}`);
    process.exitCode = 1;
  });
}
