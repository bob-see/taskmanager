Taskmanager

A profile-based task and project tracker designed to help manage work across multiple contexts (e.g. Personal, Work, DREAM).

The app focuses on:
	•	Daily execution
	•	Visual planning
	•	Progress awareness
	•	Future productivity insights

⸻

✨ Overview

Taskmanager is evolving into a lightweight personal operating system for planning, doing, and reviewing work.

Each Profile acts as its own workspace, allowing you to separate different areas of life while keeping a consistent workflow.

Key principles:
	•	Tasks appear when they become relevant
	•	Incomplete work rolls forward naturally
	•	Time views provide context, not clutter
	•	Progress is visible and measurable

⸻

🚀 Getting Started

Run the development server:

npm run dev

Then open:

http://localhost:3000

The app will reload automatically as you edit files.

⸻

🧱 Tech Stack
	•	Next.js (App Router)
	•	Prisma ORM
	•	SQLite (local dev DB)
	•	React
	•	TypeScript

⸻

🗂️ Releases

PR1 — Profiles & Projects Foundation

This release establishes the multi-profile architecture that the app is built on.
The task manager now supports separate workspaces, allowing tasks to be organised by context (e.g. Personal, Work, DREAM).

✨ What was added
	•	Profile model (workspace container for tasks & projects)
	•	Project model (optional grouping for tasks)
	•	Updated Task model with:
	•	profileId relation
	•	optional projectId
	•	startDate
	•	Database migration + backfill script to create a default profile
	•	Profiles API (/api/profiles)
	•	Profile selector home screen
	•	Profile page scaffold (/p/[profileId])

🧠 Why this matters

This shifts the app from a single list to a scalable structure where:
	•	Tasks are scoped to a profile
	•	Future features operate per workspace
	•	Projects can group related tasks

🗄️ Migration notes

Existing tasks were automatically:
	•	assigned to the Default profile
	•	given startDate = createdAt

⸻

PR2 — Profile-Scoped Tasks & Scheduling

This milestone brings the core task workflow into each profile, making the app behave like a true workspace-based task manager.

✨ What was added
	•	Tasks displayed within /p/[profileId]
	•	APIs scoped to profile context
	•	Start date behaviour
	•	Automatic rollover of incomplete tasks
	•	Profile switcher UI
	•	“Unassigned” grouping for tasks without a project

🧠 Behaviour introduced

Start dates
Tasks can be scheduled to appear on a future date without requiring a due date.

Rollover logic
If a task is not completed by the end of the day, it automatically appears the next day until completed.

Profile scoping
Each profile acts as an independent workspace with its own:
	•	tasks
	•	categories
	•	projects

⸻

PR3 — Calendar Views, Progress & Done Filters

PR3 evolves the tracker from a simple list into a time-aware productivity view.

🗓️ Calendar Navigation
	•	Day / Week / Month view switcher
	•	Week runs Monday → Sunday
	•	Prev / Next navigation per mode
	•	Clicking a day jumps to that date

📊 Progress Tracking
	•	Daily progress bar showing completion ratio
	•	Updates live when tasks change

📂 Open Task Filters
	•	All Active
	•	Today
	•	Upcoming
	•	Overdue

Today includes tasks where:
	•	startDate == selected day OR
	•	dueAt == selected day

✅ Done Section

Completed tasks can be filtered by:
	•	Today
	•	This Week
	•	This Month
	•	All

🔒 Scope
	•	Client-side filtering
	•	No schema changes
	•	No API changes

⸻

PR3.x — UX Clarity Improvements

A lightweight UX polish pass to make calendar insights easier to interpret at a glance.

Improvements
	•	Today helper text (only when Today filter active)
	•	Calendar legend for indicators:
	•	X active
	•	+Y new
	•	Z due
	•	Visual emphasis on days with changes

Scope
	•	UI only
	•	No logic changes
	•	No API changes

⸻

🚀 PR4 — Projects, Task Editing & Profile Search

Summary
PR4 introduces Projects as a first-class feature in Day view, adds a full Edit Task modal, and upgrades search to work across a profile’s timeline (Active / Upcoming / Complete), with better UX for clearing and archived visibility.

What’s Included

📁 Projects
	•	Create projects even with no tasks (projects show immediately)
	•	Collapse/expand project sections (persists after reload)
	•	Archive projects (hidden by default; visible with “Show archived”)
	•	Archived projects display with distinct styling

📝 Task Editing
	•	Edit Task modal supports: title, start date, due date, category, notes, project assignment
	•	New task modal includes calendar date pickers for dates
	•	Tasks can be assigned to a project at creation time and display under that project

📊 Progress
	•	Project-level progress bars (separate from overall/day progress)

🔎 Search (Profile-scoped, time-aware)
	•	Search scans tasks across time within the current profile (not just the selected day)
	•	Results grouped into: Active / Upcoming / Complete
	•	Clear “×” button appears when searching; Esc clears as well
	•	“Include archived” shows archived results with an Archived badge + archived styling

Notes
	•	Prisma schema + migration included for project fields (run npx prisma migrate dev after pulling).
____


🚀 PR5 — Recurrence, Day-Accurate Progress, and Search Improvements

Summary
PR5 adds recurring tasks (daily/weekly/monthly) with weekday selection, prevents recurrence duplication, improves day-specific progress tracking, and upgrades search to include project names and project results (active + archived).

What’s Included

🔁 Recurring Tasks
	•	Repeat checkbox with Daily / Weekly / Monthly
	•	Daily repeats support Mon–Sun day toggles (e.g. Mon–Fri)
	•	Completing a recurring task automatically creates the next occurrence
	•	Recurrence is deduped (no duplicates when toggling done/undone)
	•	Tasks are linked by recurrenceSeriesId and protected by a uniqueness rule

📊 Progress Bar (Day-Accurate)
	•	Progress now resets per day
	•	Completed count is based on tasks completed on that selected day
	•	Total excludes tasks completed on earlier days (so “0/2” behaves as expected)

🗓 Filters
	•	Upcoming now includes tasks with future start dates (not just due dates)

🔎 Search Enhancements
	•	Search matches project names as well as task fields
	•	Search shows Projects sections:
	•	Active Projects
	•	Archived Projects (only when “Include archived” is enabled)
	•	Clicking a project result clears search and focuses that project (expand + scroll)

Migration Notes
	•	PR5 includes migrations for recurring task fields, repeat-days support, and recurrence series dedupe.
	•	After pulling: run npx prisma migrate dev.

_____

🚀 PR6 — Recurring Task Controls & Archived Visibility

Summary
PR6 improves control and predictability when working with recurring tasks and archived projects.
It introduces flexible delete behaviour for recurring series and ensures archived items behave consistently across calendar and task views.

⸻

What’s Included

🗑️ Recurring Delete Options

When deleting a task that belongs to a recurring series, a modal now allows:
	•	This task only → removes only the selected occurrence
	•	This and future tasks → removes the selected occurrence and all upcoming ones
	•	Entire series → removes every occurrence (past, present, future)

Non-recurring tasks still delete instantly without a modal.

⸻

🔁 Recurrence Continuity

Deleting “this task only” no longer breaks the recurrence chain.

If no later occurrence exists, the system automatically generates the next valid occurrence so the series continues as expected.

Example:
A Mon–Fri daily task deleted on Wednesday will still appear on Thursday.

⸻

🗂 Archived Visibility Consistency

Archived project tasks are now filtered consistently across the app.

By default, tasks under archived projects are excluded from:
	•	Calendar indicators (day/week/month)
	•	Progress calculations
	•	Task lists

Enabling Show archived includes them again with archived styling.

⸻

Behaviour Improvements
	•	Calendar, week, and month views now use a single shared “visible task” set
	•	Progress counts reflect only currently visible tasks
	•	Search results respect archived filtering rules
	•	Recurring series remain stable regardless of delete actions

⸻

Scope
	•	No Prisma schema changes
	•	API logic updated for delete modes
	•	UI modal added for recurring deletes
	•	Filtering logic unified across calendar + lists

⸻

🧭 Next Milestone — PR7: Insights & Reporting

PR7 will build on the improved task data to introduce productivity insights, including:
	•	Weekly and monthly completion summaries
	•	Progress trends over time
	•	Project and category performance breakdowns
	•	Foundations for exportable reports

____


🗺️ Roadmap

This project is evolving from a simple task tracker into a personal productivity platform with scheduling, insights, and reporting.

✅ Completed
	•	PR1 — Foundations
	•	PR2 — Scheduling & workspace behaviour
	•	PR3 — Calendar + progress
	•	PR3.x — UX clarity

⸻

🔜 Next Up

PR4 — Task Editing & Structure
	•	Edit task title, dates, category
	•	Project assignment UI
	•	Inline quick edits
	•	Better empty states

PR5 — Categories & Organisation
	•	Category management
	•	Filtering by category
	•	Category colour coding
	•	Category insights

PR6 — Projects Expansion
	•	Project progress tracking
	•	Project timeline view
	•	Archive / complete projects
	•	Project-level reporting

⸻

📊 Future Direction

Insights & Reporting
	•	Weekly productivity summaries
	•	Completion trends
	•	Streak tracking
	•	Exportable reports

Automation & Smart Behaviour
	•	Recurring tasks
	•	Smart rollover rules
	•	Notifications/reminders
	•	AI-assisted planning

⸻

🎯 Vision

A lightweight personal operating system for work and life:

Plan → Execute → Reflect

Where:
	•	Planning happens through calendar context
	•	Execution happens through focused daily lists
	•	Reflection happens through progress insights

⸻

📦 Deployment

The app can be deployed easily on Vercel:

https://vercel.com/new

⸻

🧪 Local Development Notes

If you need a fresh database:

bash

npx prisma migrate dev
npm run dev

🙌 Contributing (Future)

Once the core workflow stabilises, contribution guidelines will be added.
:::
