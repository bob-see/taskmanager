Publication Principle

- The Engineering Playbook should continue to read like a professional engineering handbook rather than generated documentation.
- Preserve the calm, measured, repository-first tone throughout.
- Favour timeless engineering judgement over implementation detail wherever possible.
- Optimise readability and long-term value rather than document length.


TaskManager Engineering Playbook v2.0
Editorial Review Notes

Front Matter

Cover
- Change "Repository-Based Edition" to "Repository Edition".

Foreword
- Keep the repository statement unchanged.
- In the final paragraph, begin with:
  "Technical choices are rarely neutral."
  Then continue into the existing paragraph.
- Add a sentence reinforcing one of the project's core philosophies:
  "TaskManager is intentionally engineered to remain understandable. Every architectural decision, documentation standard and engineering practice described in this Playbook exists to preserve that quality as the application grows."

Purpose & Scope
- Move the "Regeneration Triggers" section so it appears after the Source Document and Version Map. This improves the narrative flow:
  Purpose
  → Source Documents
  → Regeneration Triggers

Source Document and Version Map
- Simplify verification metadata.
- Replace the full commit hash with a concise "Verified" date (or equivalent wording).
- Keep detailed commit information for an appendix or publication metadata rather than the main narrative.

Quick AI Context
- No content changes.
- Continue treating this chapter as one of the defining features of the Playbook and preserve it as a model for future projects (Song Archive, Prospector, etc.).


Chapter 2 – TaskManager at a Glance

Delegated Tasks
- Add one sentence explaining why delegated tasks exist (shared ownership, accountability and collaboration), not just how they work.

Browser Push
- Reduce implementation detail slightly.
- Focus on user capability rather than implementation mechanics.
- Leave detailed technical implementation to the Architecture chapter.

Opening Section
- Consider adding one closing sentence reinforcing the product philosophy:
  "TaskManager deliberately favours clarity, practical workflows and focused collaboration over enterprise-scale complexity."

Diagram
- Consider adding one simple conceptual product diagram showing the relationship between:
  User → Profiles → Tasks/Projects → Overview → Delegation / Groups / Spaces → Notifications → Reports.


Chapter 3 – TaskManager Engineering Philosophy

Overall
- This chapter is exceptionally strong and should remain principles-focused rather than implementation-focused.
- Preserve its timeless character.

New Engineering Principle
- Consider adding a short section:
  "Name Things Carefully"
- Explain that good names become part of the architecture and should describe enduring responsibility rather than temporary implementation.
- Use TaskManager examples such as Profiles, Overview, Groups, Collaborative Spaces and Browser Push.

Presentation
- Consider adding a one-line bold takeaway beneath each philosophy heading to improve readability and skimmability.
  Example:
  **Prefer clearer workflows over more configurable workflows.**
  followed by the existing explanation.

Engineering Questions
- Preserve the "Applying the Philosophy" section and the four engineering questions exactly as the core decision-making framework for the project.


Chapter 4 – Documentation System

Documentation Hierarchy
- Consider renaming "Documentation Pyramid" to "Documentation Hierarchy" if it better reflects the layered progression rather than a strict pyramid.
- Retain the explanatory note that the diagram is a reading progression, not an authority hierarchy over the repository.

Documentation Ownership Table
- Preserve the ownership table exactly.
- Consider giving this table greater visual prominence in the published PDF, as it defines the long-term documentation architecture.

Documentation Change Patterns
- Consider adding a fourth documentation change pattern:
  "Documentation Refactoring"
- Explain that improving clarity, organisation and readability—without changing technical facts—is a valid and valuable form of documentation maintenance.

Documentation Philosophy
- Consider adding a short principle acknowledging that documentation is itself an engineered product.
- Reinforce that documentation should be intentionally designed, reviewed, maintained and refined just like software.

Publication
- Consider visually highlighting the paragraph:
  "Documentation can also carry uncertainty honestly..."
- This is an important repository-first principle and particularly valuable for AI-assisted development.


Chapter 5 – Working With AI and Codex

Overall
- Preserve this chapter largely as written.
- It has become one of the defining sections of the Playbook.

New Section
- Consider adding:
  "When Not to Use Codex"
- Explain that early product thinking, architecture exploration, naming, prioritisation and workflow design should usually happen before implementation prompts are written.

Codex Philosophy
- Consider adding a short principle:
  "Codex is an implementation assistant, not the project architect."
- Reinforce that architecture and product judgement remain human responsibilities.

Prompt Philosophy
- Consider adding a concise statement such as:
  "The best Codex prompts minimise ambiguity rather than maximise detail."

Publication
- Consider presenting the Codex Prompt Skeleton as a visually distinct reference page or quick-reference card in the published PDF.


Chapter 6 – Architecture Overview

Architecture Philosophy
- Consider adding one sentence near the introduction reinforcing that the architecture deliberately favours explicit domain boundaries over highly abstract infrastructure.

Mermaid Diagram
- Consider visually distinguishing the "Repository Markdown" governance node in the published PDF to reinforce that documentation governs engineering but is not part of the runtime architecture.

Layer Responsibilities
- Consider bolding or visually emphasising:
  "Direct calls must be safe even if the normal UI would never issue them."
- This is one of the project's most important security principles.

Shared Services
- Consider reinforcing that shared services centralise behaviour but do not replace route-level authorisation decisions.

Delegated Completion
- Consider replacing or supplementing the textual flow with a simple sequence diagram:
  Browser → API → Ownership → Prisma → Notification Dispatcher → Push → UI Refresh.

Architectural Boundaries
- Consider adding an additional architectural reminder:
  "UI state is never evidence of server authority."


Chapter 7 – Architectural Principles and Decisions

ADR Guidance
- Add a short paragraph explaining when a decision deserves an ADR.
- Suggested principle:
  "Not every implementation choice requires an ADR. Record one when the decision changes a durable architectural boundary, security model, data strategy, operational rule, or long-term product structure."

Decision Lifecycle
- Add a short paragraph after the table explaining that ADR review triggers should be followed.
- Clarify that accepted decisions should not be silently rewritten.
- Significant changes should be recorded through a new or superseding ADR.

Repository-First Documentation
- Consider adding a brief callout:
  "Generated handbooks may summarise accepted decisions, but changes to architectural rationale belong in docs/DECISIONS.md first."

Prisma Wording
- Consider changing:
  "Prisma relation mode supports legacy compatibility"
  to:
  "Prisma relation mode is retained for legacy database compatibility."
- This better reflects the trade-off and current constraint.

Presentation
- Preserve the three-column decision table.
- It is concise, readable and should remain the primary visual element of the chapter.


Chapter 8 – Major Systems

Overall
- Preserve the consistent structure:
  Purpose → Key Rule → Relationships → Preserve → Sources.
- This makes the chapter highly scannable and should remain one of the handbook's strongest reference sections.

Consistency
- Standardise the wording in each "Preserve" section so they consistently begin with an action (e.g. "Preserve...").

Notifications
- Consider reinforcing that notifications are the canonical record of recipient-facing domain events, with Browser Push acting as a delivery channel.

Browser Push
- Consider adding one sentence explaining that Browser Push is intentionally replaceable as a delivery mechanism without changing notification domain logic.

Presentation
- Consider adding small conceptual relationship diagrams where they improve understanding without duplicating the Architecture chapter.
- Example:
  Profile → Projects → Tasks → Delegation.

Future Direction
- Consider whether each major system should finish with a single "Future Direction" sentence describing architectural intent (not roadmap commitments).
- Only include this if it genuinely adds long-term value without introducing speculative design.


Chapter 9 – Security Model

Overall
- Preserve this chapter largely unchanged.
- It accurately reflects the implemented security model without overstating guarantees.

Presentation
- Consider visually emphasising:
  "Admin is not a universal profile bypass."
- This is one of the application's key security principles.

Compact Security Invariants
- Consider numbering the invariants instead of bullet points.
- This makes future discussion, reviews and documentation cross-references easier.

Known Security Gaps
- Consider adding one sentence reinforcing repository-first practice:
  "Remove these documented gaps only after the implementation and corresponding regression tests are complete."

Security Philosophy
- Consider adding a short principle:
  "Security rules should be explicit."
- Reinforce that ownership, roles, participants and permissions should be enforced through visible server-side rules rather than implied by UI behaviour or convention.

Publication
- Consider giving the Compact Security Invariants section distinctive visual treatment in the published PDF as one of the handbook's key reference pages.


Chapter 10 – Testing and Verification

Overall
- Preserve this chapter largely unchanged.
- It accurately reflects the current testing strategy and distinguishes clearly between different forms of verification.

Verification Layers
- Consider presenting the verification layers as a simple visual progression in the published PDF:
  Logic Tests → Service Tests → Route Tests → Manual Workflow → Real Device → Deployment Smoke.

Three Verification Questions
- Consider visually highlighting the three guiding questions in "Selecting Verification by Failure Cost" as a reusable engineering checklist.

Manual Evidence
- Consider adding a short reinforcing sentence:
  "The goal of manual evidence is confidence, not paperwork."

Testing Philosophy
- Consider adding a short principle:
  "Test behaviour rather than implementation."
- Reinforce that durable tests verify observable domain rules and security boundaries instead of internal implementation details.

Future Direction
- Consider adding one sentence explaining that future automated testing should continue to prioritise ownership, security boundaries and domain behaviour over framework-specific implementation details.

Publication
- Consider giving the "Compact change-based verification" table and the "Three Questions" section prominent visual treatment in the published handbook.


Chapter 11 – Database and Migration Discipline

Overall
- Preserve this chapter largely unchanged.
- It captures the project's database philosophy exceptionally well and focuses on operational discipline rather than Prisma mechanics.

Production Safety
- Consider presenting the "Production safety" rules as a visually distinct callout or reference panel in the published PDF.

Database Philosophy
- Consider adding a short principle:
  "Database changes are product changes."
- Reinforce that schema evolution, migrations and operational safety are part of feature development rather than post-development deployment tasks.

Migration Lifecycle
- Consider adding a simple lifecycle diagram showing:
  Idea → Schema → Migration → Review → Test → Deploy → Verify.
- Focus on engineering workflow rather than Prisma internals.

Migration Ledger
- Consider adding one sentence reinforcing that the migration ledger is operational evidence, not merely administrative bookkeeping.
- Emphasise its role in recovery, auditing and historical understanding.

Writing Style
- Preserve the action-oriented step sequence (Confirm, Update, Create, Review, Test, Commit, Back up, Apply, Confirm), as it makes the workflow easy to follow.


Chapter 12 – Development Workflow

Overall
- Preserve this chapter largely unchanged.
- It accurately captures the project's mature engineering workflow and should remain implementation-focused rather than philosophical.

Workflow Presentation
- Consider presenting the ten-step development workflow as a full-page visual progression in the published PDF.
- This would make the chapter an effective day-to-day engineering reference.

Pause Points
- Consider adding a short section explaining that high-risk work benefits from intentional pause points before implementation continues.
- Examples include migrations, permission changes, broad refactoring and workflow-breaking changes.

Iteration
- Consider acknowledging that development is iterative rather than strictly linear.
- Reinforce that new evidence discovered during review or validation may require returning to clarification or scope before continuing.

Engineering Philosophy
- Consider adding a short principle:
  "Good engineering reduces uncertainty."
- Explain that repository inspection, scoped prompts, verification and documentation each exist to reduce uncertainty before changes are accepted.

Publication
- Consider highlighting the workflow diagram as one of the Playbook's primary quick-reference pages.


Chapter 13 – Definition of Done

Overall
- Preserve this chapter largely unchanged.
- It has become the operational expression of the project's engineering standards.

Engineering Reflection
- Consider adding one final reflective question before completion:
  "Has this change made the system clearer, safer, simpler or more maintainable than before?"
- Reinforce that Definition of Done is about improving the system, not merely completing work.

Completion Philosophy
- Consider adding a short principle:
  "Done is demonstrated, not assumed."
- Emphasise that completion requires evidence rather than confidence.

Presentation
- Consider grouping the checklist into small visual sections (Implementation, Protection, Documentation, Completion) if this improves readability without changing meaning.

Publication
- Consider presenting the Definition of Done as a standalone full-page reference checklist in the published PDF.
- It has the potential to become one of the handbook's most frequently revisited pages.

Repository Practice
- Preserve the "Reviewed — no update required" statement exactly as written.
- It has become a defining repository-first engineering principle.


Chapter 14 – Maintaining Engineering Quality

Overall
- Preserve this chapter largely unchanged.
- It successfully shifts the focus from completing work to sustaining long-term engineering quality.

Technical Debt
- Consider adding a reinforcing sentence:
  "Technical debt is safest when it is visible, understood and intentionally prioritised rather than silently accepted."

Extending Existing Systems
- In the "New Systems" discussion, consider adding:
  "Could this requirement be met by extending an existing system owner?"
- This reinforces one of the Playbook's recurring architectural principles.

Engineering Quality
- Consider adding a short principle:
  "Engineering quality compounds."
- Explain that small improvements accumulate just as small shortcuts do.

Coherence
- Consider adding one overarching engineering principle:
  "Every accepted change should leave the overall system at least as coherent as before."
- This ties together architecture, documentation, security and workflow into a single long-term objective.

Publication
- Preserve this chapter as a reflective, long-term maintenance guide rather than a procedural checklist.


Chapter 15 – Engineering Judgement

Overall
- Preserve this chapter largely unchanged.
- It has become one of the Playbook's defining philosophical chapters and should remain reflective rather than procedural.

Reversible Decisions
- Consider adding a short engineering principle:
  "Prefer reversible decisions where practical."
- Reinforce that incremental migrations, focused commits, additive changes and extensible designs reduce long-term risk.

Engineering Curiosity
- Consider adding a short principle:
  "Investigate before concluding."
- Explain that unexpected behaviour should first be understood through repository evidence before implementation changes are proposed.

Publication
- Consider giving this chapter more whitespace and simpler page layouts than surrounding technical chapters.
- It should read more like an engineering essay than a reference manual.

Writing Style
- Resist expanding the chapter unnecessarily.
- Its strength comes from clarity, restraint and timeless engineering guidance.


Correction to Editorial Review Notes

- Remove the previous notes labelled:
  "Chapter 14 – Maintaining Engineering Quality"
  and
  "Chapter 15 – Engineering Judgement"

- Those are not chapters in the current manuscript.

- Retain the following ideas for consideration during the review of Chapter 17 – Engineering Lessons Learned:
  - Engineering quality compounds.
  - Technical debt is safest when visible, understood and intentionally prioritised.
  - Every accepted change should leave the system at least as coherent as before.
  - Prefer reversible decisions where practical.
  - Investigate before concluding.
  - Preserve clarity and long-term understandability.


Chapter 14 – Operational Workflow

Overall
- Preserve this chapter as an operational reference rather than an explanatory chapter.
- Its strength comes from consistency, predictability and repeatable engineering practice.

Workflow Philosophy
- Consider adding a short principle:
  "Operational workflows reduce variability, not judgement."
- Reinforce that workflows support engineering decisions rather than replacing them.

Repository References
- Ensure each operational workflow points back to its owning repository document where detailed procedures exist (for example, migration workflow).

Evidence
- Consider ending each workflow with a short prompt:
  "What evidence demonstrates this workflow completed successfully?"
- This aligns operational practice with the Playbook's evidence-based philosophy.

Publication
- Consider presenting recurring workflow steps as simple vertical flow diagrams or reference panels to improve readability.


Chapter 15 – Common Change Checklists

Overall
- Preserve this chapter as a practical engineering reference rather than explanatory documentation.
- Its value comes from helping engineers avoid common omissions during implementation.

Checklist Structure
- Consider ending every checklist with:
  "Don't forget to review..."
- List the owning repository documents that normally require review for that type of change.

Checklist Philosophy
- Reinforce that checklists are reminders, not replacements for engineering judgement.
- They should summarise recurring lessons rather than teach implementation.

Security
- Ensure security-oriented checklists focus on server-side enforcement and ownership rules rather than UI behaviour.

Browser Push
- Explicitly include real-device verification wherever Push behaviour is affected.

Presentation
- Consider presenting each checklist as a visually distinct reference panel with consistent formatting throughout the chapter.

Scope
- Resist adding checklists simply for completeness.
- Keep only those that represent common engineering activities within TaskManager.


Chapter 16 – Known Technical Debt and Future Review

Overall
- Preserve the five-category structure:
  Security, Testing, Architecture, Operations and Product-Specific Future Review.
- The chapter successfully distinguishes active defects from longer-term review areas.

Debt Classification
- Consider adding a concise classification system for each item:
  - Confirmed defect
  - Coverage gap
  - Known limitation
  - Architecture review
  - Product opportunity
- This would make the register easier to scan and prioritise.

Verified Security Defects
- Keep profile reorder ownership and timer start/stop ownership visually prominent until fixed.
- Remove them only after:
  - implementation is complete;
  - wrong-user regression tests exist;
  - docs/SECURITY.md is updated;
  - docs/TESTING.md is updated.

Prioritisation
- Preserve the warning against classifying every item as High priority.
- Preserve the distinction between:
  "broken now",
  "coverage missing",
  "architecture could mature",
  and
  "reconsider only if conditions change".

Ownership
- Consider whether the living technical-debt register should identify the conversation or workstream that owns each item:
  Development,
  Documentation & Architecture,
  Product & Roadmap,
  or Operations.
- This may belong in docs/ARCHITECTURE.md rather than the published PDF.

Time-Sensitive Metrics
- Consider removing exact lint error/warning counts from the published handbook.
- Replace them with a timeless statement that a known lint baseline exists and refer readers to docs/TESTING.md and current command output for verified figures.

Debt Retirement
- Preserve the principle:
  "Debt should leave the register when evidence changes."
- Reinforce that resolved debt should be removed from the active register rather than retained indefinitely.


Chapter 17 – Engineering Lessons Learned

Overall
- Preserve this chapter as the reflective conclusion to the Engineering Playbook.
- It should capture enduring engineering lessons rather than introduce new technical guidance.

Engineering Lessons
- Preserve the focus on lessons learned through building TaskManager rather than general software engineering advice.
- This authenticity is one of the chapter's greatest strengths.

New Lesson
- Consider adding:
  "Understanding before optimising."
- Reinforce that repository inspection and architectural understanding consistently produced better implementation decisions than immediate optimisation or refactoring.

Engineering Maturity
- Consider adding a short principle:
  "Engineering maturity is measured by clarity, confidence and understanding—not complexity."

Presentation
- Give this chapter more whitespace and fewer diagrams than the technical chapters.
- Consider using occasional pull quotes to emphasise the most enduring lessons.

Closing
- Consider strengthening the final paragraph with a closing reflection such as:
  "This Playbook does not attempt to preserve today's implementation. It exists to preserve the quality of engineering judgement that allows the implementation to continue evolving."


Chapter 18 – Direction and Roadmap Principles

Overall
- Preserve the chapter as a directional guide rather than a feature roadmap.
- Keep the opening principle:
  "TaskManager’s direction should be expressed as capability maturity, not a crowded wishlist."

Transferable Methodology
- Add a short closing paragraph explaining that TaskManager is the case study, but the underlying engineering judgement is intentionally transferable to future projects.
- Suggested emphasis:
  improve capability deliberately,
  add complexity only when justified,
  preserve clarity as the product grows.

Conversation Boundaries
- Strengthen the distinction:
  - This chapter defines direction.
  - The Product & Roadmap conversation defines priority and timing.
  - The Development conversation defines implementation.

New Direction
- Consider adding:
  "User documentation maturity"
- Explain that TaskManager should eventually provide separate audience-appropriate documentation for users and administrators without duplicating engineering documentation.

Routine Support Wording
- Consider changing:
  "Optional check-in generalisation"
  to:
  "Configurable routine support"
- Explain that Sunday Check-ins should be generalised only when a broader user need and clear model justify it.

Publication
- Consider visually emphasising:
  "Real-time only when justified."
- It is one of the Playbook’s clearest examples of evidence-based restraint.


Chapter 19 – Useful Commands

Overall
- Preserve this chapter as a curated engineering reference rather than a comprehensive command catalogue.
- Its purpose is to explain the commands the project intentionally relies upon and the evidence each command does—and does not—provide.

Opening
- Consider visually highlighting:
  "Commands are tools, not evidence that every workflow is correct."
- This has become one of the handbook's defining operational principles.

Git Commands
- Consider adding a small Git section covering:
  - git status
  - git diff
  - git diff --check
- These commands have become part of the project's routine engineering workflow and documentation review process.

Workflow Principle
- Consider adding a short reminder:
  "Inspect the repository before running commands."
- Reinforce that understanding the current branch, working tree and target environment should precede operational commands.

Scope
- Resist expanding this into a generic command reference.
- Include only commands that are intentionally part of the TaskManager engineering workflow.

Publication
- Give the command table generous spacing and clear visual hierarchy to maximise its usefulness as a quick-reference page.


Chapter 20 – Glossary

Overall
- Preserve the Glossary as a concise domain reference rather than a software dictionary.
- Its strength comes from defining TaskManager terminology, not generic engineering concepts.

Writing Style
- Preserve the existing pattern of explaining both what a concept is and, where helpful, what it is not.
- This greatly improves conceptual clarity.

New Entries
- Consider adding:
  - TaskManager Case Study
  - Engineering Playbook
- These terms now appear naturally throughout the handbook and support its transferable engineering methodology.

Scope
- Resist adding generic software terms (API, JWT, Prisma, Node, etc.).
- Keep the Glossary focused on concepts that are unique to the TaskManager engineering model.

Publication
- Consider visually grouping entries alphabetically with clear section dividers to improve handbook usability.

Definition of Done
- Consider giving the "Definition of Done" entry slightly greater visual emphasis.
- It has become one of the defining concepts of the Playbook and the project's engineering culture.


