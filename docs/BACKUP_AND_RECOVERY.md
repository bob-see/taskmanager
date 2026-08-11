# TaskManager Backup and Recovery Runbook

**Status:** Encrypted scheduled backup active. Independent backup-file verification and a restore rehearsal remain required before this is treated as a proven recovery capability.

This runbook owns TaskManager database backup, encrypted backup-file verification and restoration rehearsal. It does not replace Railway's own provider backup/snapshot facility; use both where the Railway plan provides one.

## Current Operational Record

- The first encrypted scheduled backup completed successfully on 5 August 2026 during the Brisbane 8:00 pm backup window. Its encrypted dump and manifest are stored together in the approved Google Drive **My Drive/TaskManager Backups** location.
- The daily scheduled backup runs from this Mac using the local Keychain item described below. It creates an encrypted dump and its checksum manifest; no plaintext SQL is retained by the backup process.
- The next required evidence is an independent `npm run db:backup:verify` check and a restore rehearsal to an approved disposable MariaDB target. Do not treat a successful file creation alone as proof that production recovery works.
- **Next week:** configure a Backblaze B2 copy of the encrypted dump and manifest, including approved retention, access controls and an upload/restore verification procedure. Keep the Google Drive copy until the Backblaze process is verified.

## Scope and Safety Boundaries

- The application database is MariaDB on Railway.
- The repository command creates a logical SQL dump containing schema, data, triggers, events and routines.
- It streams the dump through gzip and AES-256-CBC encryption. Plaintext SQL is never written to disk by the command.
- The command uses `--lock-all-tables` so legacy non-transactional tables are included consistently. This briefly blocks application writes. Run it in an agreed low-activity window.
- The dump is only one part of recovery. Vercel configuration and database access credentials are managed separately and must not be stored in the backup.
- Never run a restore against production without written approval, a verified target, and a maintenance window.

## Roles

| Role | Responsibility |
| --- | --- |
| Backup operator | Creates, verifies and transfers encrypted backups; records only operational metadata. |
| System owner | Approves backup location, retention, maintenance windows and production restores. |
| Restore operator | Restores only to the approved target and completes the verification checklist. |

One person may hold more than one role, but production restoration still requires explicit owner approval.

## Prerequisites

Install a MariaDB/MySQL client that provides `mariadb-dump` or `mysqldump`. On this Mac, Homebrew's `mysql-client` package is compatible with Railway MariaDB; the command recognises its standard Homebrew location. The backup command also requires `gzip` and OpenSSL.

Choose an encrypted backup directory **outside this repository**, for example a restricted directory managed by the approved off-site storage/synchronisation process. Do not point it to Dropbox, Google Drive or a shared folder until the system owner has confirmed the access and retention rules. The current Google Drive location is approved for the encrypted dump and manifest only; Backblaze B2 remains the planned independent copy.

Keep these values in the terminal session, deployment secret manager or password manager—not in `.env`, Git or a shell history file:

```sh
export DATABASE_URL='mysql://…'
export TASKMANAGER_BACKUP_DIR='/absolute/path/outside/taskmanager'
export TASKMANAGER_BACKUP_PASSPHRASE='long unique passphrase from password manager'
export TASKMANAGER_BACKUP_ALLOW_WRITE_LOCK=yes
export TASKMANAGER_BACKUP_LABEL='before-major-deployment'
```

`TASKMANAGER_BACKUP_PASSPHRASE` is required to decrypt the backup. Losing it makes the backup unusable; storing it alongside the backup defeats the encryption.

## Create and Verify a Backup

Before starting, confirm that `DATABASE_URL` targets the intended Railway database and notify users if the planned lock could affect their work.

```sh
npm run db:backup
```

The command writes two restricted files:

- `taskmanager-<timestamp>-<label>.sql.gz.enc` — encrypted backup data
- `taskmanager-<timestamp>-<label>.manifest.json` — timestamp, byte count, database name, consistency method and SHA-256 checksum

Immediately verify the backup using the same passphrase:

```sh
npm run db:backup:verify -- /absolute/path/to/taskmanager-<timestamp>-<label>.sql.gz.enc
```

Verification checks the checksum and fully decrypts/decompresses the stream without saving plaintext SQL. It does not prove that the SQL can restore into a database; the restoration rehearsal does that.

Record the timestamp, backup filename, checksum, byte size, operator, database target and verification result in the protected operations record. Do not copy task content, user names, credentials or SQL into the record.

## Off-site Storage and Retention

After successful verification, transfer the encrypted backup and manifest to the approved off-site location. Retain them together.

Recommended initial policy:

- daily backups for 14 days;
- weekly backups for 12 weeks;
- monthly backups for 12 months;
- one copy independent of Railway;
- access limited to approved operators; and
- deletion only after the replacement backup is verified and retention rules permit it.

Railway provider backups should be enabled if available on the active plan, but are not a substitute for the independent encrypted copy. Confirm Railway's current retention and restore mechanics in the Railway project before relying on them.

## Automation Readiness

Do not rely on this schedule as a proven recovery capability until the first independent backup-file verification and restoration rehearsal have succeeded.

Once approved, the scheduled job should:

1. Run during the agreed Brisbane low-activity window.
2. Inject the database URL and encryption passphrase through the scheduler's secret store.
3. Create and verify the backup.
4. Transfer the encrypted file and manifest to the approved off-site location.
5. Alert the operator if creation, verification, transfer or retention cleanup fails.
6. Never log credentials, passphrases, SQL, task content or user data.

The storage destination and scheduler are deliberately not hard-coded in this repository. Select and approve them before enabling automation.

For the current Mac-based 8:00 pm schedule, store the encryption passphrase as the macOS Keychain generic-password item named `TaskManager Backup Encryption` with account `taskmanager-backup`. `npm run db:backup:scheduled` reads that item only in memory, then invokes the normal backup command. It does not print, store or transmit the passphrase.

## Restoration Rehearsal

Perform the first rehearsal manually against a new, disposable MariaDB database. Do not use the production database or a shared development database.

1. Obtain written approval for the rehearsal target and identify the backup filename/checksum.
2. Verify the encrypted file with `npm run db:backup:verify`.
3. Create a fresh MariaDB **server or instance** and a least-privilege restore account that is allowed to create the source database name. The dump deliberately includes `CREATE DATABASE` and `USE` so schema restoration is self-contained.
4. Decrypt, decompress and pipe the SQL directly into the restore client; do not save the plaintext dump:

   ```sh
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 \
     -pass env:TASKMANAGER_BACKUP_PASSPHRASE \
     -in /absolute/path/to/taskmanager-<timestamp>-<label>.sql.gz.enc \
     | gzip -d \
     | mariadb --host=RESTORE_HOST --port=3306 --user=RESTORE_USER --password
   ```

   Enter the restore password interactively. Do not put it in the command line or logs.

5. Point a controlled local application environment at the restored database created by the dump; never point a public deployment at it.
6. Run `npx prisma migrate status` and `npm run db:integrity:audit` against the restored database after confirming their target.
7. Confirm login plus representative access to Overview, Tracker, projects, delegated tasks, timesheets, reports, Spaces, notifications and activity history.
8. Record the restore duration, verification results and any discrepancies. Destroy the disposable restore database only after the record is complete.

## Production Recovery

Use provider rollback or a verified restore rather than improvised SQL fixes. Before any production restoration:

1. Obtain explicit system-owner approval and set a maintenance window.
2. Preserve the current database with a fresh verified backup if it is accessible.
3. Select the recovery point and verify its encrypted file/checksum.
4. Restore first to a disposable target when time allows.
5. Confirm database credentials, application configuration and rollback path.
6. Restore only to the specifically approved production target.
7. Complete the same integrity and application smoke checks used in the rehearsal.
8. Document the incident, chosen recovery point, operator, outcome and follow-up actions.

## Review Schedule

Review this runbook after the first rehearsal, whenever Railway/database access changes, and at least quarterly. Repeat a restore rehearsal at least quarterly once automated backups are active.
