# TaskManager Operations Manual

**Version:** 1.1
**Purpose:** Day-to-day operational runbook for keeping TaskManager running.

This document covers operational checks, deployment preparation, backups, smoke testing, and incident response. It does not own architecture, migration theory, Push internals, or product philosophy.

Owning documents:

- Current architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Migration workflow: [`PRISMA_MIGRATION_WORKFLOW.md`](./PRISMA_MIGRATION_WORKFLOW.md)
- Migration reconciliation history: [`MIGRATION_HISTORY.md`](./MIGRATION_HISTORY.md)
- Browser Push details: [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md)
- Development philosophy: [`../PROJECT_PLAYBOOK.md`](../PROJECT_PLAYBOOK.md)

## System At A Glance

- Application: Next.js, React, TypeScript
- Data access: Prisma
- Database: MariaDB on Railway
- Authentication: NextAuth
- Hosting: Vercel-style Next.js deployment
- Push delivery: Browser Push using Web Push and the `web-push` package

## Repository Landmarks

```text
/
├── app/                         Next.js routes, API routes, pages and feature code
│   ├── api/                     Authenticated API route handlers
│   ├── components/              Shared UI components
│   └── lib/                     Server-side services and utilities
├── docs/                        Architecture, subsystem and operations documents
├── prisma/                      Prisma schema and committed migration history
├── public/                      Static assets, manifest assets and service worker
├── tests/                       Node test files
├── PROJECT_PLAYBOOK.md          Development philosophy and Definition of Done
├── HOW_TO_WORK_WITH_TASKMANAGER.md
└── README.md
```

## Local Operational Checks

Use Node.js 22.13.0 or later. With nvm, run `nvm use` from the repository root before installing dependencies or running application and publication commands.

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Expected local URL:

```text
http://localhost:3000
```

Run the standard project checks:

```bash
npm test
npm run lint
npm run build
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Use the checks relevant to the changed area. For documentation-only changes, Markdown link verification and `git diff --check` are usually sufficient.

## Environment Checks

Required local and deployment configuration includes:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Do not commit real secrets. Use [`.env.example`](../.env.example) for safe placeholders.

Before deployment, confirm that:

- the Railway database is online
- `DATABASE_URL` points to the intended database
- Vercel environment variables are present for the target environment
- VAPID private values are server-only
- committed Prisma migrations are present when schema changed

## Database Backups

Create a SQL backup before:

- Prisma migrations
- schema changes
- major deployments
- manual recovery work

Recommended naming:

```text
YYYY-MM-DD-description.sql
```

Examples:

```text
2026-07-11-before-push-delivery.sql
2026-07-11-before-notification-preferences.sql
```

Keep production backups outside public documentation and avoid committing sensitive data.

## Migration Safety

TaskManager uses migration-first database evolution.

Do not use `prisma db push` against the shared Railway database.

Do not:

- run `prisma migrate reset` against Railway
- delete or rewrite committed migration history
- edit migration ledger records manually
- run ad hoc repair commands without investigation, backup and documentation

If a migration fails, or if `prisma migrate deploy` reports duplicate columns, existing tables, failed migrations or drift:

1. Stop.
2. Create or confirm a current backup.
3. Run read-only status and validation checks.
4. Inspect the migration and live schema.
5. Follow [`PRISMA_MIGRATION_WORKFLOW.md`](./PRISMA_MIGRATION_WORKFLOW.md).
6. Update [`MIGRATION_HISTORY.md`](./MIGRATION_HISTORY.md) if manual ledger reconciliation is required.

Do not duplicate drift-recovery steps here; the migration workflow document owns that process.

## Deployment Preparation

Before deploying:

- review `git status`
- confirm intended changes are committed
- confirm required migrations are committed
- create a database backup for schema or high-risk changes
- run relevant automated checks
- review environment variables
- review documentation impact for significant changes

Common commands:

```bash
git status
npm test
npm run build
npx prisma validate
npx prisma migrate status
```

## Vercel Deployment Verification

After deployment, verify:

- login works
- sidebar navigation loads
- Overview loads
- profile task pages load
- task create/edit/complete flows work
- project create/edit flows work
- delegated task pages load
- notification bell and notification settings load
- Browser Push subscription status can be read
- timesheets load
- reports load
- Collaborative Spaces load

For changes affecting Push behavior, use the manual verification steps in [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md).

## Railway Connectivity Checks

If database access fails:

1. Check Railway project status.
2. Confirm the database service is running.
3. Confirm `DATABASE_URL` has not changed unexpectedly.
4. Check recent deployment logs for connection or Prisma errors.
5. Avoid destructive recovery steps until a backup and diagnosis are complete.

## Incident Response

### Build Or Deployment Failure

1. Review Vercel deployment logs.
2. Reproduce locally where practical.
3. Run `npm run build`.
4. Check environment variables if the failure is environment-specific.
5. Fix, commit and redeploy.

### Authentication Failure

Check:

- `NEXTAUTH_SECRET`
- configured application URL behavior
- user record state
- deployment logs for NextAuth errors

### Database Or Migration Failure

Follow the migration safety section above. Do not attempt manual ledger or schema repair without documented investigation.

### Push Notification Failure

Check:

- Browser notification permission
- active subscription state
- VAPID environment variables
- service worker registration
- server logs for Web Push delivery warnings

Detailed troubleshooting belongs in [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md).

## Post-Deployment Smoke Test

For normal deployments, verify:

- login
- Overview
- one profile task list
- create and complete a task
- create or edit a project
- delegated task list access
- notification center open/read behavior
- settings page access
- timesheets
- reports

For schema changes, also verify:

- `npx prisma migrate status` reports up to date
- the affected model can be read and written through the application
- no Prisma runtime errors appear in logs

## Recovery Cautions

- Prefer rollback or restore over improvising production fixes.
- Preserve production data.
- Document any manual repair.
- Update the owning documentation after resolving an operational incident.
- Do not treat generated PDFs or old planning notes as operational sources.

## Future Runbook Improvements

Future focused runbooks may cover:

- detailed Railway backup and restore procedures
- Vercel rollback procedures
- environment variable rotation
- user administration
- authentication troubleshooting
- security incident handling
