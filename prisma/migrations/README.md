# Prisma Migrations Directory

This directory contains TaskManager's committed Prisma migration history.

Historical migrations may reflect earlier database stages, including SQLite-era development. Historical provider references in old migration files do not describe the current production database. Current production uses MariaDB on Railway.

This file is not the operational migration guide. Current migration procedures are owned by:

- [`../../docs/PRISMA_MIGRATION_WORKFLOW.md`](../../docs/PRISMA_MIGRATION_WORKFLOW.md)
- [`../../docs/MIGRATION_HISTORY.md`](../../docs/MIGRATION_HISTORY.md)

Do not use historical notes or copied repair commands as maintenance instructions.

For the shared Railway database, do not:

- run `prisma db push`
- run `prisma migrate reset`
- delete or rewrite committed migration history
- make undocumented migration-ledger edits
- run ad hoc repair commands copied from old migration notes

If migration history and the live schema disagree, stop and follow the documented investigation and reconciliation workflow.
