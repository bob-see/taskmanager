# TaskManager AI Quick Start

This file is a routing guide for coding assistants. It does not replace the repository's source documents.

## Reading Order

Before significant work, read in this order:

1. [`README.md`](./README.md) for project orientation.
2. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for current system structure.
3. Relevant subsystem documents, such as [`docs/PUSH_NOTIFICATIONS.md`](./docs/PUSH_NOTIFICATIONS.md) or migration documentation.
4. [`docs/DECISIONS.md`](./docs/DECISIONS.md) if the work changes architecture, security, data model, operations or significant UX.
5. [`PROJECT_PLAYBOOK.md`](./PROJECT_PLAYBOOK.md) for product philosophy, development standards and Definition of Done.

The current repository implementation remains the source of truth.

## Working Rules

- Preserve multi-user security.
- Preserve profile-based workflows.
- Preserve visibility and low-friction task capture.
- Prefer enhancing existing screens and services before creating new ones.
- Avoid enterprise-style workflows unless specifically requested.
- Never expose another user's data.
- Use group visibility for user pickers, search results and APIs.
- Keep delegated tasks as shared participant workflows; do not move task origin or profile ownership unless the architecture changes deliberately.
- Keep notifications on the central dispatcher path; do not create a parallel notification system.
- Follow the Prisma migration workflow for schema changes.

## Before Reporting Significant Work Complete

Coding assistants must:

- Run or report the relevant verification.
- Review documentation impact.
- Update affected documentation where appropriate.
- Explicitly state when no documentation update is required.

The full documentation Definition of Done lives in [`PROJECT_PLAYBOOK.md`](./PROJECT_PLAYBOOK.md).

## Restricted Features

- The Lost/Hatch countdown is owner-restricted.
- Normal users should not see the floating Lost timer or Lost menu link.
- The Lost route must remain protected server-side.

## Design Questions

Before adding a new screen, workflow, setting or module, ask:

- Can this extend Overview or an existing workflow?
- Does this reduce friction or create friction?
- Will users actually change this setting?
- Is this solving a real problem that exists today?

TaskManager should grow through practical use rather than feature accumulation.
