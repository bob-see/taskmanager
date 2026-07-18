# Publication Draft 1 — Visual QA

## Build Record

- Publication: TaskManager Engineering Playbook — Repository Edition v2.0
- Draft: Publication Draft 1
- Generated: 12 July 2026
- Total pages: 65
- PDF: `TaskManager Engineering Playbook - Repository Edition v2.0 - Draft 1.pdf`
- Build command: `npm run docs:playbook`
- QA render command: `npm run docs:playbook:qa`

## Pages Inspected

All 65 pages were rasterised and inspected through six contact sheets. Full-resolution inspection also covered:

- pages 1–5: cover, principles, publication record, Table of Contents, and Part I divider;
- pages 6–23: Foreword, Quick AI Context, Chapters 1–5, Codex prompt/reference treatments, Documentation Hierarchy, tables, checklists, and code blocks;
- pages 24–44: Part II divider, Chapters 6–13, Architecture Overview, verification and migration diagrams, security and testing checklists, development workflow, warning callout, and Definition of Done;
- pages 45–56: Part III divider, Chapters 14–18, operational checklist, common change checklists, technical-debt register, wide lessons table, and roadmap principles;
- pages 57–65: Part IV divider, Using This Playbook, Useful Commands, Glossary, appendices, prompt skeleton, feature checklist, and Source Attribution Note.

## Confirmed Results

- The cover uses the authorised TaskManager PNG logo at a restrained size with correct proportions and transparency.
- The principles and publication pages are present and free of running headers and footers.
- The Table of Contents fits on one page, includes all required major entries, displays page numbers, and links to PDF destinations.
- All four part dividers occupy intentional standalone pages and do not create fragments or accidental blank pages.
- Every numbered chapter begins on a new page with a consistent chapter number, title, and non-duplicated introductory paragraph.
- Foreword, Quick AI Context, Using This Playbook, Appendices, and Source Attribution Note use unnumbered opener treatments.
- Running headers and footers are restrained; physical page numbers are continuous.
- Documentation Hierarchy and Architecture Overview SVGs are readable at print scale.
- Development workflow, verification layers, and migration lifecycle diagrams are readable and use the same visual language.
- The repository node in Architecture Overview is visually distinguished from runtime nodes.
- Tables retain readable type, repeated visual hierarchy, padding, and alternating fills. No table was observed clipping outside the page.
- Major checklists use clear print-friendly empty boxes. The project Definition of Done receives a dedicated full-page treatment.
- The production migration prohibition uses the restrained red Warning treatment.
- The AI operating rule and engineering principle callouts use the blue system; repository notes use neutral grey.
- Code blocks and commands retain exact text, use a light neutral panel, and wrap within the printable area.
- Useful Commands, Glossary, appendices, and Source Attribution Note are complete.
- No missing images, broken diagrams, clipped callouts, orphaned chapter headings, or unreadably compressed tables were observed.

## Known Draft 1 Layout Issues

- Several long chapters and tables continue naturally across pages. The Engineering Lessons Learned table spans two pages; its continuation is readable but could receive a stronger continuation cue in Draft 2.
- Some continuation pages begin with body content rather than a repeated section label. Running headers provide context, but denser operational chapters could use more deliberate continuation rhythm.
- The Source Attribution Note is intentionally sparse. Draft 2 may rebalance its vertical spacing if the final provenance text remains short.
- Part-divider colour is contained by print-safe margins rather than extending to bleed. This is suitable for ordinary A4 printing but not a full-bleed press treatment.
- Repository-relative links are shown as readable paths and are intentionally not clickable local filesystem links.

## Hyperlinks and Bookmarks

- Chrome-generated PDF bookmarks are present for front matter, parts, chapters, appendices, and section headings.
- Table of Contents entries are internal clickable links.
- Repository-relative links do not create broken `file://` targets.
- Some PDF viewers may compact spacing in bookmark labels for wrapped headings; destination behavior remains usable.

## Font and Print Observations

- The reviewed macOS build used the documented system fallbacks: Helvetica Neue/Arial-style sans serif, Georgia-style serif, and SF Mono-style monospace.
- No proprietary font files are packaged.
- Contrast remains legible in greyscale: hierarchy also uses weight, borders, spacing, and fills rather than colour alone.
- Fine blue diagram arrows and dotted Table of Contents leaders remain visible at the inspected raster scale, but should be checked on the intended physical printer before final release.

## Recommended Draft 2 Refinements

1. Test a printed A4 proof and adjust fine rules or diagram arrows only if the target printer loses contrast.
2. Consider a continuation treatment for the Engineering Lessons Learned table and other multi-page reference tables.
3. Review whether the Source Attribution Note should remain spacious or use a smaller provenance panel.
4. Verify page flow on the final release environment after font selection is fixed.
5. Recheck all verification dates, test counts, debt statements, branch, and commit immediately before final publication.

Draft 1 is complete and suitable for publication visual review. These recommendations are refinements rather than blockers.
