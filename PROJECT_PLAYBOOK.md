# TaskManager Project Playbook

Version: 1.1

# AI Developer Instructions

## Mandatory Reading

Before making significant changes to TaskManager, AI coding assistants should review:

PROJECT_PLAYBOOK.md

This document contains:
- Project philosophy
- Design principles
- UI standards
- Security requirements
- Deployment procedures
- Git workflow
- Historical decision-making rationale

The Playbook should be treated as a source of truth when making implementation decisions.

If a requested change appears to conflict with the Playbook:

1. Implement the user's request.
2. Identify the conflict.
3. Explain the trade-off.
4. Suggest alternatives where appropriate.

Do not redesign TaskManager around enterprise software assumptions.

---

# Purpose

TaskManager exists to help individuals and small teams manage work across multiple responsibilities and contexts.

The goal is not to become Jira, Asana, Monday or Trello.

The goal is to become the tool people actually use every day.

---

# What TaskManager Is Not

TaskManager is not:

- Jira
- Monday
- Asana
- Trello
- A CRM
- A full ERP

Whenever a proposed feature adds complexity, ask:

"Does this reduce friction or create friction?"

---

# Core Design Philosophy

## Overview First

The Overview page is the heart of the application.

## Overview Options Own Page-Wide Controls

Overview has an Overview Options menu for controls that affect the entire Overview page, not a single profile.

Current sections:

- Filter
- Sort
- Group By

Overview Group By currently supports:

- Project
- Category

Overview profile cards use a single Actions button instead of separate Add Task, Add Project and Collapse buttons. The profile card Actions menu includes:

- Add Task
- Add Project
- Collapse / Expand

Overview profile counters use compact labels: Open, Upcoming, Done and OD.

Overdue indicators are context-specific: profile pages show a red due date with an OD pill beside the date, while Overview uses a subtle overdue row tint with an OD badge. Priority styling remains separate from overdue styling.

Collapsed Overview profile cards should stay compact and show only the header, counters and Actions button.

## Capture First, Organise Later

Adding a task should be frictionless.

## Visibility Beats Complexity

Whenever choosing between more functionality and more visibility, prefer visibility.

## Profile Options Own Workspace Customisation

Each profile/workspace has a Profile Options menu for task display preferences.

Current sections:

- View
- Sort
- Columns

Profile Options should become the long-term home for workspace customisation rather than adding more controls to the task toolbar.

Desktop uses hover/flyout submenus. Mobile uses an expandable touch-friendly panel below the settings control.

Current task views:

- Active
- Today
- Upcoming
- Overdue
- Paused
- Done
- Archived

Current sort modes:

- Manual
- Start Date
- Due Date

Current configurable columns:

- Category
- Due
- Waiting On
- Tags / Notes

The selected view and sort mode should be visually highlighted. Column preferences are remembered per profile/workspace, and the task table may expand slightly when additional columns such as Waiting On are enabled.

Waiting On is not a separate task field. It is derived from the latest task note only: if the most recent note has Waiting On selections, display them; if it does not, display a blank Waiting On cell. Older Waiting On values are intentionally ignored once a newer note exists, because the column represents current task state rather than history.

Future workspace preferences should prefer this menu when practical, including grouping, density, additional columns and other profile-level display options. This keeps the toolbar clean while allowing each workspace to become more configurable over time.

## Task Deletes Use The Shared Modal

All task deletes should use the shared TaskManager in-app delete confirmation modal. Browser-native confirm dialogs should not be used for task deletion.

Overview and profile task action menus use the same shared modal. Non-recurring tasks require confirmation before deletion. Recurring tasks keep their delete scope options:

- This task only
- This and future tasks
- Entire series

The modal uses a retro TaskManager visual style and should remain the shared pattern for future destructive task actions.

## Task Actions Stay Shared Across Entry Points

Overview and profile task rows support right-click task actions. Profile task rows should open the task actions menu when right-clicking anywhere on the row, matching Overview behaviour.

Clicking the task title should continue to open the edit task modal. The three-dot Actions button should continue to open the same actions menu. Right-click must not change Select mode selection or interfere with manual drag/reorder.

Task action menu items should be shared/reused so future task actions stay consistent across right-click menus and explicit Actions buttons.

Task action menus should stay consistent between Overview and profile pages wherever the task supports the same actions. Menus should be viewport-aware so options are not cut off near the bottom of the screen.

Future considerations:

- Consider a masonry-style Overview layout later so collapsed or short cards naturally close vertical gaps beside taller cards.
- Continue moving task menus toward a single shared source of truth so Overview, Profile and future task surfaces use the same action definitions and ordering.

## Notes Matter

Task notes preserve context and act as progress logs and memory aids.

## Delegated Work Stays Shared

Delegated tasks should stay lightweight and shared.

The assignee does the work, but the original delegator reviews completion and closes the delegated task.

The underlying task remains in its originating profile/project. Delegation must not move task profile ownership, project ownership or task origin.

## Groups and Visibility Philosophy

Groups control user visibility and collaboration scope.

Profiles are still work contexts, not permissions.

Users may belong to multiple groups.

Admins can be members of multiple groups.

Standard users should only see users who share at least one group with them.

Collaborative Spaces member selection must respect group visibility.

Future assigned-task functionality should use the same group visibility rules.

---

# Project History

TaskManager began as a personal productivity application designed to help a single user manage multiple responsibilities across different areas of work.

Original use cases included:

- Real Estate Administration
- DREAM Development
- Sales Support
- Personal Tasks
- Prospecting Activities

Traditional task management systems created excessive friction when switching between contexts.

TaskManager was created to solve this problem through:

- Profiles
- Overview-based workflows
- Lightweight task capture
- Context preservation

The project later evolved into a multi-user application supporting:

- Authentication
- User isolation
- Activity tracking
- Timesheets
- Collaborative Spaces
- Shared workflows

---

# Architecture Principles

## Server First

Security decisions belong on the server.

Never rely on client-side restrictions.

---

## Database Is Source Of Truth

Avoid duplicate state where practical.

Prefer deriving information from the database.

---

## Incremental Growth

Prefer extending existing functionality rather than creating parallel systems.

Example:

Good:
Add capability to Overview.

Bad:
Create Overview2.

---

## Backwards Compatibility

Existing workflows should continue functioning wherever practical.

Avoid breaking existing user habits without a strong reason.

---

# Lessons Learned

## Users Prefer Overview

Most task activity occurs on the Overview screen.

New functionality should be considered for Overview first.

---

## Notes Improve Context

Users are more likely to complete long-running tasks when notes preserve progress and context.

---

## Context Switching Is Expensive

Reducing navigation is often more valuable than adding functionality.

---

## Simplicity Wins

Avoid complexity unless it clearly improves workflow.

---

# Existing Major Modules

- Profiles
- Overview
- Delegated Tasks
- Timesheets
- Activity Log
- Collaborative Spaces

---

# Security Standards

- Never trust client data
- Validate ownership server-side
- Preserve multi-user isolation
- Validate authentication and authorisation on every API route
- User visibility restrictions must be enforced server-side
- Frontend filtering is only a convenience and must not be the only protection
- API endpoints that return users must respect group visibility
- Delegated task actions must validate the actor and lifecycle transition server-side
- LOST hatch countdown access is restricted to robert.bob.see@gmail.com and must remain protected server-side

---

# Delegated Tasks

Delegated Tasks support shared task assignment without turning TaskManager into a heavy project management system.

## Overview

- Assigned To Me shows delegated tasks received by the current user.
- Assigned By Me shows delegated tasks the current user created.
- New delegated tasks can be created from the Delegated section.
- Existing tasks can be delegated from task actions.
- Shared notes/activity use the existing TaskNote system.

## Lifecycle

Pending → Accepted → In Progress → Completed → Closed

- Pending tasks may be Accepted or Declined by the assignee.
- Accepted tasks may be started by the assignee.
- In Progress tasks may be marked Completed by the assignee.
- Completed tasks are Awaiting Review for the delegator.
- The delegator closes completed tasks after review.

## Product Principles

- Delegated tasks remain shared objects.
- Do not duplicate delegated tasks.
- Do not move delegated tasks into the assignee's profile/project.
- Preserve the existing Assigned To Me / Assigned By Me structure.
- Preserve the underlying task's originating profile/project.
- Prefer compact visual indicators over noisy row treatments.

## Visual Indicators

- Sender initials badge beside delegated task titles.
- Delegated status badge wherever delegated tasks appear.
- Awaiting Review state for completed delegated tasks.

## Future TODOs

- Local development database/playground for collaboration testing.
- Notification badges for new delegated notes/status updates.
- Possible richer delegated task metadata/hover details later.

---

# Codex Prompt Standard

Include:
- Goal
- Current Behaviour
- Desired Behaviour
- Constraints
- Acceptance Criteria

---

# Git Workflow

Commit often.
Prefer small, meaningful commits.

---

# SQL Backup Procedures

Before:
- Prisma migrations
- Schema changes
- Major deployments

Create a SQL export.

Naming:
YYYY-MM-DD-description.sql

Store in /backups

---

# Railway Procedures

- Verify status
- Create backup
- Confirm connectivity

---

# Vercel Procedures

Before deployment:
- Commit
- Push
- Verify environment variables

After deployment:
- Verify build
- Verify login
- Verify tasks
- Verify timesheets

---

# Deployment Checklist

Before:
- Commit
- Push
- Backup database
- Test locally

After:
- Verify deployment
- Verify authentication
- Verify core workflows

---

# Decision-Making Framework

1. Does it make task capture faster?
2. Does it improve visibility?
3. Does it reduce context switching?
4. Will users use it daily?
5. Does it add unnecessary complexity?

---

# Golden Rule

When deciding between more features and faster workflow:

Choose faster workflow.
