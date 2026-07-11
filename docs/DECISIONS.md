# TaskManager Architecture Decision Records

This file is the register of accepted architecture decisions for TaskManager.

Use it to record why significant architectural, security, data-model, operational or product-structure decisions were made. It should not duplicate the full architecture reference in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## ADR Format

Each ADR uses:

- ADR number
- Status
- Date
- Context
- Decision
- Rationale
- Consequences
- Related documents
- Review trigger

## ADR Register

| ADR | Title | Status | Date |
|---|---|---|---|
| ADR-001 | Overview Is the Primary Workspace | Accepted | 2026-06-06 |
| ADR-002 | Profiles Represent Work Contexts, Not Permission Boundaries | Accepted | 2026-06-06 |
| ADR-003 | Groups Define User Visibility | Accepted | 2026-06-06 |
| ADR-004 | Collaborative Spaces Are Structured Workflow Tools | Accepted | 2026-06-06 |
| ADR-005 | Use Prisma Relation Mode for Legacy Database Compatibility | Accepted | 2026-06-06 |
| ADR-006 | Use a Central Notification Dispatcher | Accepted | 2026-07-11 |
| ADR-007 | Treat Browser Push as a Notification Delivery Channel | Accepted | 2026-07-11 |
| ADR-008 | Use Migration-First Database Evolution | Accepted | 2026-07-11 |
| ADR-009 | Use Repository-First Documentation | Accepted | 2026-07-11 |

---

## ADR-001: Overview Is the Primary Workspace

**Status:** Accepted
**Date:** 2026-06-06

### Context

TaskManager originally contained profile-specific workflows. As the application grew, users needed visibility across all active contexts without switching between profiles.

### Decision

Overview is the primary operational workspace for cross-profile planning and task visibility.

### Rationale

Overview reduces navigation friction and gives users a practical picture of work across contexts. It is the natural place for workflows that affect multiple profiles or need broad visibility.

### Consequences

- New cross-profile workflows should be considered for Overview before adding a separate screen.
- Profile pages remain important for focused profile-specific task work.
- Overview controls should apply to the whole Overview page, not a single profile.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`../PROJECT_PLAYBOOK.md`](../PROJECT_PLAYBOOK.md)

### Review Trigger

Review before introducing a new cross-profile dashboard, command center or major workflow that bypasses Overview.

---

## ADR-002: Profiles Represent Work Contexts, Not Permission Boundaries

**Status:** Accepted
**Date:** 2026-06-06

### Context

Profiles could have been treated as user containers or permission boundaries. Current usage shows that profiles represent contexts such as Sales, DREAM, Personal, Prospecting or TaskManager.

### Decision

Profiles represent work contexts. They are not users and should not become the primary security or collaboration boundary.

### Rationale

Users often operate across multiple contexts in a single day. Treating profiles as contexts supports multi-role workflows without conflating workspace organisation with user identity.

### Consequences

- Profile ownership still matters for user-owned tasks, projects, time entries and check-ins.
- User visibility and collaboration boundaries belong elsewhere, primarily groups and space memberships.
- New permission models should not overload profiles as account-like containers.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`../PROJECT_PLAYBOOK.md`](../PROJECT_PLAYBOOK.md)

### Review Trigger

Review if profiles are proposed as team accounts, shared permission containers or primary access-control boundaries.

---

## ADR-003: Groups Define User Visibility

**Status:** Accepted
**Date:** 2026-06-06

### Context

TaskManager needed delegated task assignment and Collaborative Spaces membership without exposing every user to every other user.

### Decision

Groups define user visibility and collaboration discovery. Non-admin users can see themselves and users who share a group. Admin users have broader visibility.

### Rationale

Profiles already represent work contexts and should not become permission boundaries. Groups provide a cleaner model for deciding which users can see and interact with one another.

### Consequences

- User pickers, dropdowns, search results and APIs must apply group visibility.
- Delegated task recipient selection uses the group visibility model.
- Collaborative Spaces member selection uses the group visibility model.
- Frontend hiding is not sufficient; server routes must enforce visibility.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`../HOW_TO_WORK_WITH_TASKMANAGER.md`](../HOW_TO_WORK_WITH_TASKMANAGER.md)

### Review Trigger

Review before adding any new feature that exposes users, assigns work, invites members or changes admin visibility.

---

## ADR-004: Collaborative Spaces Are Structured Workflow Tools

**Status:** Accepted
**Date:** 2026-06-06

### Context

Collaborative Spaces were introduced after structured operational workflows, such as property campaign tracking, needed shared visibility beyond profile task lists.

### Decision

Collaborative Spaces are structured workflow tools, not generic project boards.

### Rationale

The successful use case is shared operational tracking with rows, columns, statuses, cells, notes and member permissions. Keeping the model workflow-oriented preserves clarity and avoids duplicating general task/project features.

### Consequences

- Spaces should prioritise workflow visibility, status tracking and collaboration.
- Space member and owner permissions remain distinct from profile ownership.
- Column lifecycle is explicit: archive hides columns while preserving existing cells; permanent deletion is destructive and must not be allowed while cells still reference the column.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)

### Review Trigger

Review before turning Spaces into generic project boards, replacing profile task lists or weakening member/owner permissions.

---

## ADR-005: Use Prisma Relation Mode for Legacy Database Compatibility

**Status:** Accepted
**Date:** 2026-06-06

### Context

Adding relational models against the live Railway/MariaDB database encountered physical foreign-key issues because some legacy tables used MyISAM, which does not support foreign keys.

### Decision

Use Prisma `relationMode = "prisma"` so Prisma models relationships at the application layer rather than requiring database-enforced foreign keys.

### Rationale

This avoids breaking existing live data while allowing the Prisma schema to model relationships consistently.

### Consequences

- Prisma can represent relationships without creating physical foreign keys.
- API routes and services must continue enforcing ownership, cascading behavior and integrity rules carefully.
- Database drift and migration behavior require additional operational discipline.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`OPERATIONS_MANUAL.md`](./OPERATIONS_MANUAL.md)
- [`PRISMA_MIGRATION_WORKFLOW.md`](./PRISMA_MIGRATION_WORKFLOW.md)

### Review Trigger

Review only after confirming all production tables and historical migration constraints can safely support a different relation strategy.

---

## ADR-006: Use a Central Notification Dispatcher

**Status:** Accepted
**Date:** 2026-07-11

### Context

Delegated task events need consistent in-app notifications, preference handling, duplicate protection and Push delivery. Duplicating event mapping in each route would make behavior harder to reason about.

### Decision

Use a central notification dispatcher for notification creation and delivery-channel coordination.

### Rationale

The dispatcher centralises event type, target URL, preference evaluation, in-app row creation, event-key duplicate protection and Push delivery handoff.

### Consequences

- Domain routes should call notification adapters or the dispatcher rather than creating notification rows directly.
- In-app and Push channels remain coordinated through one event pipeline.
- Notification behavior should be tested at the dispatcher/service layer where practical.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md)

### Review Trigger

Review before adding another notification source, delivery channel or event mapping path.

---

## ADR-007: Treat Browser Push as a Notification Delivery Channel

**Status:** Accepted
**Date:** 2026-07-11

### Context

TaskManager supports database-backed in-app notifications and browser/mobile Push notifications. These could have become separate systems with separate mappings and preferences.

### Decision

Browser Push is a delivery channel for the existing notification pipeline, not a separate notification system.

### Rationale

One notification event should be able to produce in-app and Push delivery according to user preferences. This keeps target URLs, event copy, duplicate protection and permissions consistent.

### Consequences

- Push uses the same notification type and target URL semantics as in-app notifications.
- Push subscriptions are device-specific, but event eligibility is user- and type-specific.
- Push delivery is best-effort and must not roll back delegated task actions or in-app notifications.
- Active-tab suppression and click handling live in the service worker.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md)

### Review Trigger

Review before adding new Push-only event types, Push-specific routing, background queues or another delivery channel.

---

## ADR-008: Use Migration-First Database Evolution

**Status:** Accepted
**Date:** 2026-07-11

### Context

A July 2026 migration-history audit found that some schema changes had previously existed in the Railway database without matching applied migration ledger entries.

### Decision

TaskManager uses migration-first database evolution. Do not use `prisma db push` against the shared Railway database.

### Rationale

Committed migrations keep Prisma schema, migration history and the live database predictable. `prisma db push` can alter live schema without creating or recording a migration, causing future deploys to fail.

### Consequences

- Schema changes require a named Prisma migration.
- Migration SQL must be reviewed.
- Railway changes are applied with `npx prisma migrate deploy`.
- Migration-ledger reconciliation requires investigation and documentation.
- `prisma migrate reset` must not be run against production data.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`MIGRATION_HISTORY.md`](./MIGRATION_HISTORY.md)
- [`PRISMA_MIGRATION_WORKFLOW.md`](./PRISMA_MIGRATION_WORKFLOW.md)

### Review Trigger

Review whenever schema drift, duplicate column/table errors, failed migrations or manual database changes are detected.

---

## ADR-009: Use Repository-First Documentation

**Status:** Accepted
**Date:** 2026-07-11

### Context

TaskManager has several documentation layers: README, architecture reference, subsystem docs, ADRs, Playbook guidance, migration docs and generated external snapshots.

### Decision

Repository Markdown documents are the living source of truth for project documentation. Generated PDFs and historical planning notes are supporting references only.

### Rationale

Repository-first documentation keeps guidance close to the implementation, makes documentation review part of normal development, and reduces divergence between code and external notes.

### Consequences

- Each major topic should have one primary document.
- Other documents should link to the owning document rather than duplicate detail.
- `docs/ARCHITECTURE.md` owns current technical architecture.
- `docs/DECISIONS.md` owns accepted decision rationale.
- `PROJECT_PLAYBOOK.md` owns build philosophy and development standards.
- Documentation review is part of the Definition of Done.

### Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`../PROJECT_PLAYBOOK.md`](../PROJECT_PLAYBOOK.md)
- [`../HOW_TO_WORK_WITH_TASKMANAGER.md`](../HOW_TO_WORK_WITH_TASKMANAGER.md)

### Review Trigger

Review when adding a new major document, generating a Playbook snapshot, or making a significant feature or architecture change.
