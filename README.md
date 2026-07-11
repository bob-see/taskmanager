# TaskManager

TaskManager is a multi-user work management application for task tracking, delegated work, lightweight collaboration, time logging, reporting, and notifications.

It is designed for practical daily use: fast task capture, clear visibility across work contexts, shared delegated workflows, and enough reporting to understand what is happening without turning the app into a heavy enterprise project-management suite.

## Current Status

TaskManager is an active Next.js application with the following implemented systems:

- Multi-user authentication and user visibility controls.
- Profile-based task and project workspaces.
- Cross-profile Overview workspace.
- Delegated task lifecycle for work assigned between users.
- Collaborative Spaces for structured shared workflows.
- In-app notifications and Browser Push notifications.
- PWA support, including installed-app usage and Home Screen Push support where the platform allows it.
- Timesheets and time reports.
- Productivity, activity, and user reports.
- Prisma/MariaDB migration history reconciled and documented.

The application is currently maintained as a private project and internal collaboration platform.

## Core Concepts

TaskManager is organised around a few concepts that appear throughout the application:

### Profiles

A profile is a work context. Profiles can represent people, areas of responsibility, or specialised workflows. Most task, project, timesheet, report, routine, and check-in views are scoped to one or more profiles.

### Tasks

Tasks are the main unit of work. They can stand alone, belong to a project, repeat on a schedule, carry notes and metadata, or become part of a delegated workflow between users.

### Projects

Projects group related tasks and provide a higher-level planning surface. They are visible in profile views and the Overview workspace.

### Delegation

Delegated tasks are shared work items between two users. The delegated-task workflow records sender, recipient, status, notes, completion, closeout, and notification events.

### Notifications

Notifications are stored in the database for the in-app notification center. Browser Push is implemented as an additional delivery channel for the same domain events, not as a separate notification system.

## Key Features

### Profiles, Tasks, and Projects

- Profiles act as work contexts.
- Tasks support start dates, due dates, completion, priority, categories, notes, recurrence, repeat pauses, and project assignment.
- Projects group related tasks and support priority, collapsed/archived state, due dates, and progress visibility.
- Profile task views support day, week, month, active, upcoming, overdue, paused, done, and archived workflows.

### Overview

- Overview aggregates active work across profiles.
- It supports filtering, sorting, grouping, priority visibility, and task/project actions.
- It is the primary workspace for cross-profile planning.

### Delegated Tasks

- Users can create a delegated task or delegate an existing task.
- Delegated tasks remain shared between delegator and assignee.
- Lifecycle: pending, accepted, in progress, completed, closed, or declined.
- Both participants can add shared notes.
- Delegated task events create notifications.

### Notifications and Push

- In-app notification center with unread counts, mark-read, clear, and archive behavior.
- Notification preferences per delegated-task event type.
- Browser Push delivery for delegated task events.
- Multi-device Push subscriptions per user.
- Service worker handles Push display, active-tab suppression, click routing, and badge updates.

See [Push Notifications](./docs/PUSH_NOTIFICATIONS.md) for implementation and testing details.

### Collaborative Spaces

- Shared matrix-style workspaces with members, rows, columns, cells, statuses, notes, and print views.
- Member and owner permissions are enforced server-side.
- User selection respects group visibility.

### Timesheets and Reports

- Profile-based manual and timer-sourced time entries.
- Week-based timesheet workflow.
- Reports for productivity, time, efficiency, activity, and profile-level work.
- Admin-facing user activity reporting.

## Application Areas

The main application areas are:

- Profile pages for day-to-day task and project work.
- Overview for cross-profile planning.
- Delegated Tasks for assigned-to-me and assigned-by-me workflows.
- Spaces for shared matrix-style collaboration.
- Timesheets for weekly time entry.
- Reports for profile, task, productivity, and activity review.
- Settings for notification preferences and account-level controls.

Some administrative and specialised workflows are intentionally available only to permitted users. Access checks are enforced server-side.

## Technology Stack

- [Next.js](https://nextjs.org/) App Router
- React
- TypeScript
- Prisma
- MariaDB on Railway
- NextAuth credentials authentication
- Tailwind CSS
- Vercel-style deployment
- Browser Push via the Web Push protocol and `web-push`

## Repository Structure

| Path | Purpose |
|---|---|
| `app/` | Next.js routes, layouts, pages, API routes, and feature screens. |
| `app/api/` | Authenticated server endpoints for profiles, tasks, projects, delegated tasks, notifications, Push subscriptions, spaces, timesheets, users, and check-ins. |
| `app/components/` | Shared UI components such as the app shell, sidebar, notification center, editors, modals, and common task controls. |
| `app/lib/` | Server-side utilities and services, including Prisma, notifications, Push delivery, and reporting helpers. |
| `prisma/` | Prisma schema and migration history. |
| `public/` | Static assets, manifest icons, service worker, and media assets. |
| `tests/` | Node test files for recurrence and Push-related behavior. |
| `docs/` | Architecture, ADRs, Push documentation, migration workflow, migration history, and operations notes. |
| `scripts/` | Utility scripts used for project-specific maintenance and inspection. |

## Getting Started

### Prerequisites

- Node.js compatible with the current Next.js version.
- npm.
- Access to a MariaDB-compatible database.
- Required environment variables for database, authentication, and Push configuration.

### Installation

```bash
npm install
```

### Environment Variables

Create local environment configuration using the repository's example file as a guide:

```bash
cp .env.example .env
```

Important variables include:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Do not commit real secrets.

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Migration Workflow

TaskManager uses Prisma migrations. Do not use `prisma db push` against the shared Railway database.

For the required process, read [Prisma Migration Workflow](./docs/PRISMA_MIGRATION_WORKFLOW.md).

### Common Commands

```bash
npm run dev
npm test
npm run build
npm run lint
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Use `npx prisma migrate deploy` for applying committed migrations to the shared Railway database. Do not run schema-changing or migration-ledger-changing commands against shared environments without following the migration workflow.

### Tests

```bash
npm test
```

### Build

```bash
npm run build
```

## Documentation

TaskManager uses repository-first documentation. The implementation is the source of truth, and documentation explains how the implementation works.

Each major topic has one owning document. Other documents should link to that source instead of duplicating detail.

| Document | Purpose |
|---|---|
| [README.md](./README.md) | Project overview and repository entry point. |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical architecture, modules, data model overview, security model, deployment shape, and review register. |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | Architecture Decision Records explaining why major decisions were made. |
| [PROJECT_PLAYBOOK.md](./PROJECT_PLAYBOOK.md) | Development philosophy, workflow standards, documentation strategy, and Definition of Done. |
| [HOW_TO_WORK_WITH_TASKMANAGER.md](./HOW_TO_WORK_WITH_TASKMANAGER.md) | Quick routing guide for AI coding assistants. |
| [docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md) | Browser Push implementation, behavior, troubleshooting, and manual test plans. |
| [docs/PRISMA_MIGRATION_WORKFLOW.md](./docs/PRISMA_MIGRATION_WORKFLOW.md) | Mandatory database migration workflow. |
| [docs/MIGRATION_HISTORY.md](./docs/MIGRATION_HISTORY.md) | Migration-history reconciliation notes. |
| [docs/OPERATIONS_MANUAL.md](./docs/OPERATIONS_MANUAL.md) | Operational notes and deployment procedures. |

When updating the repository, prefer changing the document that owns the topic. For example, Push internals belong in `docs/PUSH_NOTIFICATIONS.md`, architecture changes belong in `docs/ARCHITECTURE.md`, and migration process changes belong in `docs/PRISMA_MIGRATION_WORKFLOW.md`.

## Contributing

TaskManager is maintained with small, intentional changes.

Before making significant changes:

- Read the documentation relevant to the work.
- Preserve server-side security and ownership checks.
- Prefer extending existing services and UI surfaces before adding parallel systems.
- Use Prisma migrations for schema changes.
- Run relevant automated checks.
- Manually verify affected workflows.
- Review documentation impact before marking work complete.

The full Definition of Done is documented in [PROJECT_PLAYBOOK.md](./PROJECT_PLAYBOOK.md).

## Deployment

TaskManager is built for deployment with:

- Vercel-style hosting for the Next.js application.
- Railway-hosted MariaDB for production data.
- Prisma migrations for schema evolution.
- VAPID environment variables for Browser Push.

Deployment and operational details are maintained in focused documentation rather than duplicated here:

- [Operations Manual](./docs/OPERATIONS_MANUAL.md)
- [Prisma Migration Workflow](./docs/PRISMA_MIGRATION_WORKFLOW.md)
- [Push Notifications](./docs/PUSH_NOTIFICATIONS.md)

## Project Status

Stable implemented systems include:

- Profile, project, and task management.
- Overview workspace.
- Delegated task lifecycle.
- In-app notifications and Browser Push delivery.
- Collaborative Spaces.
- Timesheets and reports.
- Prisma/MariaDB migration workflow and reconciliation documentation.

Current improvement areas include documentation maintenance, permission-helper consolidation, broader automated coverage, notification badge behavior review, and operational hardening.

## License

Private project - not licensed for distribution.
