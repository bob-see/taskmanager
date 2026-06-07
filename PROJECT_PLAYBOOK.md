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

## Capture First, Organise Later

Adding a task should be frictionless.

## Visibility Beats Complexity

Whenever choosing between more functionality and more visibility, prefer visibility.

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
