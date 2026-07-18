const HTML_TEXT_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const HTML_ATTRIBUTE_ENTITIES = {
  ...HTML_TEXT_ENTITIES,
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtmlText(value) {
  return String(value).replace(/[&<>]/g, (character) => HTML_TEXT_ENTITIES[character]);
}

export function escapeHtmlAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ATTRIBUTE_ENTITIES[character]);
}

export function slugHeading(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function renderRepositoryLink(label, repositoryPath) {
  return `<span class="repo-link" title="Repository path: ${escapeHtmlAttribute(repositoryPath)}"><code>${escapeHtmlText(label)}</code></span>`;
}

export function renderToc(entries) {
  return `<ol class="toc-list">${entries.map((entry) => `<li class="${escapeHtmlAttribute(entry.type)}"><a href="#${escapeHtmlAttribute(entry.target)}">${escapeHtmlText(entry.label)}</a><span class="toc-dots"></span><span class="toc-page" data-toc-title="${escapeHtmlAttribute(entry.title)}">?</span></li>`).join("\n")}</ol>`;
}
