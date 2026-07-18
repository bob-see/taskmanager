# TaskManager Testing

**Status:** Living Document  
**Last Updated:** 2026-07-18
**Repository Branch:** `main`  
**Audience:** Future maintainers, AI coding assistants, contributors reviewing changes, and anyone preparing a deployment.  
**Purpose:** Focused reference for TaskManager's current verification system, the checks expected for each kind of change, and meaningful gaps in automated and manual coverage.

## Testing Principles

- Verify behavior, not only compilation. A successful build does not prove a workflow is correct.
- Test the server-side rule and direct API behavior, not only visible or hidden UI controls.
- For security-sensitive work, test unauthenticated, permitted, and authenticated wrong-user cases.
- Verify schema changes through the migration workflow and a safe database, never destructive commands against shared Railway data.
- Exercise shared workflows from every participant role.
- Test recurrence and other date-sensitive behavior at day, week, month, interval, pause, and timezone boundaries.
- Combine automated Push core tests with real-browser and real-device delivery tests.
- Record significant manual verification when automation is impractical.
- Add tests around real defects and high-risk ownership, lifecycle, and integrity boundaries.
- Passing checks do not replace documentation review or post-deployment smoke testing.

## Current Verification Tooling

The repository requires Node.js 22.13.0 or later and has no CI configuration, coverage command, browser-automation framework, dedicated test script beyond Node's test runner, or declared staging/test database.

The authoritative 18 July 2026 verification and technical-debt baseline is recorded
in [Architecture: Known Technical Debt & Future Review](./ARCHITECTURE.md#known-technical-debt--future-review).
At that baseline, type checking, all 31 tests, the production build, Prisma
validation, migration status, the dependency-tree check, and `git diff --check`
passed. Full lint failed with 47 errors and 17 warnings. The test run emitted two
non-fatal Node module-type reparsing warnings for imported TypeScript modules.

After the later recurrence, publication, and LOST hardening milestones, the
current suite has nine test files and 67 passing cases. Type checking,
changed-file lint, Prisma validation, the production build, and Node 22.13.0
tests/type checking pass. Full lint is 38 errors and 17 warnings; the nine-error
reduction from the audit baseline is confined to the affected routes.
The expanded suite emits five non-fatal module-type reparsing warnings for
production TypeScript modules loaded directly by Node's test runner.

| Command | What it checks | What it does not check | Connectivity and safety |
|---|---|---|---|
| `npm test` | Runs Node's test runner with TypeScript stripping enabled: nine test files and 67 test cases. | Real Prisma route/database integration, browsers, real Web Push, and most domain workflows. | No database or network is used by the current tests; safe locally. |
| `npm run lint` | Runs ESLint over the repository using the checked-in Next.js ESLint configuration. | Runtime behavior, authorisation, database integrity, and browser/device behavior. | No database connectivity expected; safe locally. |
| `npm run build` | Runs the Next.js production build, including compilation and framework build-time checks. | Correct domain behavior, permissions, migrations, real browser behavior, or deployment configuration. | Intended to be safe locally, but requires installed dependencies and any build-time environment expected by imported code; it must not mutate shared data. |
| `npx prisma validate` | Validates Prisma schema/config structure. | Whether migrations apply, live schema matches, data is preserved, or relations contain no orphans. | Reads configured environment; normally no database write. Safe only after confirming it targets the intended configuration. |
| `npx prisma generate` | Regenerates the Prisma client from the schema. | Live database state, migration status, application behavior, or data integrity. | Does not require live database access, but writes generated client artifacts under installed dependencies; normal local development operation. |
| `npx prisma migrate status` | Compares committed migrations with the configured database migration ledger. | Application behavior, data correctness, and every form of schema drift or orphaned relationship. | Requires database connectivity and is read-only, but may inspect shared Railway if `DATABASE_URL` points there. Confirm the target first. |
| `npm run db:integrity:audit` | Runs fixed aggregate `SELECT`/CTE checks for all 28 Prisma relations plus non-sensitive impact metadata in one read-only consistent snapshot, then rolls back. | Content correctness or whether remediation is approved. It has no mutation mode. | Requires database connectivity and may inspect production. Confirm the target; output contains counts/timestamps only. |
| `npm run dev` | Starts the local Next.js server for manual workflow checks. | Provides no verification by itself. | May connect to the configured database and therefore can affect shared data through manual actions. Confirm the environment first. |

Do not use `prisma db push` or `prisma migrate reset` against shared Railway data. They are schema-changing/destructive operations, not verification commands. Follow [Prisma Migration Workflow](./PRISMA_MIGRATION_WORKFLOW.md).

## Automated Test Coverage

| Test file | Area | Level | What it verifies | Main exclusions |
|---|---|---|---|---|
| `tests/date-time.test.mjs` | Deterministic date/time rendering | Production-coupled utility tests | Calendar-date parsing, Australian July formatting, Brisbane timestamps, midnight/noon/evening boundaries, rollover scheduling, Monday week boundaries, selected-date preservation, action-time dates, explicit hour cycles, and greeting boundaries. | React hydration itself and browser event dispatch. |
| `tests/lost-audio.test.mjs` | LOST audio lifecycle and media-control isolation | Production-coupled controller and source-guard tests | Web Audio use without HTML media or Media Session handlers, user-interaction unlock, decoded-buffer reuse, restart and pending-load cancellation, reset/unmount cleanup, and countdown-to-failure cleanup order. | Real macOS media-key routing, Spotify interaction, browser audio focus, and installed-PWA behaviour remain manual checks. |
| `tests/ownership-regressions.test.mjs` | Profile reorder and timesheet timer ownership | Production-core service tests with transactional in-memory adapters | Unauthenticated boundaries, complete owned-profile reorder, mixed-owner/unknown rollback, separate-user timers, same-user conflict, wrong-profile start, wrong-user read/stop, Brisbane stop date, real elapsed duration, and concurrent/repeated stop finalisation. | NextAuth and real Prisma/MariaDB route integration; manual two-account verification remains required. |
| `tests/playbook-html.test.mjs` | Engineering Playbook HTML output safety | Production-coupled publication helper tests | Separate text/attribute escaping, attribute-injection resistance, repository-link escaping, Unicode preservation, and stable attribute-safe heading slugs. | Full Chrome/PDF rendering and visual layout; use the publication build and QA workflow. |
| `tests/recurrence-carry-forward.test.mjs` | Recurring occurrence visibility | Production-coupled utility and persistence-guard tests | Scheduled-day visibility, multi-day carry-forward, later week/month inclusion, completion removal, historical non-reappearance, next-occurrence distinction, pause/future hiding, recurrence immutability, ownership predicates, atomic completion predicate, and uniqueness guard. | Does not execute React views or a real Prisma transaction; completion generation remains build/type checked and should receive database integration coverage when a disposable MariaDB target exists. |
| `tests/recurrence-pause.test.mjs` | Recurrence and pause rules | Pure logic, duplicated test implementation | Finite pause boundary, indefinite pause, next occurrence after pause, daily and fortnightly intervals, routine due/off-days, default daily interval, paused-view filtering, and expired pauses. | Reimplements helpers inside the test instead of importing application code; no routes, persistence, UI, series deletion, timezone integration, or production recurrence-module coupling. |
| `tests/push-subscriptions.test.mjs` | Push subscription validation and hashing | Pure logic, duplicated test implementation | Deterministic SHA-256 endpoint hash, accepted browser subscription shape, trimming, ignored client user ID, missing-key rejection, and rejection of a `javascript:` endpoint. | Reimplements hashing/validation instead of importing `app/lib/push-subscriptions.ts`; no authenticated route ownership, Prisma storage, length limits, HTTP edge cases, browser subscription API, or real provider. |
| `tests/push-delivery.test.mjs` | Web Push delivery core and payload mapping | Service-level with mocks | Global and per-type preference handling, missing preference behavior, missing VAPID handling, no-subscription handling, multi-device attempts, isolated temporary failure, `404`/`410` cleanup, Push delivery without an in-app row, same-origin target sanitisation, unread badge payload, and concise payload mapping. | Database, logger, VAPID configuration, and Web Push transport are mocked; no dispatcher/route, real Prisma, provider encryption/delivery, service worker, browser permission, device receipt, or UI state. |
| `tests/orphan-integrity-audit.test.mjs` | Production integrity audit guardrails | Production-coupled query/lifecycle tests | Exactly 28 relation definitions, single read-only aggregate statements, mutation-SQL rejection, consistent-snapshot setup, and rollback after success or query failure. | Does not connect to a test database, prove query-plan performance, or authorise/treat production data. |

`date-time.test.mjs`, `lost-audio.test.mjs`, `ownership-regressions.test.mjs`,
`playbook-html.test.mjs`, `recurrence-carry-forward.test.mjs`,
`orphan-integrity-audit.test.mjs`, and
`push-delivery.test.mjs` import production implementations.
`recurrence-pause.test.mjs` and `push-subscriptions.test.mjs` copy production logic
and can drift independently from it. The ownership tests exercise the production
service/authentication seams but use in-memory adapters; none of the current files
is a real Prisma database-integration, browser/UI, or end-to-end test.

## Current Coverage Boundaries

The current automated suite does not prove:

- general route-level authentication or profile/task/project/time-entry ownership beyond the focused profile-reorder/timer production-core tests;
- Group-scoped user discovery or same-group/out-of-group behavior;
- delegated participant permissions, lifecycle transitions, shared notes, or notification recipients;
- notification creation, duplicate-event persistence, recipient-scoped list/read/clear operations, or preference-route ownership;
- Push subscription route ownership, database persistence, device removal, or real provider delivery;
- Collaborative Space membership, owner-only controls, member mutations, child-resource scoping, or destructive deletion constraints;
- manual timesheet workflows, real-database timer isolation, rounding/reporting integration, reports, or activity access;
- Sunday Check-ins, Routine Support, Brisbane Sunday logic, or reporting summaries;
- React UI behavior, responsive layout, accessibility, title/favicon badges, PWA installation, or real service-worker behavior;
- desktop notification permission/delivery, iPhone Home Screen delivery, lock-screen content, or notification-click authentication redirects;
- migration application against a disposable MariaDB test database or preservation of existing rows. The fixed read-only audit now detects production orphans repeatably, but destructive-route and remediation integration still lack a safe database harness.

These gaps are not equally urgent. The fixed profile-reorder and timer ownership rules now have focused production-core coverage, while broader cross-user route-authorisation matrices remain important before expanding collaborative features. Browser automation and broader reporting coverage are useful later, while real-device Push checks remain inherently manual even if browser automation grows.

## Test Levels

### Logic Tests

Use logic tests for deterministic utilities: recurrence calculations, pause evaluation, date-range boundaries, timesheet rounding, payload mapping, URL safety, validation, and preference evaluation. Prefer importing the production helper. Copying production logic into a test should be treated as a specification example, not direct regression coverage.

### Service Tests

Use service tests for server modules with controlled dependencies. The existing Push delivery core is the current example: mocked database and transport objects exercise preference, fan-out, cleanup, and payload behavior without contacting a provider. Similar seams could cover notification dispatch or lifecycle helpers if those rules are extracted without weakening route-level enforcement.

### Route Authorisation Tests

No route-test harness currently exists; adding focused route-level authorisation coverage is the leading testing priority. Depending on the route, tests should cover:

- unauthenticated request;
- authenticated correct owner and authenticated wrong owner;
- same-Group visible user and out-of-Group user;
- administrator versus standard user;
- delegated assignee, delegator, and unrelated user;
- Collaborative Space owner, member, and non-member;
- mutation predicates and response bodies that must not leak another user's data.

Tests must call the server handler/API boundary rather than infer protection from a hidden button or proxy redirect alone.

### Database and Migration Tests

For schema changes, validate the schema, review generated SQL, apply the migration to a safe non-production MariaDB environment, regenerate Prisma, check migration status, and exercise reads/writes that preserve existing data. Review recovery or rollback options before high-risk changes. Because `relationMode = "prisma"` does not provide physical foreign keys for modeled relations, explicitly inspect relationship consistency and likely orphan paths.

No dedicated disposable MariaDB test environment or automated migration test exists in this repository. Never use production Railway data for destructive verification. See [Prisma Migration Workflow](./PRISMA_MIGRATION_WORKFLOW.md).

### Browser and Workflow Tests

Manual browser testing remains necessary for multi-user workflows, layout/interaction changes, service-worker registration, browser permissions, title/favicon/app badges, installed-PWA behavior, and real device Push. Use separate accounts, browser profiles, or devices when roles or participants must be isolated.

### Deployment Smoke Tests

After deployment, minimally verify login, Overview, one profile task list, task create/complete, project create/edit, delegated lists, notification center read behavior, notification settings/subscription status, timesheets, reports, and Collaborative Spaces. Add affected feature checks and confirm no new Prisma/runtime errors. Schema deployments also require migration status and a read/write smoke test for the changed model.

## Change-Based Verification Matrix

| Change type | Minimum automated checks | Manual checks | Security/documentation/post-deployment |
|---|---|---|---|
| Documentation only | Relative-link check; `git diff --check` | Render/read changed Markdown | Review owning docs; no application smoke test normally needed. |
| UI styling | Lint; build | Affected desktop/mobile states and keyboard interaction | Confirm hidden/disabled UI is not the only guard; smoke affected page. |
| Task behavior | Test, lint, build; add focused logic/route regression where practical | Create/edit/complete/reopen/delete and wrong-profile request | Review Security/Architecture; smoke task workflow. |
| Recurrence | Test, lint, build; extend production-coupled date tests | Boundary dates, intervals, pause/resume, generated occurrences, deletion scopes | Review timezone/data effects; smoke representative series. |
| Delegated task | Test, lint, build; lifecycle/route tests when available | Both participants, wrong user, every affected state and notification | Security and Testing review; smoke both delegated lists. |
| Permission or ownership | Test, lint, build; direct route regression required | Unauthenticated, correct user, wrong user, role/Group variants | Mandatory Security review and post-deploy negative check. |
| Notification event | Test, lint, build; dispatcher/payload tests | In-app row, recipient, preferences, unread/read/clear, target | Security and Push docs review; smoke sender/recipient. |
| Browser Push/service worker | Test, lint, build | Desktop background/focused, click target, real installed iPhone where supported | Review Push/Security/Testing; post-deploy subscription and delivery. |
| Timesheet or timer | Test, lint, build; rounding/route tests where practical | Week navigation, entry/timer lifecycle, two users, report impact | Mandatory ownership review; smoke time entry. |
| Collaborative Spaces | Test, lint, build; permission tests when available | Owner/member/non-member, Groups, rows/columns/cells/notes/print | Security review; smoke affected Space operation. |
| Prisma schema/migration | Test, lint, build, Prisma validate/generate/status | Apply on safe MariaDB; data-preservation and orphan checks | Migration docs, backup/recovery plan, post-deploy status/read-write. |
| Authentication or role | Test, lint, build; route/session tests | Login/logout, wrong role, session behavior, restricted routes | Mandatory Security review; post-deploy login and negative checks. |
| Reporting calculation | Test, lint, build; focused utility tests | Known dataset, periods/boundaries, profile/admin scopes | Review data isolation; smoke affected report. |
| Deployment/configuration | Test/lint/build as affected; Prisma status if applicable | Target-environment smoke and logs | Operations/docs review; verify variables separately without exposing values. |

## Security Testing

Use [TaskManager Security](./SECURITY.md) for the authoritative invariants and full security checklist. At minimum, call APIs directly; test unauthenticated and authenticated wrong-user access; test wrong-Group discovery and role differences; verify every mutation includes its intended owner, recipient, participant, or membership scope; inspect responses for cross-user data; request restricted routes server-side; and review logs for secrets or unnecessary personal data.

The former profile-reorder and timer ownership defects now have production-core
regressions for unauthenticated, owner, wrong-user, atomicity, concurrency, and
timezone behavior. Direct NextAuth/Prisma route tests remain unavailable until the
repository has a safe disposable MariaDB target, so post-deployment two-account
negative checks remain mandatory.

## Delegated Task Test Matrix

| Current state | Action | Actor | Expected state/result | Notification recipient | Opposite/wrong participant |
|---|---|---|---|---|---|
| `PENDING` | Accept | Assignee | `ACCEPTED`; optional assignee-owned profile handling | Delegator | Delegator/unrelated user rejected |
| `PENDING` | Decline | Assignee | `DECLINED`; optional reason note | Delegator | Delegator/unrelated user rejected |
| `ACCEPTED` | Start work | Assignee | `IN_PROGRESS` | None | Delegator/unrelated user rejected |
| `IN_PROGRESS` | Mark complete | Assignee | `COMPLETED` | Delegator | Delegator/unrelated user rejected |
| `COMPLETED` | Close | Original delegator | `CLOSED` | Assignee | Assignee/unrelated user rejected |
| Any recorded state | Add note | Either participant | Note appended; lifecycle unchanged | Other participant | Unrelated user rejected |
| `CLOSED` or `DECLINED` | Lifecycle action above | Either participant | No invented transition; route rejects invalid state | None | Confirm rejection and no mutation |

Also verify stale/concurrent state updates return conflict without duplicating state changes, nullable historical participants do not create invalid notifications, and note authors/content appear only to the intended participants. There is no current reopen, cancel, reassignment, or delegated detail-page transition to test.

## Notification Testing

Automated Push core coverage currently verifies preference gating, multi-device attempts, temporary failure isolation, expired-subscription cleanup, URL sanitisation, missing VAPID handling, and payload/badge mapping with mocks.

Manual in-app verification should cover all four in-app/Push preference combinations, correct recipient and copy, unread count, mark-read, clear, bulk read/clear, pagination cursor ownership, event-key duplicate protection, internal target navigation, and independence of Push failure from the domain action. Manual browser verification should cover permission/subscription state, active-tab suppression, title/favicon/app badge updates, background delivery, multi-device fan-out, expired device cleanup evidence, safe click routing, and an expired login session after click.

Real installed iPhone/Home Screen testing is separate: installation context, permission, background/closed delivery, lock-screen/banner text, tap navigation, per-type preferences, and disabling notifications must be checked on-device. Mocked Node tests cannot verify provider or device delivery. Follow [Push Notifications](./PUSH_NOTIFICATIONS.md) for the detailed desktop and iPhone procedures rather than duplicating them here.

## Recurrence and Date-Sensitive Testing

Test current-day selection, due versus start dates, overdue classification, Sunday-to-Monday week boundaries, Monday current-week behavior, month/year boundaries, daily/weekly/monthly recurrence, repeat intervals, selected weekday masks, short-month monthly dates, finite pause through the pause-until date, first date after a pause, indefinite pause, expired pause, completion history, and the three supported recurring deletion scopes: this task, this and future tasks, and entire series.

The profile/timesheet interfaces use local `Date` operations and Monday-start weeks. Sunday Check-ins and user-activity reporting explicitly use `Australia/Brisbane`/`+10:00`; test those workflows around Brisbane day and week boundaries. Do not assume the current copied recurrence tests cover route persistence or every production/client calculation.

## Timesheet and Timer Testing

Manual and future automated checks should cover current-week default selection, previous/next week navigation, manual create/update/delete under the owning profile, invalid time ranges, notes/source validation, active versus completed entries, and report totals. Verify exact, nearest-15, and up-15 duration rounding at below/above-half and exact-quarter boundaries.

For timers, test start, stop, no-active-timer response, same-user duplicate start,
separate-user simultaneous timers, notes, duration, selected rounding, activity
logging, and reporting impact. Use two authenticated users with distinct profiles
to verify one user's active timer cannot be discovered, blocked, started, or
stopped by the other. Production-core regressions now cover these ownership and
concurrency rules; real route/database and browser checks remain manual.

## Collaborative Spaces Testing

Use an owner, ordinary member, visible same-Group candidate, out-of-Group user, and non-member. Verify list/detail/print access; owner membership addition/removal and Space deletion; only-owner removal protection; Group-scoped member selection and identity redaction; member row create/update/complete/reopen/delete; column create/rename/reorder/archive/restore; status-option lifecycle; and permanent column deletion with empty versus meaningful cells or note history.

For cells, verify row and column belong to the same Space, type validation, status-option ownership, user-value visibility, card assignment to Space members, updates, and note history/hidden author behavior. Print output should expose only the member-accessible Space and expected archived-column state.

## Manual Test Evidence

For significant manual verification, record:

- date and commit/branch;
- environment and whether data is local, dedicated test, or shared;
- tester;
- account and role/participant used (without passwords);
- browser/device and installed-PWA status where relevant;
- scenario and expected result;
- actual result and evidence summary;
- defects found and follow-up required.

No repository location or test-management system is currently designated for this evidence. A modest default is a dated Markdown note under a future `docs/test-evidence/` directory for release-level or security-sensitive checks; concise PR/issue notes are also reasonable when that is where the change is reviewed. Do not create a permanent evidence record for trivial checks merely to satisfy process.

## Regression Testing After Defects

A confirmed defect should normally produce a reproducible case, a failing automated test where practical, the code fix, passing regression verification, and documentation review when behavior or known limitations change. The profile-reorder defect should gain cross-user enumeration/mutation tests; the timer defects should gain two-user start/stop isolation tests. Until those tests and fixes exist, manual negative checks remain necessary and the limitations must stay documented.

## Test Data and Environment Safety

- Do not use real production data for destructive, permission-boundary, lifecycle, or migration experiments.
- Do not run database resets or `db push` against Railway.
- Prefer controlled local data or a dedicated disposable database; no dedicated test environment is currently defined in the repository.
- Use separate non-personal multi-user accounts for owner, wrong-user, Group, admin, delegated, and Space scenarios where possible.
- Protect names, emails, task text, activity descriptions, notification bodies, and exported database content.
- Clean up test notifications and Push subscriptions responsibly; do not send test Push to unintended users or devices.
- Confirm `DATABASE_URL` before any database-connected command or manual test.
- Create a backup and recovery plan before high-risk migration verification involving important data.

## Definition of Done Verification

- [ ] Relevant automated tests passed; the exact command and result are reported.
- [ ] Lint and build ran when applicable, with failures reported rather than hidden.
- [ ] Affected workflows were manually exercised at the necessary user, date, browser, and device boundaries.
- [ ] Direct API and wrong-user security boundaries were checked where relevant.
- [ ] Prisma validation/generation/status and safe migration checks completed when applicable.
- [ ] A target-environment smoke test is planned or completed for deployable changes.
- [ ] Architecture, Security, Testing, subsystem, and user-facing documentation impact was reviewed.
- [ ] Known limitations, skipped checks, environment constraints, and manual-only coverage were reported.
- [ ] “All tests passed” is used only for the tests actually run, not as a claim about untested behavior.

## Testing Debt and Priorities

| Area | Current state | Risk | Recommended next step | Priority |
|---|---|---|---|---|
| Route authorisation | No route-level suite | Cross-user data or mutation regressions across a multi-user app | Establish a small route-test harness around session/database seams and highest-risk endpoints. | High |
| Profile reorder | Fixed; production-core owner/wrong-owner/rollback tests pass | Real route/Prisma wiring is not database-integrated | Add direct route tests when a disposable MariaDB target exists; retain two-account smoke checks. | Medium |
| Timer ownership | Fixed; production-core per-user/concurrency/timezone tests pass | Real route/Prisma wiring is not database-integrated | Add direct route tests when a disposable MariaDB target exists; retain two-account smoke checks. | Medium |
| Delegated lifecycle | Manual/code inspection only | Participant or state-transition regression | Cover every current transition, stale state, notes, and recipients at route/service level. | High |
| Notification/Push ownership | Push core tested; routes and dispatcher ownership untested | Wrong recipient/subscription mutation or data leak | Add recipient-scoped notification and authenticated subscription route tests. | High |
| Group and Space permissions | No automated permission coverage | Discovery leaks or non-member/role bypass | Add Group visibility and owner/member/non-member route cases. | High |
| Recurrence tests | Useful cases, but copied logic | Tests can pass while production diverges | Move/add tests that import production recurrence/date helpers and add route persistence boundaries. | Medium |
| Push subscription tests | Copied validation/hash logic | Production validation can drift silently | Import production helpers and add authenticated persistence cases. | Medium |
| Timesheet/report calculations | No automated coverage | Incorrect rounding, week totals, or reporting | Add pure utility tests first, then owned-entry route cases. | Medium |
| MariaDB migration/integrity | Repeatable count-only production audit exists; no disposable test DB or destructive-route/remediation integration | Existing defects can recur or a repair can behave differently from its dry-run | Define a safe non-production MariaDB workflow and exercise cascade/set-null plus repair assertions before treatment or relation changes. | High |
| Browser/service worker automation | Manual only | UI/PWA regressions detected late | Add focused browser automation only after stable high-value scenarios are identified; retain device checks. | Medium |
| Reports, Routine Support, Sunday Check-ins | Manual/code inspection only | Calculation/date regressions | Add deterministic summary/date tests around known business cases. | Low to Medium |

## Testing Review Triggers

Review this document when adding or changing:

- a test framework, command, helper, fixture strategy, coverage tool, or CI;
- authentication, roles, ownership, Group visibility, or restricted features;
- delegated lifecycle actions or collaboration models;
- notification events, preferences, delivery channels, or targets;
- supported browsers/devices, PWA installation, or service-worker behavior;
- schema, migration workflow, relation mode, database provider, or test environment;
- deployment environments or post-deployment verification;
- meaningful Definition of Done expectations.

## Related Documents

- [README](../README.md)
- [Architecture](./ARCHITECTURE.md)
- [Security](./SECURITY.md)
- [Architecture Decisions](./DECISIONS.md)
- [Project Playbook](../PROJECT_PLAYBOOK.md)
- [AI Quick Start](../HOW_TO_WORK_WITH_TASKMANAGER.md)
- [Push Notifications](./PUSH_NOTIFICATIONS.md)
- [Prisma Migration Workflow](./PRISMA_MIGRATION_WORKFLOW.md)
- [Migration History](./MIGRATION_HISTORY.md)
- [Operations Manual](./OPERATIONS_MANUAL.md)
