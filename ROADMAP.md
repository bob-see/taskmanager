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
- Launching begins from the existing **Add Task** dialog through a **+ Workflow** option.
- Editing a Workflow affects future launches only. Tasks created by earlier launches remain unchanged.
- Workflows should be archived rather than deleted where practical.

#### Profiles and Users

Profiles are personal workspaces belonging to an individual TaskManager user. Simon, Sales, DREAM, and other work areas may all be Profiles belonging to that user; they are not separate application users.

- Each Workflow has one default Profile.
- Every task created from a Version 1 Workflow belongs to the Workflow's selected Profile.
- A single Version 1 Workflow does not span multiple Profiles.
- Version 1 Workflows are launched only for the user launching them.
- Version 1 does not assign Workflow tasks to other TaskManager users.
- Cross-user task assignment and delegation are future enhancements.

#### Workflow Structure

A Workflow records:

- title;
- description;
- default Profile;
- optional default Project;
- optional default Category;
- Workflow access and permissions; and
- Active or Archived status.

Each ordered Workflow task records:

- position;
- title;
- calendar-day offset relative to Workflow Date;
- Due Date rule;
- Waiting On;
- priority;
- notes;
- optional Project override; and
- optional Category override.

### Profile, Project and Category Rules

- A Workflow is associated with one Profile.
- Only active Projects related to that Profile may be selected.
- Only Categories related to that Profile may be selected.
- Categories are permanent once used and are not archived.
- If a referenced Project or Profile is later archived, the Workflow management screen shows a warning.
- Invalid or archived references must be resolved before launch.
- The creator may select which other TaskManager users may manage, view, or launch the Workflow.
- Workflow-level access follows a collaboration model comparable to Collaborative Spaces.
- Workflow access does not allow tasks to be assigned to another user in Version 1.

Project and Category values resolve in this order:

1. task-specific override;
2. launch override;
3. Workflow default;
4. existing normal task default where no Workflow value applies.

A launch-level Project or Category override replaces only the Workflow default. It does not replace an explicit task-specific override.

### Workflow Date and Date Rules

- Workflow Date is date-only.
- Task Start Dates and Due Dates are date-only.
- Version 1 offsets use calendar days only.
- Date calculations must be consistent so timezone conversion cannot shift the intended calendar date.
- Negative offsets mean days before Workflow Date.
- Zero means on Workflow Date.
- Positive offsets mean days after Workflow Date.

Version 1 supports these Due Date rules:

- no Due Date;
- Due Date equals the calculated Start Date; or
- Due Date equals the Workflow Date.

Custom Due Date offsets are a possible later enhancement, not Version 1 scope.

### Waiting On

Waiting On uses TaskManager's existing user-facing task field and behaviour:

- it is free-text;
- previous entries are remembered and may appear in a dropdown;
- it does not represent task dependencies; and
- it does not assign work to another person.

Task dependencies are not included in Version 1.

### Workflow Launching

The proposed launch experience is:

**Add Task → + Workflow → Choose Workflow → Select Workflow → Select Workflow Date → Preview → Create or Launch**

Before launch, users may override the Workflow-level default Project and Category.

Preview displays:

- task title;
- calculated Start Date;
- Due Date where applicable;
- Waiting On;
- priority;
- Profile;
- Project;
- Category; and
- future repeat settings when recurrence is eventually supported.

The final launch button is disabled immediately after it is clicked to prevent accidental double-click submission. Server-side duplicate protection or idempotency must also prevent browser retries or interrupted responses from creating the same launch twice.

Duplicate protection must not prohibit intentional, separate launches of the same Workflow on the same date.

### Workflow Launch Record

A dedicated Workflow Launch record is part of the intended architecture. It provides traceability without requiring a dedicated Workflow History screen in Version 1.

The record conceptually retains:

- Workflow reference;
- Workflow name snapshot;
- Workflow Date;
- launch date and time;
- user who launched it;
- Profile;
- applied Project and Category launch overrides;
- number of tasks created; and
- unique Workflow Launch ID.

Created tasks retain a reference to their Workflow Launch. A future Workflow History interface may use this data later.

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
- Workflow-level access and permissions;
- Profile restrictions;
- Project and Category inheritance and override rules;
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
- manage Workflow access;
- ordered Workflow tasks;
- drag-and-drop ordering with an accessible non-drag alternative; and
- validation of Profile, Project and Category selections.

**Acceptance direction:** An authorised user can create and maintain an ordered reusable Workflow, but launching does not yet need to be enabled.

### Milestone 3 — Workflow Preview and Calculation Engine

Deliver in the future:

- Workflow selection;
- Workflow Date;
- date calculation service;
- Due Date calculation;
- Profile, Project and Category resolution;
- validation warnings;
- deterministic preview; and
- no database task creation during preview.

**Acceptance direction:** The preview accurately represents the tasks that would be created for the selected Workflow and date.

### Milestone 4 — Transactional Workflow Launch

Deliver in the future:

- **Add Task → + Workflow**;
- launch flow;
- Workflow Launch record;
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
- Profile, Project and Category validation tests;
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
