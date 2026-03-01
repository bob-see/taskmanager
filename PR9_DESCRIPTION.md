## Summary

PR9 adds Day-view-only bulk actions and faster category editing without changing the schema.
It reuses the existing profile-scoped tasks/projects model and preserves series-aware recurrence behavior.

## What Changed

- Added profile-level category suggestions sourced from all tasks in the current profile.
- Replaced task category text inputs with a reusable combobox that supports suggestions, filtering, and new values.
- Added inline category editing in Day view with the same combobox component.
- Added Day-view select mode with row checkboxes and a bulk action toolbar.
- Added bulk actions for mark done, mark open, move to project, set category, set start date, set due date, clear due date, and delete.
- Added recurrence scope prompts for bulk delete and bulk completion state changes when recurring tasks are selected.
- Kept recurrence-safe delete/complete behavior from regressing by preserving existing “this task only” series handling and avoiding duplicate future occurrence creation for broader bulk scopes.

## Acceptance Checklist

1. Category memory
- Build a profile category suggestion list from existing tasks (open + done) in the current profile.
- Add Task category input becomes a combobox: dropdown of suggestions + type-to-filter + allow new.
- Inline category edit uses the same combobox component.

2. Multi-select mode + bulk toolbar (Day view only)
- Add a “Select” toggle in the Day view tasks area (near open filters).
- In select mode, show a checkbox per task row and a bulk action bar when any are selected.
- Bulk actions: Mark done, Mark open, Move to project, Set category, Set start date, Set due date, Clear due date, Delete.

3. Recurrence-safe prompts
- For Delete and any recurrence-affecting bulk action, when selection includes recurring tasks, prompt for scope:
- This task only
- This and future
- Entire series
- Ensure recurrence duplication bugs do not reappear.
