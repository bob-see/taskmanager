# TaskManager Product Roadmap

## Purpose

This document records TaskManager's future product direction and deliberate product milestones. It is not a changelog, release log, backlog dump, or engineering maintenance checklist.

Priorities and sequencing express current direction rather than promised dates. Completed work belongs in Git history and the documents that describe the current system. This roadmap should remain concise and change as real use clarifies product needs.

## Roadmap Principles

- Projects represent active work.
- Workflows represent reusable business processes.
- Profiles are personal workspaces or categories of work belonging to an individual user; they are not separate application users.
- Product capabilities should remain understandable and focused.
- Completed work belongs in Git history and supporting documentation.
- Future milestones should solve genuine product or engineering needs rather than create maintenance for its own sake.
- Large capabilities should be divided into independently testable milestones.
- Roadmap sequencing may change as TaskManager is used and refined.

## Current Product Direction

### Workflow Templates

- **Priority:** Medium-high
- **Direction:** Confirmed; implementation has not started.

Workflow Templates are the next significant product initiative. A Workflow is a reusable template that creates one or more tasks relative to a selected **Workflow Date**.

The confirmed product model is:

- Workflows live under **Tools → Workflows**.
- Projects represent active work; Workflows represent repeatable processes.
- Workflows are created and managed separately from launching them.
- Launching begins from the existing **Add Task** dialog through a **+ Workflow** option, and may target any Profile belonging to the launching user.
- Editing a Workflow affects future launches only. Tasks created by earlier launches remain unchanged.
- Workflows are archived rather than deleted.
- Each launch creates a named, project-like Workflow Run card containing ordinary generated tasks. The Run card leaves active work when all its tasks are complete and remains available through Done/history views.
- The detailed Version 1 product and technical design is in [`docs/WORKFLOW_TEMPLATES_DESIGN.md`](./docs/WORKFLOW_TEMPLATES_DESIGN.md).

#### Profiles and Users

Profiles are personal workspaces belonging to an individual TaskManager user. Simon, Sales, DREAM, and other work areas may all be Profiles belonging to that user; they are not separate application users.

- A Workflow definition is user-owned and Profile-independent.
- Each Workflow Run targets one Profile selected at launch.
- Every task created from a Version 1 Workflow belongs to that Workflow Run's selected Profile.
- Version 1 Workflows are launched only for the user launching them.
- Version 1 does not assign Workflow tasks to other TaskManager users.
- Workflow sharing, cross-user task assignment, and delegation are future enhancements.

#### Workflow Structure

A Workflow records:

- title;
- description;
- one Workflow-level Category value; and
- Active or Archived status.

Each ordered Workflow task records:

- position;
- title;
- Start and Due Date rules relative to Workflow Date;
- priority;
- reusable notes/instructions.

### Profile and Category Rules

- A Workflow is owned by one TaskManager user and is not associated with a Profile until launch.
- The launch target Profile must belong to the launching user.
- One Workflow-level Category value is copied to every generated task; Version 1 continues to use the existing free-text category model.
- Workflow sharing and access permissions are not included in Version 1.

Category values resolve from the Workflow value, with permitted launch-time task edits taking precedence. Version 1 does not create a Project for a Workflow Run or support project/category selection overrides.

### Workflow Date and Date Rules

- Workflow Date is date-only.
- Task Start Dates and Due Dates are date-only.
- Version 1 offsets use calendar days only.
- Date calculations must be consistent so timezone conversion cannot shift the intended calendar date.
- Negative offsets mean days before Workflow Date.
- Zero means on Workflow Date.
- Positive offsets mean days after Workflow Date.

The Workflow editor presents date rules in plain language, such as “On Workflow Date”, “1 day after”, “same day as Start”, or “2 days before”. The stored values remain date-only calendar-day rules. Task dependencies are not included in Version 1.

### Workflow Launching

The proposed launch experience is:

**Add Task → + Workflow → Choose Workflow → Select Workflow → Select Workflow Date → Preview → Create or Launch**

The launch requires a user-entered Run name. The final card title combines the Run name with the immutable Workflow name snapshot, for example `Ruby10.1 Auction Prep`.

At launch, users may adjust individual task dates, notes, and priority values. Workflow notes and priority defaults are copied into generated tasks.

Preview displays:

- task title;
- Workflow Run card title;
- calculated Start Date;
- Due Date where applicable;
- priority;
- Profile;
- Category; and
- future repeat settings when recurrence is eventually supported.

The final launch button is disabled immediately after it is clicked to prevent accidental double-click submission. Server-side duplicate protection or idempotency must also prevent browser retries or interrupted responses from creating the same launch twice.

Duplicate protection must not prohibit intentional, separate launches of the same Workflow on the same date.

### Workflow Launch Record

A dedicated Workflow Launch record is part of the intended architecture. It provides traceability without requiring a dedicated Workflow History screen in Version 1.

The record conceptually retains:

- Workflow reference;
- Workflow name snapshot;
- user-entered Run name;
- Workflow Date;
- launch date and time;
- user who launched it;
- Profile;
- Category snapshot;
- number of tasks created; and
- unique Workflow Launch ID.

Created tasks retain a reference to their Workflow Run. A future Workflow History interface may use this data later.

### Transactional Creation

Launching a Workflow is transactional:

- either every task is created;
- or no task is created;
- partial Workflow creation is never acceptable.

Preview and creation rely on the same calculation rules so the preview cannot differ from the final result.

## Workflow Templates Milestones

### Milestone 1 — Workflow Domain Design

**Status:** Product direction agreed; implementation not started.

Resolve and document:

- Workflow and Workflow-task domain model;
- Workflow ownership and the Version 1 no-sharing boundary;
- target Profile restrictions;
- Category inheritance and launch-time task overrides;
- date-only handling;
- calendar-day offset calculations;
- Due Date rules;
- Workflow Launch record;
- launch validation;
- duplicate-launch protection; and
- transactional creation boundaries.

**Acceptance direction:** The product rules and intended data relationships are clear enough that implementation can begin without unresolved product decisions.

### Milestone 2 — Workflow Management Foundation

Deliver in the future:

- **Tools → Workflows**;
- active and archived Workflow views;
- create and edit Workflows;
- archive and restore;
- duplicate;
- ordered Workflow tasks;
- drag-and-drop ordering with an accessible non-drag alternative; and
- validation of Profile, Category, and task date selections.

**Acceptance direction:** A user can create and maintain an ordered reusable Workflow, including reusable notes, priority defaults, date rules, and archive/restore behaviour.

### Milestone 3 — Workflow Preview and Calculation Engine

Deliver in the future:

- Workflow selection;
- Workflow Date;
- date calculation service;
- Due Date calculation;
- target Profile and Category resolution;
- validation warnings;
- deterministic preview; and
- no database task creation during preview.

**Acceptance direction:** The preview accurately represents the tasks that would be created for the selected Workflow and date.

### Milestone 4 — Transactional Workflow Launch

Deliver in the future:

- **Add Task → + Workflow**;
- launch flow;
- named Workflow Run record and project-like Run card;
- transactional task creation;
- technical duplicate protection;
- task traceability;
- success confirmation;
- number of tasks created;
- **View Tasks**; and
- **Close**.

**Acceptance direction:** A Workflow creates the complete expected set of tasks exactly once or creates nothing.

### Milestone 5 — Workflow Verification and Adoption

Deliver in the future:

- automated calculation tests;
- transaction rollback tests;
- permissions tests;
- Profile and Category validation tests;
- timezone and date-boundary tests;
- duplicate-submission tests;
- desktop and mobile review;
- accessibility review;
- operational use with genuine Workflows such as Auction or Employee Onboarding; and
- refinement based on real usage.

**Acceptance direction:** Workflow Templates are reliable enough for real repeatable business processes.

## Future Workflow Enhancements

These are later possibilities and are not part of Version 1.

### Recurring Workflow Tasks

After the core Workflow capability is operating reliably, investigate allowing a Workflow task to initialise TaskManager's existing recurring-task capability.

Potential settings include:

- repeat frequency;
- repeat interval;
- repeat end date; and
- repeat for a specified number of occurrences.

Any future design must:

- reuse the existing recurrence engine rather than create a Workflow-specific recurrence system;
- define whether the initial task counts as occurrence one;
- define how Start Date and Due Date interact with recurrence;
- ensure recurring descendants preserve suitable Workflow Launch traceability; and
- include repeat settings in Preview before launch.

Recurring Workflow tasks are not included in Version 1.

### Cross-User Workflow Assignment

Future capability only: investigate allowing a Workflow launched by one user to assign selected tasks to other TaskManager users.

This may include:

- per-task user assignment;
- delegation and acceptance rules;
- notifications;
- permissions;
- audit history;
- cross-user visibility; and
- interaction with Collaborative Spaces.

Cross-user assignment, delegation, and Workflow-generated notifications are not included in Version 1.

### Other Later Possibilities

The following are possibilities, not committed Version 1 scope:

- scheduled automatic Workflow launches;
- Workflow Launch History interface;
- business-day and holiday-aware offsets;
- custom Due Date offsets;
- task dependencies;
- conditional tasks or branching;
- Workflow versioning;
- bulk import or export;
- Workflow analytics;
- editing or repeating a previous launch;
- launching Workflows for another user; and
- multi-Profile Workflows, only if genuine use cases later justify them.

## Engineering Health

Engineering-health work belongs here only when it deliberately enables product growth, reduces material risk, or prepares a significant feature phase.

### Developer Onboarding Documentation

**Priority:** Medium

Create future documentation that enables a new contributor to clone, run, understand, test, and safely contribute to TaskManager without relying on verbal guidance.

### Engineering Health Review

**Priority:** Medium-low

Before a major release or significant feature phase, deliberately review:

- architecture;
- security;
- dependencies;
- tests; and
- documentation.

This is not a recurring calendar obligation. It should occur when meaningful product growth justifies it.

### Deferred Dependency Compatibility Review

**Priority:** Low

Reassess intentionally deferred dependency alerts when compatible upstream package releases become available.

Browser-facing features—including PWA behaviour, Media Session, notifications, installation, and browser APIs—should include compatibility review in their feature Definition of Done whenever those capabilities change. Periodic browser compatibility review is not a standalone roadmap item.

## Explicitly Out of Scope for the Roadmap

Once complete, the following do not belong as future roadmap items:

- completed security hardening;
- completed dependency updates;
- completed GitHub security improvements;
- completed CodeQL remediation;
- completed hydration fixes;
- completed recurring-task carry-forward improvements;
- completed LOST audio or Media Session work;
- completed README or documentation rationalisation; and
- completed Engineering Playbook work.

These belong in Git history, release notes, architecture notes, or engineering documentation as appropriate.
