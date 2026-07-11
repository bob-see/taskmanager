# Migration History Audit

## Why This Audit Was Performed

TaskManager uses Prisma with MariaDB on Railway. During deployment, Prisma Migrate reported that some historical schema changes already existed in the database even though the corresponding migrations were not recorded as successfully applied in Prisma's migration ledger.

This can happen when schema changes are applied outside the normal Prisma Migrate workflow, for example with `prisma db push` or another direct schema-sync path. The audit was performed to confirm that the live Railway database, the Prisma schema, and Prisma's migration history were reconciled before continuing with future migrations.

The database was not reset, recreated, or wiped during this process.

## Manually Reconciled Historical Migrations

The following migrations required manual migration-ledger reconciliation:

- `20260621120000_profile_routine_support`
- `20260621160000_sunday_check_in`
- `20260623120000_repeat_interval`

For each migration:

- The intended schema changes already existed in the Railway database.
- The live database schema matched the current Prisma schema.
- No additional schema repair was required before reconciliation.
- The Prisma migration ledger was reconciled with:

```bash
npx prisma migrate resolve --applied <migration_name>
```

### `20260621120000_profile_routine_support`

This migration added routine support state to profiles. The `profile.routineSupportEnabled` column already existed in Railway and matched the Prisma schema. The migration was therefore marked as applied.

### `20260621160000_sunday_check_in`

This migration added the Sunday check-in table and related constraints/indexes. The live Railway schema already contained the expected objects and matched the Prisma schema. The migration was therefore marked as applied.

### `20260623120000_repeat_interval`

This migration added `task.repeatInterval`.

The live Railway column already existed as:

```text
task.repeatInterval int NOT NULL DEFAULT 1
```

That matched the Prisma schema:

```prisma
repeatInterval Int @default(1)
```

The migration contained no additional schema changes, so it was safe to mark as applied.

## Audit Findings

After reconciliation:

- `npx prisma migrate status` reports `Database schema is up to date.`
- `npx prisma validate` passes.
- `npx prisma generate` passes.
- Every migration directory under `prisma/migrations` has a corresponding ledger entry.
- No failed or unfinished migrations remain in Prisma's migration ledger.
- The latest notification preferences migration deployed successfully.

## Remaining Drift

The only remaining drift identified is an index naming difference:

```text
ActivityLog_spaceId_idx
activitylog_spaceId_idx
```

This is an index name casing/naming difference only. The indexed column and behavior are equivalent, and there is no functional impact on the application. It has intentionally been left unchanged to avoid an unnecessary production schema change.

## Lessons Learned

- Prefer `prisma migrate dev` for schema evolution so every schema change is captured in a migration file and migration history stays authoritative.
- Avoid `prisma db push` except for disposable development databases where migration history does not matter.
- If a schema change is ever applied outside the normal migration workflow, reconcile the Prisma migration ledger immediately after confirming the live schema matches the intended migration.
