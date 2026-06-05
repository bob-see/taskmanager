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
