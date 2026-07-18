# TaskManager

TaskManager is a multi-user work management application for practical day-to-day task tracking, delegated work, lightweight collaboration, time logging, reporting, and notifications. It is designed for individuals and small teams managing work across several responsibilities without the process overhead of a large project-management platform.

The repository is suitable for public technical review, but the deployed application, its accounts, and its data are private/internal. Do not place private identities, credentials, production data, or environment values in repository content.

## Current Status

TaskManager is an actively maintained Next.js App Router application backed by Prisma and MariaDB. The living repository and Markdown documentation are authoritative; generated publications are reviewed snapshots.

The project currently requires Node.js 22.13.0 or later. Its framework and database packages are maintained as aligned, supported sets, with remaining security and technical-debt items tracked in the architecture and security documents.

## Key Capabilities

- Credentials-based multi-user authentication with server-side ownership and access checks.
- Profiles as separate work contexts, with Tasks and Projects for planning and delivery.
- Day, week, month, active, upcoming, overdue, paused, done, and archived task workflows.
- Recurring task occurrences that carry forward while outstanding and retain their future schedule.
- Cross-profile Overview for filtering, grouping, sorting, and acting on current work.
- Delegated Tasks with participant-specific lifecycle actions, shared notes, and notifications.
- Collaborative Spaces for member-managed matrix-style workflows.
- In-app notifications plus Browser Push, including multiple device subscriptions.
- Responsive web and installed PWA use, subject to browser and platform capabilities.
- Manual and timer-based timesheets, reports, and administrator activity views.
- Specialised Routine Support and Sunday Check-in workflows for enabled profiles.

Detailed behaviour, permissions, data relationships, and known limitations belong in the linked owning documents rather than this overview.

## Quick Start

### Prerequisites

- Node.js 22.13.0 or later. Use `nvm use` to select the version in `.nvmrc`.
- npm compatible with the repository lockfile.
- Access to a MariaDB-compatible database.
- An approved development account. A routine first-administrator bootstrap is not currently provided for a completely empty installation.
- Local values for the documented database, authentication, and Browser Push environment variables.

### Install and configure

```sh
npm install
cp .env.example .env
```

Replace the placeholders in `.env` with values for your local environment. Never commit real credentials or production configuration.

### Run locally

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Confirm which database the environment targets before performing any action that writes data.

## Essential Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server. |
| `npm test` | Run the current Node test suite. |
| `npm run lint` | Run repository-wide ESLint checks; known baseline debt is documented in Testing. |
| `npm run build` | Create a production Next.js build. |
| `npx tsc --noEmit` | Run TypeScript checking without emitting files. |
| `npx prisma generate` | Generate Prisma Client from the current schema. |
| `npx prisma validate` | Validate Prisma schema and configuration. |
| `npx prisma migrate status` | Inspect migration status for the configured database; confirm the target first. |
| `npm run db:integrity:audit` | Run the read-only aggregate relationship audit against the configured database. |
| `npm run docs:playbook` | Build the Engineering Playbook publication. |
| `npm run docs:playbook:qa` | Render publication pages and contact sheets for visual QA. |

Schema changes and shared-database operations must follow the [Prisma Migration Workflow](./docs/PRISMA_MIGRATION_WORKFLOW.md). Do not use `prisma db push` or `prisma migrate reset` against shared Railway data.

## Documentation Map

Each major topic has one primary owner. Follow the link rather than relying on a duplicated summary elsewhere.

| Document | Owns |
|---|---|
| [Architecture](./docs/ARCHITECTURE.md) | How the application is structured, how major systems interact, and the active technical-debt/review register. |
| [Security](./docs/SECURITY.md) | Authentication, authorisation, ownership, collaboration boundaries, security invariants, and review triggers. |
| [Testing](./docs/TESTING.md) | Current automated coverage, verification commands, manual workflows, gaps, and change-based test expectations. |
| [Architecture Decisions](./docs/DECISIONS.md) | Why significant architecture, security, data, operational, and UX decisions were made. |
| [Project Playbook](./PROJECT_PLAYBOOK.md) | Product philosophy, the engineering workflow, development standards, documentation strategy, and Definition of Done. |
| [AI Quick Start](./HOW_TO_WORK_WITH_TASKMANAGER.md) | Brief routing and working rules for AI-assisted development sessions. |
| [Push Notifications](./docs/PUSH_NOTIFICATIONS.md) | Browser Push architecture, preferences, subscriptions, badges, troubleshooting, and device testing. |
| [Operations Manual](./docs/OPERATIONS_MANUAL.md) | Deployment and operational procedures. |
| [Prisma Migration Workflow](./docs/PRISMA_MIGRATION_WORKFLOW.md) | Mandatory process for designing, testing, reviewing, and deploying migrations. |
| [Migration History](./docs/MIGRATION_HISTORY.md) | Reconciled migration history and historical context. |
| [Engineering Playbook manuscript](./docs/ENGINEERING_PLAYBOOK_V2_SOURCE.md) | Source Markdown for the broader Engineering Playbook publication. |
| [Publication system](./docs/publication/README.md) | How the Playbook is assembled, built, verified, and published. |

The current generated snapshot is the [Engineering Playbook Repository Edition v2.0 — Draft 1](<./docs/publication/generated/TaskManager Engineering Playbook - Repository Edition v2.0 - Draft 1.pdf>). It is a retained publication output, not a replacement for the living Markdown.

## Engineering Workflow

TaskManager uses six high-level stages for meaningful engineering work:

1. **Investigate** — inspect the repository, current behaviour, documentation, tests, working tree, and data implications.
2. **Design** — confirm the outcome, scope, ownership rules, constraints, migration implications, and acceptance criteria.
3. **Implement** — make the smallest complete and coherent change without unrelated work.
4. **Verify** — gather risk-appropriate automated, security, manual, browser/device, and deployment evidence.
5. **Document** — update the owning documents, or deliberately record that no documentation change is required.
6. **Commit** — review the final diff and create one intentional, accurately scoped commit when authorised.

The lifecycle is iterative: new evidence can return work to Investigation or Design. The [Project Playbook](./PROJECT_PLAYBOOK.md#engineering-workflow) owns the full practice and relates it to the detailed execution sequence used in the Engineering Playbook.

## Deployment and Operations

TaskManager is built for a Vercel-style Next.js deployment with Railway-hosted MariaDB and VAPID configuration for Browser Push. Use the focused documents for operational work:

- [Operations Manual](./docs/OPERATIONS_MANUAL.md)
- [Prisma Migration Workflow](./docs/PRISMA_MIGRATION_WORKFLOW.md)
- [Push Notifications](./docs/PUSH_NOTIFICATIONS.md)

Do not infer production safety from a successful local build. Confirm the target environment, follow the relevant runbook, and perform risk-appropriate smoke checks.

## Maintenance

TaskManager favours small, evidence-based changes and one authoritative document per topic. Known debt is prioritised in [Architecture](./docs/ARCHITECTURE.md#known-technical-debt--future-review); public setup or capability changes should also prompt a README review.

## Licence

Private project — not licensed for distribution.
