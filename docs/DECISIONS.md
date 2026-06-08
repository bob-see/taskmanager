# TaskManager Decisions Log

Use this file to record significant architectural, workflow and UX decisions.

## Template

### YYYY-MM-DD - Decision Title

Context:
- Why the decision was required

Decision:
- What was decided

Reasoning:
- Why this approach was chosen

Alternatives Considered:
- Option A
- Option B

Impact:
- Areas affected

---

## Initial Decisions

### Overview Is Primary Workspace

Decision:
Users primarily work from Overview rather than individual profile pages.

Reasoning:
Provides visibility across contexts and reduces navigation friction.

---

### Profiles Represent Contexts, Not Users

Decision:
Profiles are work contexts (Sales, DREAM, Personal, etc.) rather than security boundaries.

Reasoning:
Supports multi-role workflows.

---

### 2026-06-06 - Overview Is Primary Workspace

Context:
TaskManager originally contained profile-specific workflows.

Decision:
Overview is considered the primary workspace.

Reasoning:
Testing showed most activity occurs from Overview and users prefer cross-profile visibility.

Impact:
Future functionality should be considered for Overview first.

---

### 2026-06-06 - Profiles Represent Contexts

Context:
Profiles could have been designed as user containers.

Decision:
Profiles represent work contexts rather than security boundaries.

Examples:

- Sales
- DREAM
- Personal
- Prospecting
- TaskManager

Reasoning:
Users frequently operate across multiple contexts during the same day.

Impact:
Profiles should not be treated as user accounts or permission boundaries.

---

### 2026-06-06 - Collaborative Spaces Are Workflow Tools

Decision:
Collaborative Spaces are intended to manage structured workflows rather than act as generic project boards.

Reasoning:
The first successful implementation was property campaign tracking and shared operational workflows.

Impact:
Future development should focus on workflow visibility, status tracking and collaboration.

Column lifecycle:
Collaborative Space columns can be archived or permanently deleted. Archived
columns are hidden from active boards while preserving their existing cells.
Permanent deletion is destructive and must not be allowed while cells still
reference the column.

---

### 2026-06-06 - Groups Control User Visibility

Context:
TaskManager needed a way to allow task assignment and Collaborative Spaces membership without exposing every user to every other user.

Decision:
Groups were introduced as the visibility and collaboration boundary between users.

Reasoning:
Profiles already represent work contexts and should not become permission boundaries. Groups provide a cleaner model for deciding which users can see and interact with each other.

Impact:

- Standard users can only see users who share at least one group with them.
- Admins can belong to multiple groups.
- Collaborative Spaces member picker is group-scoped.
- Future assigned-task functionality will use the same visibility rule.

---

### 2026-06-06 - Use Prisma Relation Mode For Legacy Database Compatibility

Context:
Adding group tables caused MySQL errors when Prisma attempted to create physical foreign keys against legacy MyISAM tables.

Decision:
Use Prisma relation mode so Prisma manages relationships at the application layer instead of relying on database-level foreign keys.

Reasoning:
The live Railway/MariaDB database contains legacy MyISAM tables from earlier project history. MyISAM does not support foreign keys. Prisma relation mode avoids breaking existing data while allowing relational modelling in Prisma.

Impact:

- Avoids foreign key errors during schema updates.
- Requires continued care in API/server code to enforce relationships and cascading behaviour.
- This should be documented in the Operations Manual.
