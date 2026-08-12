# Workflow Templates — Version 1 Design

**Status:** Product and technical design proposed; implementation not started  
**Scope:** Reusable personal workflows, named launches, date-based task creation, and project-like Workflow Run cards

## 1. Product decision summary

A **Workflow** is a reusable, user-owned definition of a repeatable business
process. It is managed under **Tools → Workflows** and is separate from active
work in a Profile.

A **Workflow Run** is one engagement of a Workflow. It creates ordinary
TaskManager tasks in one selected Profile and groups them in a project-like Run
card. A Run is named at launch so the same Workflow can be launched multiple
times for different properties or matters:

```text
Ruby10.1 Auction Prep
Gran24 Auction Prep
```

Version 1 is deliberately personal:

- Workflows are visible and editable only by their owning user.
- A Workflow may be launched into any Profile belonging to that user.
- Generated tasks are never assigned to another user.
- Sharing, delegation, dependencies, recurring Workflow tasks, scheduled
  launches, and Workflow-generated notifications are deferred.

## 2. Workflow definition

### Workflow

The Workflow definition contains:

- `name` — reusable Workflow name, for example `Auction Prep`;
- optional description;
- one category string applied to every generated task;
- active or archived status;
- owning user; and
- ordered Workflow task definitions.

There is no default Profile. The launch selects the target Profile, which makes
one Workflow reusable across the user's Profiles without spanning Profiles in a
single Run.

Version 1 continues to use the existing free-text category model. A Workflow
has one category value and each generated task receives that value. A proper
Category model is not required for this feature.

### Workflow task definition

Each ordered task definition contains:

- title;
- reusable instruction/note text;
- start-date rule relative to the Workflow Date;
- due-date rule relative to the Workflow Date; and
- priority default.

Version 1 does not include Waiting On, task dependencies, recurrence, task-level
category overrides, task-level project overrides, or assignment. The task
definition editor should use plain-language date controls rather than exposing
the word “offset”, for example:

| Field | Example choices |
|---|---|
| Start | On Workflow Date; 1 day before; 1 day after |
| Due | No due date; same day as Start; on Workflow Date; 2 days before |

The stored representation remains integer calendar-day offsets and a due-date
rule. Date-only values are calculated in the application calendar and must not
shift because of timezone conversion.

## 3. Workflow Run and generated tasks

### Workflow Run

The Workflow Run is both the launch record and the project-like grouping
container. It retains:

- Workflow reference;
- Workflow name snapshot;
- required user-entered launch name;
- target Profile;
- Workflow Date;
- category snapshot;
- launching user;
- launch timestamp;
- idempotency/request key; and
- created-task count.

The visible card title is:

```text
<launch name> <workflow name snapshot>
```

The launch name is required and cannot be removed. It is the distinguishing
label for separate Runs. Existing cards keep their Workflow name snapshot if
the reusable Workflow is later renamed.

### Generated Task relationship

Generated tasks remain ordinary `Task` records. They retain their normal Profile,
dates, category, notes, priority, completion lifecycle, action button, and
existing reporting behaviour, plus an optional `workflowRunId` reference.

The Workflow Run card is derived from its generated tasks:

- show in active Profile work while at least one generated task is incomplete;
- hide from active work when all generated tasks are complete;
- remain discoverable through Done/history views; and
- return to active work if a generated task is reopened.

Deleting one generated task does not remove the Run. The Run remains while any
other generated task is incomplete. If the final remaining task is deleted, the
Run should be retained as a completed/empty historical Run rather than silently
destroying its traceability; this edge case should be represented explicitly in
the UI and tested.

## 4. Workflow management

The sidebar contains **Tools → Workflows** with:

- Active and Archived views;
- create Workflow;
- edit Workflow;
- reorder Workflow tasks;
- archive Workflow;
- restore Workflow; and
- duplicate Workflow.

Archiving prevents new launches but does not change existing Runs or generated
tasks. Permanent Workflow deletion is not offered in Version 1.

Editing a Workflow affects future launches only. Existing Workflow Runs retain
their name, category, dates, notes, priority, and task set.

The editor must require at least one task, a non-blank Workflow name, a valid
category choice or explicit blank category, non-blank task titles, valid date
rules, and a stable order. Archived Workflows cannot be launched.

## 5. Launch flow

Launching may begin from **Add Task → + Workflow** in a Profile context. The
target Profile is preselected when launched from that Profile; a launch surface
available outside a Profile must allow the user to choose any Profile they own.

The flow is:

1. Choose an active Workflow.
2. Choose the target Profile if not already known.
3. Enter the required launch name.
4. Choose the Workflow Date.
5. Calculate all task start and due dates.
6. Preview the complete Run.
7. Optionally adjust individual dates, notes, and priority values.
8. Confirm launch.

The preview shows the launch name, Workflow name, Profile, category, each task
title, dates, note/instruction, priority, and the final Run card title. Preview
does not write tasks or a Run record.

## 6. Transaction and duplicate protection

Launch creation is one server-side transaction:

1. authenticate the user;
2. validate Workflow ownership and active status;
3. validate target Profile ownership;
4. re-evaluate all date and field calculations on the server;
5. validate the submitted preview overrides;
6. create the Workflow Run;
7. create every generated Task with the Run reference; and
8. commit only if every task succeeds.

Any failure rolls back the Run and all tasks.

The client creates an idempotency key for each launch attempt. The database
enforces uniqueness for that key within the owning user/launch operation. A
browser retry therefore returns or reuses the original Run, while a new
intentional launch of the same Workflow on the same Profile and date remains
valid because it receives a new idempotency key and launch name.

The final launch control is disabled immediately after submission, but this is
only a usability measure; the server and database are the real protection.

## 7. Permissions and isolation

Version 1 server rules are:

- only the owning user can list, read, create, edit, archive, restore, duplicate,
  or launch their Workflows;
- a launch target Profile must belong to the authenticated user;
- a Workflow Run and its generated tasks are visible through that user's Profile
  ownership and normal TaskManager access rules;
- request data cannot select another user's Workflow, Profile, or Run; and
- no Workflow permission model or cross-user sharing table is needed in Version 1.

Hidden sidebar controls are not an authorisation boundary. Every Workflow and
launch API must repeat the ownership checks server-side.

## 8. Proposed data model

The exact Prisma names may change during implementation, but the relationships
should be equivalent to:

```text
User 1──* Workflow 1──* WorkflowTask
                  1──* WorkflowRun *──1 Profile
                                  1──* Task
```

Suggested fields:

### `Workflow`

- `id`, `userId`, `name`, `description`, `category`;
- `status` (`ACTIVE` or `ARCHIVED`);
- `createdAt`, `updatedAt`.

### `WorkflowTask`

- `id`, `workflowId`, `position`, `title`, `notes`;
- `startOffsetDays`, `dueRule`, `dueOffsetDays` where applicable;
- `isPriority`;
- `createdAt`, `updatedAt`.

### `WorkflowRun`

- `id`, `workflowId`, `userId`, `profileId`;
- `launchName`, `workflowNameSnapshot`, `categorySnapshot`;
- `workflowDate`, `launchedAt`, `idempotencyKey`;
- `createdTaskCount`, `completedAt` or an explicit derived/completion state;
- `createdAt`, `updatedAt`.

### `Task`

- optional `workflowRunId` relation and index.

All new relations must follow the repository's application-level ownership
checks and migration workflow. The existing `relationMode = "prisma"` means the
launch transaction and deletion behaviour require direct tests; schema
relations alone are not an integrity guarantee.

## 9. Verification requirements

Before release, test:

- Workflow ownership and unauthorised API access;
- Profile selection limited to the current user;
- active/archive/restore/duplicate lifecycle;
- task ordering and validation;
- date-only calculations around Brisbane midnight and UTC boundaries;
- start and due rules, including negative and positive calendar days;
- reusable notes and priority defaults copied into generated tasks;
- launch-time date, note, and priority overrides;
- preview creates no database records;
- transaction rollback after any task creation failure;
- idempotent browser retry versus intentional duplicate launch;
- generated task completion, deletion, and reopening;
- Run card active/done visibility;
- archived Workflow rejection at launch;
- desktop/mobile and keyboard-accessible management and launch flows; and
- ordinary task actions, reporting, and Profile isolation after launch.

## 10. Delivery sequence

1. Add and validate the Prisma models/migration.
2. Build the shared date-calculation and preview service with unit tests.
3. Build Tools → Workflows management and archive/restore behaviour.
4. Add Workflow Run/card rendering to Profile active and Done views.
5. Add the Add Task → + Workflow launch flow.
6. Add the transactional launch API and idempotency protection.
7. Complete ownership, rollback, date-boundary, responsive, and accessibility
   verification before enabling the feature for normal use.
