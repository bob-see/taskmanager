#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import MarkdownIt from "markdown-it";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  renderRepositoryLink,
  renderToc,
  slugHeading,
} from "./playbook-html.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const publicationDir = path.join(root, "docs/publication");
const manuscriptPath = path.join(root, "docs/ENGINEERING_PLAYBOOK_V2_SOURCE.md");
const templatePath = path.join(publicationDir, "PLAYBOOK_PUBLICATION.md");
const cssPath = path.join(publicationDir, "styles/playbook.css");
const logoPath = path.join(publicationDir, "assets/taskmanager-logo.png");
const diagramsDir = path.join(publicationDir, "assets/diagrams");
const buildDir = path.join(publicationDir, ".build");
const generatedDir = path.join(publicationDir, "generated");
const assembledPath = path.join(buildDir, "PLAYBOOK_PUBLICATION.generated.md");
const htmlPath = path.join(buildDir, "playbook.html");
const firstPdfPath = path.join(buildDir, "playbook-first-pass.pdf");
const renderedPdfPath = path.join(buildDir, "playbook-rendered.pdf");
const outputPath = path.join(generatedDir, "TaskManager Engineering Playbook - Repository Edition v2.0 - Draft 1.pdf");
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const slugCounts = new Map();

const generatedDate = new Intl.DateTimeFormat("en-AU", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane",
}).format(new Date());
const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

await assertFile(manuscriptPath, "manuscript");
await assertFile(templatePath, "publication template");
await assertFile(cssPath, "publication stylesheet");
await assertFile(logoPath, "authorised TaskManager logo");
await assertFile(chromePath, "Google Chrome executable");

await fs.rm(buildDir, { recursive: true, force: true });
await fs.mkdir(buildDir, { recursive: true });
await fs.cp(path.join(publicationDir, "assets"), path.join(buildDir, "assets"), { recursive: true });
await fs.mkdir(generatedDir, { recursive: true });
await fs.mkdir(diagramsDir, { recursive: true });
await writeDiagrams();

const manuscript = await fs.readFile(manuscriptPath, "utf8");
const template = await fs.readFile(templatePath, "utf8");
const css = await fs.readFile(cssPath, "utf8");
const transformed = transformManuscript(manuscript);
const tocEntries = collectTocEntries(transformed);
const toc = renderToc(tocEntries);
const assembled = template
  .replace("{{BRANCH}}", escapeHtmlText(branch))
  .replace("{{COMMIT}}", escapeHtmlText(commit))
  .replace("{{GENERATED_DATE}}", escapeHtmlText(generatedDate))
  .replace("{{TOC}}", toc)
  .replace("<!-- PLAYBOOK_MANUSCRIPT -->", transformed);
await fs.writeFile(assembledPath, assembled);

const md = new MarkdownIt({ html: true, linkify: false, typographer: true });
const defaultHeadingOpen = md.renderer.rules.heading_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const inline = tokens[idx + 1];
  const title = inline?.content || "section";
  tokens[idx].attrSet("id", uniqueSlug(title));
  return defaultHeadingOpen(tokens, idx, options, env, self);
};
let body = md.render(assembled);
body = styleCallouts(body);
body = styleChecklists(body);

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TaskManager Engineering Playbook</title>
<meta name="author" content="TaskManager Project">
<meta name="description" content="Repository-First Software Engineering">
<style>${css}</style>
</head><body>${body}</body></html>`;
await fs.writeFile(htmlPath, html);

await printPdf(htmlPath, firstPdfPath);
const pageMap = await readOutlinePageMap(firstPdfPath, tocEntries);
let numberedHtml = html;
for (const entry of tocEntries) {
  const page = pageMap.get(entry.title);
  if (page) numberedHtml = numberedHtml.replace(`data-toc-title="${escapeHtmlAttribute(entry.title)}">?</span>`, `data-toc-title="${escapeHtmlAttribute(entry.title)}">${page}</span>`);
}
await fs.writeFile(htmlPath, numberedHtml);
await printPdf(htmlPath, renderedPdfPath);
await applyMetadata(renderedPdfPath, outputPath);

const finalBytes = await fs.readFile(outputPath);
const finalPdf = await PDFDocument.load(finalBytes);
console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  pages: finalPdf.getPageCount(),
  html: path.relative(root, htmlPath),
  source: path.relative(root, assembledPath),
  diagrams: 5,
}, null, 2));

async function assertFile(file, label) {
  try { await fs.access(file); } catch { throw new Error(`Missing ${label}: ${file}`); }
}

function transformManuscript(source) {
  let text = source.slice(source.indexOf("# Foreword"));
  text = text.replace(/\[(`?)([^\]]+?)\1\]\((\.\.?\/[^)]+)\)/g, (_, tick, label, href) => {
    const repoPath = normaliseRepoPath(href);
    return renderRepositoryLink(label, repoPath);
  });
  text = text.replace(/```mermaid[\s\S]*?```/g, (_, offset) => {
    const before = text.slice(0, offset);
    const architecture = before.includes("# 6. Architecture Overview");
    const name = architecture ? "architecture-overview" : "documentation-hierarchy";
    const caption = architecture ? "Architecture overview and governance boundary" : "Documentation Hierarchy reading progression";
    return `<figure class="diagram"><img src="${escapeHtmlAttribute(`assets/diagrams/${name}.svg`)}" alt="${escapeHtmlAttribute(caption)}"><figcaption>${escapeHtmlText(caption)}</figcaption></figure>`;
  });

  text = text.replace("Verification has distinct layers:\n", "Verification has distinct layers:\n\n<figure class=\"diagram\"><img src=\"assets/diagrams/verification-layers.svg\" alt=\"Verification layers from logic tests through deployment smoke tests\"><figcaption>Verification layers follow the boundary being tested.</figcaption></figure>\n");
  text = text.replace("The normal high-level workflow is:\n", "The normal high-level workflow is:\n\n<figure class=\"diagram\"><img src=\"assets/diagrams/migration-lifecycle.svg\" alt=\"Migration lifecycle from intent through deployment verification\"><figcaption>Migration lifecycle: deliberate change, safe application, verified outcome.</figcaption></figure>\n");
  text = text.replace("Significant changes should follow a visible sequence:\n", "Significant changes should follow a visible sequence:\n\n<figure class=\"diagram\"><img src=\"assets/diagrams/development-workflow.svg\" alt=\"Development workflow from repository inspection through intentional commit\"><figcaption>The workflow is iterative; new evidence may return work to an earlier step.</figcaption></figure>\n");

  const partMarkers = new Map([
    ["# Foreword", partDivider("Part I", "Foundations", "Principles, product context, documentation, and effective collaboration with AI.")],
    ["# 6. Architecture Overview", partDivider("Part II", "Architecture and Engineering", "The boundaries, systems, safeguards, and verification disciplines that keep TaskManager coherent.")],
    ["# 14. Operational Workflow", partDivider("Part III", "Operations and Practice", "Repeatable workflows for releasing, reviewing, maintaining, and evolving the system.")],
    ["# Using This Playbook", partDivider("Part IV", "Reference", "Reading paths, commands, terminology, and compact material for day-to-day use.")],
  ]);
  for (const [heading, divider] of partMarkers) text = text.replace(heading, `${divider}\n\n${heading}`);

  text = text.replace(/^# (.+)\n\n([^\n][\s\S]*?)(?=\n\n)/gm, (match, title, intro) => {
    if (title === "Appendices") return opener(title, "", intro, true);
    const numbered = title.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) return opener(numbered[2], numbered[1], intro, false);
    if (["Foreword", "Quick AI Context", "Using This Playbook"].includes(title)) return opener(title, "", intro, true);
    return match;
  });
  text = text.replace(/^## Source Attribution Note$/m, opener("Source Attribution Note", "", "Publication provenance and repository verification record.", true));
  return text;
}

function opener(title, number, intro, unnumbered) {
  const id = slugHeading(title);
  return `<section class="chapter-opener${unnumbered ? " unnumbered-opener" : ""}"><div class="chapter-number">${escapeHtmlText(number)}</div><h1 id="${escapeHtmlAttribute(id)}">${escapeHtmlText(title)}</h1><p class="chapter-intro">${intro}</p></section>`;
}

function partDivider(number, name, description) {
  return `<section class="part-divider no-running"><div class="part-number">${escapeHtmlText(number)}</div><h1 id="${escapeHtmlAttribute(slugHeading(`${number} ${name}`))}">${escapeHtmlText(name)}</h1><p>${escapeHtmlText(description)}</p></section>`;
}

function collectTocEntries(text) {
  const entries = [];
  const re = /<section class="part-divider[^>]*>[\s\S]*?<div class="part-number">([^<]+)<\/div><h1[^>]*>([^<]+)<\/h1>|<section class="chapter-opener[^>]*>[\s\S]*?<h1[^>]*>([^<]+)<\/h1>/g;
  let match;
  while ((match = re.exec(text))) {
    if (match[1]) entries.push({ title: `${match[1]} — ${match[2]}`, label: `${match[1]} — ${match[2]}`, type: "part", target: slugHeading(`${match[1]} ${match[2]}`) });
    else entries.push({ title: match[3], label: match[3], type: "chapter", target: slugHeading(match[3]) });
  }
  return entries;
}

function styleCallouts(html) {
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (all, content) => {
    const plain = content.replace(/<[^>]+>/g, " ");
    let cls = "repository-note";
    if (/Production safety|never use|must never|prohibited/i.test(plain)) cls = "warning";
    else if (/Engineering principle|AI operating rule/i.test(plain)) cls = "engineering-principle";
    else if (/Important/i.test(plain)) cls = "important";
    return `<blockquote class="${cls}">${content}</blockquote>`;
  });
}

function styleChecklists(html) {
  html = html.replace(/<li>\[ \] /g, '<li class="task-list-item"><span class="task-box"></span>');
  const major = [
    "before-writing-a-codex-prompt", "reviewing-codex-output", "compact-security-invariants",
    "testing-focused-definition-of-done", "operational-release-checklist", "appendix-c-feature-completion-checklist",
  ];
  for (const id of major) {
    const re = new RegExp(`(<h2 id="${id}"[^>]*>[\\s\\S]*?<\\/h2>)(<ol|<ul)([\\s\\S]*?<\\/(?:ol|ul)>)`);
    html = html.replace(re, `$1<div class="major-checklist"><$2$3</div>`);
  }
  html = html.replace(/(<section class="chapter-opener"[^>]*>[\s\S]*?<h1 id="definition-of-done"[\s\S]*?<\/section>)(<ul[\s\S]*?<\/ul>)/,
    '$1<div class="major-checklist definition-of-done">$2</div>');
  return html;
}

async function printPdf(sourceHtml, output) {
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${sourceHtml}`, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    await page.pdf({ path: output, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, outline: true });
  } finally { await browser.close(); }
}

async function readOutlinePageMap(pdfPath, entries) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await fs.readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise;
  const outline = await doc.getOutline() || [];
  const outlineEntries = [];
  async function walk(items) {
    for (const item of items) {
      try {
        const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
        if (dest?.[0]) outlineEntries.push({ title: item.title.trim(), page: (await doc.getPageIndex(dest[0])) + 1 });
      } catch { /* bookmark remains optional */ }
      if (item.items?.length) await walk(item.items);
    }
  }
  await walk(outline);
  const map = new Map();
  for (const entry of entries) {
    const expected = normaliseTitle(entry.type === "part" ? entry.label.replace(/^Part I{1,3} — /, "") : entry.title);
    const exact = outlineEntries.find((candidate) => normaliseTitle(candidate.title) === expected);
    const fuzzy = outlineEntries.find((candidate) => {
      const actual = normaliseTitle(candidate.title);
      return actual.includes(expected) || expected.includes(actual);
    });
    const match = exact || fuzzy;
    if (match) map.set(entry.title, match.page);
  }
  return map;
}

async function applyMetadata(input, output) {
  const pdf = await PDFDocument.load(await fs.readFile(input));
  pdf.setTitle("TaskManager Engineering Playbook");
  pdf.setSubject("Repository-First Software Engineering");
  pdf.setAuthor("TaskManager Project");
  pdf.setKeywords(["TaskManager", "Engineering", "Architecture", "Documentation", "Repository First", "AI Collaboration", "Security", "Testing", "Repository Edition", "Version 2.0", "Publication Draft 1"]);
  pdf.setProducer("TaskManager repository publication pipeline");
  pdf.setCreator("TaskManager Project");
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());
  await fs.writeFile(output, await pdf.save({ useObjectStreams: false }));
}

async function writeDiagrams() {
  const diagrams = {
    "documentation-hierarchy.svg": verticalDiagram(["README", "Architecture", "Security · Testing · Subsystems", "ADRs", "Project Playbook", "Engineering Playbook snapshot"], "Reading progression — repository implementation remains authoritative"),
    "architecture-overview.svg": architectureDiagram(),
    "verification-layers.svg": horizontalDiagram(["Logic", "Service", "Route", "Manual workflow", "Real device", "Deployment smoke"]),
    "migration-lifecycle.svg": horizontalDiagram(["Intent", "Schema", "Migration", "Review", "Safe test", "Deploy", "Verify"]),
    "development-workflow.svg": workflowDiagram(),
  };
  for (const [name, svg] of Object.entries(diagrams)) await fs.writeFile(path.join(diagramsDir, name), svg);
}

function svgFrame(content, width = 960, height = 520) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#52758d"/></marker></defs><rect width="100%" height="100%" fill="#fff"/><style>text{font-family:Inter,Arial,sans-serif;fill:#202833}.label{font-size:18px;font-weight:600}.small{font-size:14px;fill:#687481}.node{fill:#eef4f8;stroke:#174f78;stroke-width:2}.runtime{fill:#eaf2f7;stroke:#174f78;stroke-width:2}.govern{fill:#f2f3f4;stroke:#687481;stroke-width:2;stroke-dasharray:7 5}.arrow{stroke:#52758d;stroke-width:2;fill:none;marker-end:url(#arrow)}</style>${content}</svg>`;
}

function verticalDiagram(labels, note) {
  const nodes = labels.map((label, i) => `<rect class="node" x="255" y="${25 + i * 66}" rx="8" width="450" height="46"/><text class="label" x="480" y="${54 + i * 66}" text-anchor="middle">${escapeXml(label)}</text>${i < labels.length - 1 ? `<path class="arrow" d="M480 ${71 + i * 66}V${88 + i * 66}"/>` : ""}`).join("");
  return svgFrame(`${nodes}<text class="small" x="480" y="445" text-anchor="middle">${escapeXml(note)}</text>`, 960, 470);
}

function horizontalDiagram(labels) {
  const width = 980, gap = 12, nodeWidth = (width - 80 - gap * (labels.length - 1)) / labels.length;
  const nodes = labels.map((label, i) => { const x = 40 + i * (nodeWidth + gap); return `<rect class="node" x="${x}" y="75" rx="8" width="${nodeWidth}" height="70"/><text class="label" x="${x + nodeWidth / 2}" y="116" text-anchor="middle">${escapeXml(label)}</text>${i < labels.length - 1 ? `<path class="arrow" d="M${x + nodeWidth} 110H${x + nodeWidth + gap - 3}"/>` : ""}`; }).join("");
  return svgFrame(nodes, width, 220);
}

function architectureDiagram() {
  return svgFrame(`
    <rect class="runtime" x="55" y="52" rx="8" width="190" height="58"/><text class="label" x="150" y="87" text-anchor="middle">Browser / PWA</text>
    <rect class="runtime" x="315" y="52" rx="8" width="220" height="58"/><text class="label" x="425" y="87" text-anchor="middle">Next.js App Router</text>
    <rect class="runtime" x="605" y="28" rx="8" width="250" height="50"/><text class="label" x="730" y="59" text-anchor="middle">Server Components</text>
    <rect class="runtime" x="605" y="95" rx="8" width="250" height="50"/><text class="label" x="730" y="126" text-anchor="middle">API Routes / Actions</text>
    <rect class="runtime" x="605" y="190" rx="8" width="250" height="58"/><text class="label" x="730" y="225" text-anchor="middle">Shared Server Services</text>
    <rect class="runtime" x="315" y="190" rx="8" width="220" height="58"/><text class="label" x="425" y="225" text-anchor="middle">Prisma Client</text>
    <rect class="runtime" x="315" y="315" rx="8" width="220" height="58"/><text class="label" x="425" y="350" text-anchor="middle">Railway MariaDB</text>
    <rect class="runtime" x="605" y="315" rx="8" width="250" height="58"/><text class="label" x="730" y="350" text-anchor="middle">Web Push / Service Worker</text>
    <rect class="govern" x="55" y="315" rx="8" width="190" height="58"/><text class="label" x="150" y="342" text-anchor="middle">Repository</text><text class="small" x="150" y="361" text-anchor="middle">governance, not runtime</text>
    <path class="arrow" d="M245 81H310"/><path class="arrow" d="M535 69H600"/><path class="arrow" d="M535 95H600"/><path class="arrow" d="M730 145V185"/><path class="arrow" d="M605 219H540"/><path class="arrow" d="M425 248V310"/><path class="arrow" d="M730 248V310"/><path class="arrow" d="M605 344H540"/><path class="arrow" stroke-dasharray="7 5" d="M245 344H300V235H310"/>
  `, 920, 420);
}

function workflowDiagram() {
  const labels = ["Inspect", "Clarify", "Scope", "Review", "Diff", "Automate", "Manual", "Risk", "Docs", "Commit"];
  const nodes = labels.map((label, i) => { const col = i % 5, row = Math.floor(i / 5), x = 35 + col * 180, y = 45 + row * 120; return `<rect class="node" x="${x}" y="${y}" rx="8" width="145" height="55"/><text class="label" x="${x + 72.5}" y="${y + 34}" text-anchor="middle">${i + 1}. ${label}</text>`; }).join("");
  return svgFrame(`${nodes}<path class="arrow" d="M180 72H210M360 72H390M540 72H570M720 72H750M822 100V132H108V165H210M360 192H390M540 192H570M720 192H750"/><path class="arrow" stroke-dasharray="7 5" d="M822 220V270H108V105"/>`, 940, 300);
}

function uniqueSlug(value) { const base = slugHeading(value); const n = slugCounts.get(base) || 0; slugCounts.set(base, n + 1); return n ? `${base}-${n + 1}` : base; }
function normaliseRepoPath(href) { return path.posix.normalize(path.posix.join("docs", href)).replace(/^\.\.\//, ""); }
function normaliseTitle(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function escapeXml(value) { return escapeHtmlText(value); }
