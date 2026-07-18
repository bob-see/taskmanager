# TaskManager Engineering Playbook Publication System

This directory owns the reproducible publication pipeline for the TaskManager Engineering Playbook. It turns the reviewed repository manuscript into one complete, print-ready PDF. It does not create a second source of engineering truth.

The content source is [`docs/ENGINEERING_PLAYBOOK_V2_SOURCE.md`](../ENGINEERING_PLAYBOOK_V2_SOURCE.md). Make factual and editorial changes there first. [`PLAYBOOK_PUBLICATION.md`](./PLAYBOOK_PUBLICATION.md) contains only publication front matter, metadata placeholders, the Table of Contents marker, and the manuscript insertion point.

Never edit the generated PDF to correct content. Rebuild it from the repository sources.

## Toolchain

The pipeline uses:

- `markdown-it` to render the assembled Markdown source;
- repository-owned JavaScript to inject front matter, part dividers, chapter openers, callout classes, repository-path treatments, and diagrams;
- repository-owned CSS for A4 print layout, typography, running matter, tables, checklists, code, and page breaks;
- `puppeteer-core` with an installed Google Chrome executable to generate one complete PDF;
- `pdfjs-dist` to read PDF bookmarks and populate accurate Table of Contents page numbers;
- `pdf-lib` to set publication metadata without changing content;
- `pdfjs-dist` and `@napi-rs/canvas` to rasterise every PDF page for visual QA.

Chrome is driven through `puppeteer-core`; no separate browser download is bundled. SVG diagrams are generated directly by the build script, so no Mermaid runtime or graphics framework is required.

## Prerequisites

- Node.js 22.13.0 or later and npm compatible with the repository lockfile. The repository `.nvmrc` selects the minimum supported baseline.
- Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, or `CHROME_PATH` set to another compatible Chrome/Chromium executable.
- Git, used to read the current branch and verified commit.
- The authorised logo at [`assets/taskmanager-logo.png`](./assets/taskmanager-logo.png).

Install locked dependencies with:

```sh
npm install
```

## Build Draft 1

From the repository root, the complete build command is:

```sh
npm run docs:playbook
```

The command:

1. clears `docs/publication/.build/`;
2. regenerates all SVG diagrams under `docs/publication/assets/diagrams/`;
3. assembles the template and manuscript into `.build/PLAYBOOK_PUBLICATION.generated.md`;
4. renders `.build/playbook.html`;
5. creates a first PDF pass and reads its bookmarks;
6. adds accurate Table of Contents page numbers;
7. renders the complete PDF again;
8. applies PDF metadata; and
9. writes the publication output under `docs/publication/generated/`.

The Draft 1 output is:

```text
docs/publication/generated/TaskManager Engineering Playbook - Repository Edition v2.0 - Draft 1.pdf
```

No chapter PDFs are created or merged.

## Diagrams

The build regenerates these vector assets automatically:

- `documentation-hierarchy.svg`;
- `architecture-overview.svg`;
- `verification-layers.svg`;
- `migration-lifecycle.svg`; and
- `development-workflow.svg`.

Their relationships and labels are derived from the manuscript. Edit the diagram-generating functions in [`scripts/build-playbook.mjs`](./scripts/build-playbook.mjs) when the owning manuscript content changes, then rebuild the complete publication.

## Visual QA

Rasterise every page and produce twelve-page contact sheets with:

```sh
npm run docs:playbook:qa
```

Page images are written to `.build/qa-pages/`; contact sheets are written to `.build/qa-contact-sheets/`. Review the full set plus full-resolution pages for the cover, front matter, part dividers, every chapter opener, diagrams, wide tables, checklists, code blocks, glossary, appendices, and attribution page. Record findings in `generated/DRAFT_1_QA.md`.

The raster files are disposable build artefacts. The QA report and publication PDF are retained outputs.

## Final Editions and Metadata

Publication identity is defined near the top of `scripts/build-playbook.mjs` and in `PLAYBOOK_PUBLICATION.md`. For a later draft or final edition:

1. verify and update the manuscript and owning repository documents;
2. update edition, version, draft label, verification date, filenames, and PDF metadata together;
3. update or remove draft wording in the publication template;
4. rebuild from a clean `.build/` directory;
5. repeat complete visual QA; and
6. verify the branch and commit shown on the publication page and Source Attribution Note.

The build reads the current branch and commit automatically. The Source Attribution Note remains manuscript content and must be reviewed when verification provenance changes.

## Logo and Fonts

`assets/taskmanager-logo.png` is the authorised TaskManager publication logo. Preserve the original file unchanged. The current pipeline uses it directly and does not generate a replacement.

The font strategy deliberately avoids packaged proprietary files:

- headings and navigation: Inter when locally available, then Helvetica Neue or Arial;
- body and reflective text: Georgia, then Cambria or Times New Roman;
- code and paths: SF Mono, then Consolas or Liberation Mono.

This fallback strategy keeps the build portable. Exact line breaks can vary slightly between operating systems when different fallback fonts are selected, so a final-edition build should be visually verified on its release environment.

## Known Limitations

- Chrome supplies PDF bookmarks from semantic headings, but wrapped heading text can be represented compactly by some PDF viewers.
- Repository-relative manuscript links are rendered as readable repository paths rather than unsafe local `file://` links.
- Part-divider colour remains inside print-safe margins; the publication is not designed for full-bleed commercial printing.
- Page layout is deterministic for the documented build environment but can reflow if system font fallbacks differ.
- Generated HTML and assembled Markdown are implementation artefacts, not content sources.
