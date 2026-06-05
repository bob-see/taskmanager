# TaskManager Operations Manual

Version: 1.0

## Purpose

This document explains how to operate, maintain, deploy and recover the TaskManager application.

Unlike PROJECT_PLAYBOOK.md, which focuses on philosophy and design decisions, this document focuses on practical operation of the system.

If PROJECT_PLAYBOOK.md answers:

"Why does TaskManager work this way?"

This document answers:

"How do I keep TaskManager running?"

---

# System Overview

## Application Stack

Frontend:
- Next.js
- React
- TypeScript

Backend:
- Next.js API Routes
- Prisma

Database:
- MariaDB
- Railway

Authentication:
- NextAuth

Hosting:
- Vercel

Version Control:
- GitHub

---

# Repository Structure

Key files and folders:

```text
/
├── app/
├── components/
├── prisma/
├── public/
├── docs/
│   ├── DECISIONS.md
│   └── OPERATIONS_MANUAL.md
├── PROJECT_PLAYBOOK.md
├── HOW_TO_WORK_WITH_TASKMANAGER.md
└── README.md
```

---

# Local Development

## Start Development Environment

```bash
npm run dev
```

Application should be available at:

```text
http://localhost:3000
```

## Install Dependencies

```bash
npm install
```

## Verify Application

Check:

- Login
- Profiles
- Tasks
- Projects
- Timesheets
- Collaborative Spaces

before considering a build successful.

---

# Git Workflow

## Check Status

```bash
git status
```

## Stage Changes

```bash
git add .
```

## Commit Changes

```bash
git commit -m "meaningful message"
```

Examples:

```bash
git commit -m "feat: add task prioritisation"
git commit -m "fix: resolve timesheet week selection"
git commit -m "docs: update operations manual"
```

## Push Changes

```bash
git push
```

## If Push Is Rejected

```bash
git pull --rebase origin main
git push
```

This commonly occurs when a change was made directly on GitHub.

---

# Database Operations

## Before Any Schema Change

Always create a backup.

Examples:

- Prisma migrations
- New tables
- Column changes
- Relationship changes

## Backup Naming Standard

```text
YYYY-MM-DD-description.sql
```

Examples:

```text
2026-06-06-before-timesheet-update.sql
2026-06-06-before-profile-refactor.sql
```

Store backups in:

```text
/backups
```

---

# Prisma Operations

## Create Migration

```bash
npx prisma migrate dev --name migration_name
```

## Regenerate Client

```bash
npx prisma generate
```

## Open Prisma Studio

```bash
npx prisma studio
```

---

# Railway Operations

## Verify Database Connection

Check:

- Railway project online
- Database active
- Connection string unchanged

## Before Deployment

Confirm:

- Database healthy
- Backup completed

---

# Vercel Operations

## Deploy

Deployment occurs automatically after pushing to GitHub.

## Verify Deployment

Check:

- Login
- Task creation
- Project creation
- Timesheets
- Collaborative Spaces

## Review Logs

If deployment fails:

1. Open Vercel
2. Open deployment logs
3. Identify build failure
4. Fix locally
5. Recommit and push

---

# Codex Workflow

All significant requests should include:

- Goal
- Current Behaviour
- Desired Behaviour
- Constraints
- Acceptance Criteria

---

# Security Checklist

Before deployment verify:

- Users cannot access other users' data
- API routes validate ownership
- Authentication works
- Authorisation works
- No sensitive data exposed to the client

---

# Disaster Recovery

## If Vercel Fails

1. Check deployment logs
2. Check environment variables
3. Roll back to previous deployment if necessary

## If Railway Fails

1. Check Railway status
2. Verify database availability
3. Restore backup if required

## If GitHub Is Lost

Repository should be recoverable from:

- Local clone
- SQL backups
- Documentation stored within the project

---

# Future Expansion

Future versions of this manual should include:

- Detailed Railway backup procedures
- Database restore procedures
- Environment variable reference
- Production rollback procedures
- User administration procedures
- Authentication troubleshooting
- Deployment troubleshooting

This document should evolve alongside the application.
