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

## Delegated Tasks

Delegated Tasks are shared task workflows between a delegator and an assignee.

Core principle:

- A delegated task remains a shared object.
- The assignee does the work.
- The original delegator reviews completion and closes the delegated task.
- The underlying task stays in its originating profile/project.
- Do not move profile ownership, project ownership or task origin during delegation.

Pages:

- Assigned To Me shows delegated tasks received by the current user.
- Assigned By Me shows delegated tasks created by the current user.

Creation:

- Users can create a new delegated task.
- Users can delegate an existing task.
- Delegating an existing task must not duplicate the task or move it to the receiver's profile.

Lifecycle:

- Pending
- Accepted
- In Progress
- Completed
- Closed

Workflow:

- Pending tasks can be Accepted or Declined by the assignee.
- Accepted tasks can be started by the assignee.
- In Progress tasks can be marked Completed by the assignee.
- Completed tasks are Awaiting Review for the delegator.
- The delegator closes completed tasks after review.

Notes/activity:

- Both participants can add shared notes.
- Notes attach to the underlying Task through the existing TaskNote system.
- No delegated-note editing/deleting workflow exists yet.

Visual indicators:

- Sender initials badge identifies who delegated the task.
- Delegated status badge identifies lifecycle state.
- Completed delegated tasks display as Awaiting Review.

Future TODOs:

- Add notification badges for new delegated notes and status updates.
- Consider richer delegated metadata/hover details later.
- Maintain a local development database/playground for safer delegated workflow testing.

---

## Restricted Features

- LOST hatch countdown is Bob-only.
- Only robert.bob.see@gmail.com should see the floating LOST timer or LOST menu link.
- The LOST route must remain protected server-side.

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
