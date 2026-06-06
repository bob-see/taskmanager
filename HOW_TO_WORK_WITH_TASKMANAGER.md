# TaskManager AI Quick Start

## Read This First

Before making significant changes to TaskManager, read:

PROJECT_PLAYBOOK.md

---

## Core Principles

TaskManager prioritises:

- Speed
- Simplicity
- Visibility
- Low friction
- Practical daily use

---

## Key Rules

1. Preserve multi-user security.
2. Preserve profile-based workflows.
3. Preserve visibility.
4. Preserve simplicity.
5. Prefer enhancing existing screens over creating new ones.
6. Avoid enterprise-style workflows unless specifically requested.
7. Test before marking work complete.
8. Never expose another user's data.
9. When in doubt, choose the lower-friction solution.

---

## User Visibility Rules

- Before exposing users in any picker, dropdown, search result or API response, check group visibility.
- Standard users should only receive users who share a group with them.
- Admin users may operate across the groups they belong to.
- Do not expose out-of-group users and rely on the frontend to hide them.
- Future task assignment must use this same visibility model.

---

# Design Questions

Before adding a new screen ask:

Can this be added to Overview?

Before adding a new workflow ask:

Can an existing workflow be extended?

Before adding a new setting ask:

Will users actually change it?

Before adding complexity ask:

Is this solving a real problem that exists today?

Before creating a new module ask:

Can this be achieved by extending an existing module?

TaskManager should grow through practical use rather than feature accumulation.

---

## Deployment Reminder

Before major changes:

- Commit changes
- Push to GitHub
- Create SQL backup
- Verify Railway database
- Verify Vercel deployment

Refer to PROJECT_PLAYBOOK.md for detailed procedures.
