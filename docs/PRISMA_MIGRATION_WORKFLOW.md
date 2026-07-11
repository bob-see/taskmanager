# Prisma Migration Workflow

## Purpose

This is the mandatory database migration workflow for TaskManager development and deployment.

TaskManager uses Prisma with MariaDB hosted on Railway. Schema changes must keep three things aligned:

- `prisma/schema.prisma`
- the committed migration files under `prisma/migrations`
- the live Railway database and Prisma migration ledger

A July 2026 migration audit found that several schema changes had previously been applied to Railway without their migrations being correctly recorded in Prisma's migration ledger. The affected migrations were:

- `20260621120000_profile_routine_support`
- `20260621160000_sunday_check_in`
- `20260623120000_repeat_interval`

Each migration was investigated individually and reconciled with:

```bash
npx prisma migrate resolve --applied <migration_name>
```

The complete audit is documented in [MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md).

## Core Rule

Do not use `prisma db push` against the shared Railway database.

`prisma db push` can alter the live database schema without creating or recording a migration. That can leave the database schema and Prisma migration ledger inconsistent, causing later `prisma migrate deploy` runs to fail or become unpredictable.

`prisma db push` may only be used with a disposable local development database where migration history does not matter.

## Approved Schema-Change Workflow

1. Update `prisma/schema.prisma`.

2. Create a properly named migration using the approved development workflow:

```bash
npx prisma migrate dev --name <descriptive_migration_name>
```

If the configured datasource points to the shared Railway database and using `migrate dev` would be unsafe, stop and investigate the project's local or shadow database setup. Do not use `db push` as a workaround.

3. Review the generated migration SQL.

4. Commit all related changes together:

- application code
- `prisma/schema.prisma`
- the new folder under `prisma/migrations`
- relevant documentation changes

5. Apply committed migrations to Railway:

```bash
npx prisma migrate deploy
```

6. Confirm migration status:

```bash
npx prisma migrate status
```

Expected result:

```text
Database schema is up to date.
```

7. Regenerate the Prisma client:

```bash
npx prisma generate
```

8. Run project checks:

```bash
npm run build
```

Also run relevant lint or test commands for the changed area.

## Pre-Deployment Checklist

- Prisma schema change reviewed
- Migration folder created
- Migration SQL reviewed
- Migration folder committed
- No use of `prisma db push` against Railway
- `prisma migrate deploy` completed
- `prisma migrate status` reports up to date
- Prisma client regenerated
- Build/tests completed
- Feature manually tested

## Duplicate Column or Table Errors

If `prisma migrate deploy` reports errors such as:

- duplicate column name
- table already exists
- migration failed
- `P3009` failed migration detected

Follow this procedure:

1. Stop immediately.
2. Do not repeatedly rerun `migrate deploy`.
3. Do not edit or delete migration history records manually.
4. Inspect the migration SQL.
5. Inspect the live database schema.
6. Confirm whether every intended migration change already exists.
7. Check `_prisma_migrations`.
8. Only use `prisma migrate resolve --applied` after confirming the complete migration is already represented in the live schema.
9. If only part of the migration exists, repair the missing schema safely before resolving it.
10. Document any manual reconciliation in [MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md).

Do not assume a migration is safe to resolve merely because one column or table exists. The full migration must be represented in the live schema.

## Rules for `prisma migrate resolve`

`prisma migrate resolve` changes Prisma's migration ledger. It must never be used merely to bypass an error.

It is appropriate only when all of the following are true:

- the migration failed because its complete schema change already existed
- the live schema has been inspected
- the live schema matches both the migration SQL and current Prisma schema
- there are no missing indexes, constraints, foreign keys, defaults, or columns
- the reconciliation is documented

## Migration Naming Guidance

Use clear descriptive migration names, for example:

- `add_notification_preferences`
- `add_push_subscriptions`
- `add_task_repeat_interval`

Avoid vague names such as:

- `update`
- `changes`
- `fix`
- `migration2`

## Guidance for Codex and Automated Development Tools

- Never run `prisma db push` against the configured shared Railway database.
- Never run `prisma migrate reset` against Railway.
- Never delete production migration records.
- Never modify an already-applied migration file.
- Always create a new migration for new schema changes.
- Always report the migration name and migration command required.
- Always ask for approval before running schema-changing or migration-ledger-changing commands.
- Read-only commands such as `prisma migrate status`, `prisma validate`, and schema inspection may be used during investigations.
- If migration history and the live schema disagree, stop feature work and investigate before continuing.

## Relationship to Migration History

[MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md) records TaskManager's July 2026 migration reconciliation.

Update that document whenever a future manual migration-ledger repair occurs, including the migration name, the reason reconciliation was required, what live schema was inspected, and the exact command used.
