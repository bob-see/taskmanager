import assert from "node:assert/strict";
import test from "node:test";

import {
  escapeHtmlAttribute,
  escapeHtmlText,
  renderRepositoryLink,
  renderToc,
  slugHeading,
} from "../docs/publication/scripts/playbook-html.mjs";

test("HTML text and attribute contexts use distinct escaping", () => {
  const value = `double " single ' ampersand & angles < >`;

  assert.equal(
    escapeHtmlText(value),
    `double " single ' ampersand &amp; angles &lt; &gt;`,
  );
  assert.equal(
    escapeHtmlAttribute(value),
    "double &quot; single &#39; ampersand &amp; angles &lt; &gt;",
  );
  assert.equal(escapeHtmlAttribute("D’Arcy, Māori & 日本語"), "D’Arcy, Māori &amp; 日本語");
});

test("TOC attributes cannot be broken by derived heading values", () => {
  const html = renderToc([{
    type: `chapter" onclick="alert(1)`,
    target: `testing" onfocus="alert(2)`,
    label: `Testing <script>alert("label")</script> & quality`,
    title: `Testing" data-injected="yes' & <quality>`,
  }]);

  assert.equal((html.match(/<li class=/g) || []).length, 1);
  assert.equal((html.match(/data-toc-title=/g) || []).length, 1);
  assert.doesNotMatch(html, /"\s+(?:onclick|onfocus|data-injected)=/);
  assert.match(html, /class="chapter&quot; onclick=&quot;alert\(1\)"/);
  assert.match(html, /href="#testing&quot; onfocus=&quot;alert\(2\)"/);
  assert.match(html, /Testing &lt;script&gt;alert\("label"\)&lt;\/script&gt; &amp; quality/);
  assert.match(html, /data-toc-title="Testing&quot; data-injected=&quot;yes&#39; &amp; &lt;quality&gt;"/);
});

test("repository links preserve ordinary labels and escape both output contexts", () => {
  const ordinary = renderRepositoryLink("docs/ARCHITECTURE.md", "docs/ARCHITECTURE.md");
  assert.match(ordinary, /<code>docs\/ARCHITECTURE\.md<\/code>/);

  const hostile = renderRepositoryLink(
    `Guide <draft> & "review"`,
    `docs/file" onclick="alert(1)'.md`,
  );
  assert.doesNotMatch(hostile, /"\s+onclick=/);
  assert.match(hostile, /title="Repository path: docs\/file&quot; onclick=&quot;alert\(1\)&#39;\.md"/);
  assert.match(hostile, /<code>Guide &lt;draft&gt; &amp; "review"<\/code>/);
});

test("playbook heading slugs remain stable and attribute-safe", () => {
  assert.equal(slugHeading("7. Testing & Quality"), "7-testing-and-quality");
  assert.equal(slugHeading("Using This Playbook"), "using-this-playbook");
  assert.equal(slugHeading(`D’Arcy <Guide> "Draft"`), "d-arcy-guide-draft");
  assert.match(slugHeading(`heading" onclick="alert(1)`), /^[a-z0-9-]+$/);
});
