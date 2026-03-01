Task Manager

A profile-based productivity tracker designed to manage real-world workflows across multiple contexts (e.g. Work, Personal, Projects).

The app combines calendar awareness, recurrence logic, and bulk task operations to create a lightweight but powerful planning environment.

⸻

✨ Core Concepts

Profiles

Each profile acts as an independent workspace with its own:
	•	tasks
	•	projects
	•	categories
	•	reporting context

This keeps different areas of life or work cleanly separated.

Projects

Projects group related tasks and provide progress tracking and reporting context.
Tasks can exist with or without a project.

Tasks

Tasks support:
	•	start dates (when work becomes active)
	•	optional due dates
	•	recurring schedules (daily, weekly, custom)
	•	categories
	•	project assignment
	•	completion tracking
	•	rollover behaviour

⸻

🚀 Features

Scheduling & Planning
	•	Day / Week / Month calendar views
	•	Start date driven visibility
	•	Automatic rollover for incomplete tasks
	•	Upcoming and overdue tracking

Recurring Tasks
	•	Daily and weekly repeat rules
	•	Series-aware logic (only one active instance shown)
	•	Delete options: this task / future / entire series
	•	Accurate historical tracking

Productivity Tools
	•	Multi-select bulk actions
	•	Inline editing
	•	Category suggestions
	•	Project assignment
	•	Progress tracking
	•	Reporting averages (Calendar vs Work week)

Organisation
	•	Category memory per profile
	•	Project progress bars
	•	Archive support
	•	Search across tasks and projects

⸻

🧑‍💻 Tech Stack
	•	Next.js (App Router)
	•	React
	•	TypeScript
	•	Prisma
	•	SQLite (local development)
	•	Tailwind (UI styling)

⸻

🛠️ Getting Started

1. Install dependencies

npm install

2. Run the dev server

npm run dev

Open http://localhost:3000 in your browser.

⸻

🧭 Product Direction

The goal of this app is to bridge the gap between simple task lists and heavy project management tools by focusing on:
	•	clarity over complexity
	•	real-world scheduling behaviour
	•	fast daily workflows
	•	meaningful insights into output

⸻

📦 RELEASES

⸻

PR1 — Profiles & Projects Foundation

Summary

Introduced multi-profile architecture and project grouping, transforming the app from a single list into a scalable workspace model.

Added
	•	Profile model
	•	Project model
	•	Task profile + project relations
	•	Default profile backfill
	•	Profile selector UI
	•	Profiles API

⸻

PR2 — Profile-Scoped Tasks & Scheduling

Summary

Established the core task workflow with start dates and rollover behaviour.

Added
	•	Profile-scoped task lists
	•	Start date visibility rules
	•	Automatic rollover
	•	Profile switching
	•	Unassigned task grouping

⸻

PR3 — Calendar Views & Progress Tracking

Summary

Introduced time-aware planning and productivity tracking.

Added
	•	Day / Week / Month views
	•	Navigation between periods
	•	Daily progress bar
	•	Task filters (Today / Upcoming / Overdue)

⸻

PR3.x — UX Clarity Improvements

Summary

Improved visual comprehension of calendar data.

Added
	•	Calendar legend
	•	New vs active indicators
	•	Today filter helper text

⸻

PR4 — Task Editing & Structure

Summary

Enhanced task manipulation and project organisation.

Added
	•	Edit task modal
	•	Inline quick edits
	•	Project assignment UI
	•	Improved empty states

⸻

PR5 — Categories & Organisation

Summary

Introduced category workflows and improved project context.

Added
	•	Category field across tasks
	•	Project progress bars
	•	Archive support
	•	Project cards

⸻

PR6 — Recurrence Controls & Delete Logic

Summary

Completed the recurrence lifecycle with safe editing and deletion behaviour.

Added
	•	Delete scope options (this / future / all)
	•	Recurrence stability fixes
	•	Archive behaviour consistency

⸻

PR7 — Reporting & Preferences

Summary

Expanded insights into productivity with flexible reporting.

Added
	•	Weekly and monthly reporting
	•	Average calculations
	•	Work week vs calendar options
	•	Project column in reports

⸻

PR8 — Series-Aware Recurrence & Accurate Reporting

Summary

Resolved duplication issues by projecting recurring tasks as a single active series.

Added
	•	Series-aware open task projection
	•	Accurate calendar counts
	•	Correct progress calculations
	•	Consistent behaviour across all views

⸻

PR9 — Day View Editing & Bulk Workflow Tools

Summary

Significantly improved daily workflow speed with bulk operations and smarter editing.

Added
	•	Multi-select mode
	•	Bulk actions (complete, move, edit, delete)
	•	Category suggestions
	•	Inline project/date/category edits

⸻

PR9.x — Day View UX Polish

Summary

Refined selection and category behaviour for smoother interaction.

Added
	•	Select all shown
	•	Improved category dropdown behaviour
	•	Consistent combobox interactions

⸻

🚀 PR10 — Quick Add + Snooze/Reschedule (Day view)

Summary

PR10 makes the Day view much faster to use by introducing a Quick Add input for rapid task entry and Snooze/Reschedule controls (single task + bulk) to push work forward without editing each task manually.

This milestone focuses on speed and flow — getting tasks in and moving them around becomes a “type → enter → keep going” experience.

What’s Included

⚡ Quick Add (Day view)
A new Quick Add bar sits at the top of the Day tasks panel (above the Open filters).

Supports inline tokens (order independent):
	•	#category → sets the task category
	•	@project → assigns the task to an existing project (matched by name)
	•	^due:tomorrow or ^due:YYYY-MM-DD → sets due date

Behaviour:
	•	Creates the task for the selected day in the current profile
	•	Strips recognised control tokens from the saved title
	•	Clears after save and keeps focus for rapid entry

Example:
	•	Call plumber #DREAM @Admin ^due:tomorrow

🕒 Snooze / Reschedule (startDate only)
Adds “Snooze” actions that adjust startDate (not due date), available in:

Single-task controls
	•	Tomorrow
	•	Next business day (skips Sat/Sun)
	•	Next week (+7 days)
	•	Pick date…

Bulk toolbar
	•	Same Snooze options apply to multiple selected tasks at once

🔒 Recurrence-safe behaviour
	•	Snoozing recurring tasks applies to the current occurrence only
	•	No series rewrite, no duplication, and tasks continue on their normal repeat cycle

Why This Matters

PR10 dramatically reduces friction in day-to-day usage:
	•	Adding tasks becomes instant
	•	Rescheduling is effortless
	•	Workflows stay clean without opening modals constantly

It sets up the next phase (PR11) to focus on project progress visibility rather than mechanics.

____


🗺️ ROADMAP

Short Term
	•	Editing improvements for recurring series
	•	Keyboard shortcuts
	•	Bulk rescheduling presets

Medium Term
	•	Productivity analytics dashboard
	•	Streak tracking and trends
	•	Exportable reports

Long Term
	•	Sync / cloud persistence
	•	Mobile optimisation
	•	Collaboration features

⸻

📌 Status

The app is now functionally stable as a personal productivity engine with reliable recurrence behaviour and reporting accuracy.

Future milestones will focus on insights and workflow intelligence rather than core mechanics.

⸻

🤝 Contributing

This project is currently in active development.
Architecture and behaviour may evolve as new workflows are tested.

⸻

📄 License

Private project – not licensed for distribution.
:::

⸻

