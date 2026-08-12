# Production Orphan Remediation Dry-Run Report

**Status:** Partial treatment approval recorded; no production treatment executed  
**Audit timestamp:** 2026-08-11T09:28:32.592Z (UTC)  
**Database migration count:** 32  
**Physical foreign keys:** 0

This report records aggregate intended effects from the live, read-only
integrity audit. It contains no task content, user names, resource IDs, or
mutation SQL. The report is not an approval and must not be treated as an
instruction to run a repair.

## Baseline comparison

The live counts match the approved investigation baseline exactly:

| Orphan class | Current count | Missing parents | Approved baseline | Difference |
|---|---:|---:|---:|---:|
| Tasks → missing profiles | 6 | 2 | 6 | 0 |
| Tasks → missing projects | 1 | 1 | 1 | 0 |
| Task notes → missing tasks | 5 | 3 | 5 | 0 |
| Projects → missing profiles | 2 | 2 | 2 | 0 |
| Time entries → missing profiles | 4 | 3 | 4 | 0 |
| Matrix columns → missing Spaces | 32 | 7 | 32 | 0 |
| Matrix rows → missing Spaces | 80 | 9 | 80 | 0 |

## Intended treatment groups

The repair must operate on logical subgraphs, not independently on each
aggregate row. Seven missing profiles are not implied: the audit reports three
distinct missing profiles, with overlap across task, project and time-entry
classes. Similarly, seven missing Spaces are not implied: the audit reports
nine distinct missing Spaces, with seven referenced by both rows and columns.

| Treatment group | Aggregate scope | Proposed dry-run effect | Approval required |
|---|---|---|---|
| Missing-profile task/project subgraphs | 6 tasks, 2 projects, 3 missing profiles; 3 task references to the projects | Archive if history is required, otherwise delete in dependency order; do not reattach or recreate profiles/projects | Separate approval for archive/delete and retention choice |
| Notes for deliberately deleted tasks | 5 notes across 3 missing tasks | Delete the notes; do not reattach them | Explicit delete approval |
| Historical time entries | 4 entries across 3 missing profiles; 0 active timers | Retain outside the live relation or archive before deletion, or delete if business retention is not required | Explicit retain/archive/delete approval |
| Inaccessible Space subgraphs | 9 missing Spaces; 80 rows, 32 columns, 35 status options, 17 cells, 2 cell notes | Archive if history is required, then delete descendants once per missing Space in dependency order; do not reconstruct Spaces | Separate approval for archive/delete |

## Treatment decisions recorded 2026-08-11

- Missing-profile task/project subgraphs: **approved for deletion**; these were
  confirmed as test tasks and projects.
- Notes for deliberately deleted tasks: **approved for deletion**.
- Historical time entries: **retain**; do not delete as part of this repair.
- Inaccessible Space subgraphs: **pending content inspection** before archive or
  delete approval.

These approvals do not authorise execution yet. A verified backup, a reviewed
repair runner with exact count assertions, and a final pre-apply audit remain
required.

## Required assertions before apply

An eventual repair runner must abort without mutation if any of these differ
from the approved evidence:

- any of the 28 relationship counts;
- any treatment-group overlap count;
- any active timer count;
- any downstream count for status options, cells, cell notes, task notes,
  delegated references, or activity references;
- any migration count or physical foreign-key count; or
- any unexpected parent, child, constraint, transaction, or already-partially-
  treated state.

The current audit has no mutation mode. A separately reviewed, idempotent repair
runner is required before any apply operation.
