Awesome — here’s a clean, polished full README you can copy-paste and replace your existing one with.
It keeps your release history, adds structure, and reads like a real product repo rather than a scaffold.

⸻

:::writing{variant=“standard” id=“readme_full”}

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
