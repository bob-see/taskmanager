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

📊 PR11 — Project Progress Bars (Day view)

Summary

PR11 introduces per-project progress tracking in the Day view, giving immediate visibility into how work is distributed and progressing across projects.

Alongside the existing overall day progress bar, you can now see completion status for each project (and unassigned tasks), making it easier to spot bottlenecks and understand where your effort is going.

⸻

✨ What’s Included

📂 Project Progress (Today)
A new section appears directly beneath the main Day progress bar:
	•	One row per project that has tasks counted for the selected day
	•	Includes an Unassigned row for tasks without a project
	•	Displays:
	•	Project name
	•	Done / Total count
	•	Compact progress bar

Rows update instantly when:
	•	Tasks are marked done or reopened
	•	The selected day changes
	•	Profiles change
	•	Archived visibility toggles

⸻

🗃 Archived Behaviour
	•	Archived projects are hidden by default
	•	When Show archived is enabled:
	•	Archived project rows appear
	•	Archived styling and badge are applied

⸻

🧠 Why This Matters

PR11 shifts the tracker from just showing what’s done today to showing where progress is happening.

It enables:
	•	Better daily planning
	•	Faster identification of stalled projects
	•	A foundation for future reporting and analytics

⸻

🔒 Scope
	•	Day view only
	•	No database or API changes
	•	Built on the same task visibility logic as the main Day progress bar

____

📅 Latest Update — Tracker UX & Matrix Layout (March 2026)

✅ What we shipped

🎨 Visual refresh (Tracker)
	•	Switched tracker UI from dark theme to light “retro cream” palette
	•	Introduced softer card surfaces for better readability
	•	Improved contrast hierarchy for:
	•	Headers
	•	Filters
	•	Table rows
	•	Overall goal: closer visual alignment to DREAM matrix clarity

🧭 Navigation & structure
	•	Added Tracker / Reporting toggle in header
	•	Cleaner top control bar with:
	•	View switch (Day / Week / Month)
	•	Date navigation
	•	Search
	•	Archive toggle
	•	Quick add task

📊 Matrix-style task tables
	•	Reworked Open and Done into true matrix tables:
	•	Consistent column headers
	•	Fixed row density
	•	Clear task metadata (Project, Category, Dates, Status)

🧷 Sticky header bug fix
Root issue:
Sticky <th> cells were offset to viewport (top-[73px]) causing first row to render underneath header.

Fix implemented:
	•	Each table now lives inside its own scroll container
(relative max-h-[520px] overflow-y-auto)
	•	Sticky headers now use top-0 so they anchor to the card, not the page

Result:
✔ First row fully visible
✔ Header remains sticky
✔ No spacer hacks
✔ No changes to sorting/filtering/data logic

🗂 Reporting direction set
	•	Confirmed approach: Reporting as a dedicated page
	•	Concept aligned with DREAM matrix summary philosophy

⸻

🧠 Product direction confirmed

The tracker is evolving toward a personal operational matrix, not just a to-do list.

Core principles going forward:
	1.	Matrix clarity over card clutter
	2.	Fast scanning (status + time + ownership)
	3.	Reporting as a first-class view
	4.	Minimal cognitive load

⸻

🚧 Next priorities

1️⃣ Reporting page (MVP)

Goal: DREAM-style summary layer

Planned components:
	•	Period selector (Day / Week / Month / Custom)
	•	KPI strip:
	•	Tasks created
	•	Tasks completed
	•	Completion rate
	•	Overdue count
	•	Category / Project breakdown
	•	Trend chart (completion over time)

⸻

2️⃣ Drag & drop ordering (DB persisted)

Allow manual prioritisation of tasks

Scope:
	•	Drag within filtered list
	•	Persist orderIndex per profile
	•	No effect on sort modes (date / status)

⸻

3️⃣ Table usability enhancements
	•	Column visibility toggles
	•	Density modes (Comfortable / Compact)
	•	Keyboard navigation

⸻

4️⃣ Header & branding polish
	•	Final logo placement refinement
	•	Optional subtle elevation on sticky header
	•	Responsive tightening for smaller screens

⸻

5️⃣ Data & intelligence layer (future)
	•	Task aging indicators
	•	Smart “focus” suggestions
	•	Reporting export (CSV / PDF)

⸻

🗺 Longer-term vision

The tracker becomes:

A lightweight personal command centre
sitting philosophically between a task manager and a DREAM matrix.

It should answer instantly:
	•	What needs attention?
	•	What’s slipping?
	•	Where is time going?

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

