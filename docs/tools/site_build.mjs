#!/usr/bin/env node
/**
 * Build docs/site/index.html: the whole design package rendered as one page for review.
 * Inputs: the Markdown documents in docs/ (order below). Output: docs/site/index.html and a copy of field-matrix.csv.
 * Run from anywhere: node docs/tools/site_build.mjs
 * Diagrams are left as <pre class="mermaid"> blocks; the artifact viewer renders them natively.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Marked } from 'marked';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const DOCS = join(TOOLS, '..');
const OUT = join(DOCS, 'site');

const BRIEF = process.argv.includes('--brief');
const FULL_PACKAGE_URL = 'https://claude.ai/artifact/55fJPFQnnqi8sVVU7FUFcv';
const ORDER = BRIEF ? [
  { file: 'review/decision-brief.md', token: 'brief', label: 'Decision brief', note: 'Ten decisions, fourteen assumptions', group: 'A' },
] : [
  { file: 'README.md', token: 'guide', label: 'Review guide', note: 'Start here', group: 'A' },
  { file: 'review/decision-brief.md', token: 'brief', label: 'Decision brief', note: 'The short version: ten decisions', group: 'A' },
  { file: 'review/annotated-brief.md', token: 'brief', label: 'Your brief, annotated', note: 'Your documents with the findings placed', group: 'A' },
  { file: 'review/redesigned-flowcharts.md', token: 'flowcharts', label: 'Your flowcharts, redrawn', note: 'Gap fills colour-coded', group: 'A' },
  { file: 'review/open-decisions.md', token: 'decisions', label: 'Decisions we need from you', note: '25 questions with answer boxes', group: 'A' },
  { file: 'review/assumptions-taken.md', token: 'assumptions', label: 'Assumptions we took', note: '98 lines to confirm or change', group: 'A' },
  { file: 'decision-log.md', token: 'log', label: 'Decision log', note: "AMPM's answers and their effect", group: 'B' },
  { file: 'requirements-audit.md', token: 'audit', label: 'Requirements audit', note: 'Findings and the 25 questions', group: 'B' },
  { file: 'decision-register.md', token: 'register', label: 'Decision register', note: 'Assumptions by question', group: 'B' },
  { file: 'user-flows.md', token: 'flows', label: 'User flows', note: '12 flows', group: 'B' },
  { file: 'wireframes.md', token: 'wireframes', label: 'Wireframe specifications', note: '124 screens', group: 'B' },
  { file: 'data-model.md', token: 'model', label: 'Data model', note: '106 tables', group: 'B' },
  { file: 'permission-matrix.md', token: 'permissions', label: 'Permission matrix', note: 'Roles and access', group: 'B' },
  { file: 'field-matrix.md', token: 'fields', label: 'Field matrix', note: '1,068 fields', group: 'B' },
  { file: 'architecture.md', token: 'architecture', label: 'Architecture and integration plan', note: 'Technology decisions', group: 'B' },
  { file: 'test-cases.md', token: 'tests', label: 'Test cases', note: '36 criteria', group: 'B' },
];
const GROUPS = BRIEF ? { A: 'For AMPM' } : { A: 'For AMPM to review and decide', B: 'Developer drafts, for reference' };
const LINKMAP = Object.fromEntries(ORDER.map(d => [d.file.split('/').pop(), '#' + d.token]));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => s.replace(/<[^>]+>/g, '');
const slug = s => strip(s).toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Escape "<placeholder>" text outside fenced blocks and code spans so Markdown does not treat it as HTML.
function protectAngles(md) {
  const parts = md.split(/(^```[\s\S]*?^```\s*$)/m);
  return parts.map((chunk, i) => {
    if (i % 2 === 1) return chunk; // fenced block
    return chunk.split('\n').map(line =>
      line.split(/(`[^`]*`)/).map((seg, j) => j % 2 === 1 ? seg : seg.replace(/<(?=[A-Za-z])/g, '&lt;')).join('')
    ).join('\n');
  }).join('');
}

function renderDoc(doc, index) {
  const raw = readFileSync(join(DOCS, doc.file), 'utf8');
  const titleMatch = raw.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/^AMPM Platform — /, '') : doc.label;
  const body = protectAngles(raw.replace(/^# .+\n/m, ''));
  const toc = [];
  const seen = new Set();
  const renderer = new Marked().Renderer ? null : null; // placeholder to keep linters quiet
  const md = new Marked({ gfm: true, breaks: false });
  const R = {
    heading(text, level, rawText) {
      let base = `${doc.token}-${slug(rawText)}`;
      let id = base, n = 2;
      while (seen.has(id)) id = `${base}-${n++}`;
      seen.add(id);
      if (level === 2) toc.push({ id, text: strip(text) });
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    },
    code(code, info) {
      const lang = (info || '').trim().split(/\s+/)[0];
      if (lang === 'mermaid') return `<div class="diagram"><pre class="mermaid">${esc(code)}</pre></div>\n`;
      return `<pre class="code" data-lang="${lang}"><code>${esc(code)}</code></pre>\n`;
    },
    link(href, title, text) {
      let h = href;
      const m = href.match(/^(?:\.\.\/)?(?:review\/)?([a-z0-9-]+\.md)(#.*)?$/i);
      if (m) h = LINKMAP[m[1]] ?? href;
      const ext = /^https?:/.test(h) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${h}"${title ? ` title="${esc(title)}"` : ''}${ext}>${text}</a>`;
    },
    table(header, body) {
      return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
    },
    blockquote(quote) {
      const m = quote.match(/^<p><strong>(GAP|CONFLICT|AMBIGUITY|DECISION|DECIDED|ASSUMED|COVERED|Your decision)/);
      const kind = m ? (m[1] === 'Your decision' ? 'answer' : m[1].toLowerCase()) : 'note';
      return `<blockquote class="callout callout-${kind}">${quote}</blockquote>\n`;
    },
  };
  md.use({ renderer: R });
  const html = md.parse(body);
  const diagrams = (html.match(/<pre class="mermaid">/g) || []).length;
  const tocHtml = toc.map(t => `<li><a href="#${t.id}">${t.text}</a></li>`).join('');
  const section = `
<section class="doc" id="${doc.token}" data-label="${esc(doc.label)}">
  <header class="doc-head">
    <p class="doc-eyebrow"><span class="doc-no">${doc.group}${ORDER.filter(x => x.group === doc.group).indexOf(doc) + 1}</span> ${GROUPS[doc.group]} · ${esc(doc.note)} · <span class="doc-file">${doc.file}</span></p>
    <h1>${esc(title)}</h1>
  </header>
  <div class="doc-body">
${html}
  </div>
</section>`;
  return { section, tocHtml, diagrams, title };
}

const rendered = ORDER.map(renderDoc);
const totalDiagrams = rendered.reduce((a, r) => a + r.diagrams, 0);

let lastGroup = null;
const navHtml = ORDER.map((d, i) => {
  const head = d.group !== lastGroup ? `\n  <li class="nav-group">${GROUPS[d.group]}</li>` : '';
  lastGroup = d.group;
  return head + `
  <li class="nav-doc" data-token="${d.token}">
    <a class="nav-link" href="#${d.token}"><span class="nav-no">${d.group}${String(ORDER.filter(x => x.group === d.group).indexOf(d) + 1)}</span><span class="nav-label">${esc(d.label)}</span><span class="nav-note">${esc(d.note)}</span></a>
    <ul class="nav-sections">${rendered[i].tocHtml}</ul>
  </li>`;
}).join('');

const page = `<title>${BRIEF ? 'AMPM Decision Brief' : 'AMPM Design Package'}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap">
<style>
/* Layout: a reading rail on the left listing the ten documents in review order, each with its sections; the documents
   themselves stacked in that order in one long column, so every diagram is visible at load and every anchor is a plain hash. */
:root {
  --bg: #f8f6fa;          /* cool off-white with a violet bias */
  --surface: #ffffff;
  --fg: #221c2a;
  --muted: #6d6476;
  --accent: #7a1f4f;      /* plum, from the wedding textile palette */
  --accent-ink: #ffffff;
  --line: #e4dfe9;
  --code-bg: #f1edf4;
  --c-gap: #b8860b; --c-conflict: #b9382f; --c-ambiguity: #2f6db5; --c-assumed: #6f5fb3; --c-covered: #2e7d32;
  --font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-body: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #171319; --surface: #211c25; --fg: #ece7f0; --muted: #a89fb2; --accent: #e694c3; --accent-ink: #1d0a14;
    --line: #342d3a; --code-bg: #27212c; color-scheme: dark;
    --c-gap: #e0b24a; --c-conflict: #e2766c; --c-ambiguity: #7fb0ea; --c-assumed: #b1a4e6; --c-covered: #7fc686;
  }
}
:root[data-theme="dark"] {
  --bg: #171319; --surface: #211c25; --fg: #ece7f0; --muted: #a89fb2; --accent: #e694c3; --accent-ink: #1d0a14;
  --line: #342d3a; --code-bg: #27212c; color-scheme: dark;
  --c-gap: #e0b24a; --c-conflict: #e2766c; --c-ambiguity: #7fb0ea; --c-assumed: #b1a4e6; --c-covered: #7fc686;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 16px; line-height: 1.55; margin: 0; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--surface); }
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.topbar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 9; background: var(--surface); border-bottom: 1px solid var(--line); }
.topbar-inner { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 20px; padding-block: 12px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.brand { font-family: var(--font-display); font-weight: 600; font-size: 1.15rem; letter-spacing: 0.01em; margin: 0; }
.status { font-size: 0.85rem; color: var(--muted); margin: 0; }
.status b { color: var(--accent); font-weight: 600; }
.shell { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 40px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 16px 64px; }
@media (min-width: 1000px) { .shell { grid-template-columns: 300px minmax(0, 1fr); } }
.rail { min-width: 0; }
@media (min-width: 1000px) { .rail { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 64px); align-self: start; max-height: calc(100vh - 80px); overflow-y: auto; padding-right: 8px; } }
.rail details > summary { cursor: pointer; font-weight: 600; padding: 8px 0; list-style: none; }
.rail details > summary::-webkit-details-marker { display: none; }
.rail details > summary::before { content: "Contents"; }
@media (min-width: 1000px) { .rail details > summary { display: none; } }
.nav { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.nav-link { display: grid; grid-template-columns: 2.2rem minmax(0, 1fr); grid-template-areas: "no label" "no note"; column-gap: 8px; padding: 8px 10px; border-radius: 6px; text-decoration: none; color: var(--fg); }
.nav-link:hover { background: var(--code-bg); }
.nav-doc.active > .nav-link { background: var(--accent); color: var(--accent-ink); }
.nav-no { grid-area: no; font-family: var(--font-mono); font-size: 0.8rem; color: var(--muted); padding-top: 3px; }
.nav-doc.active .nav-no { color: var(--accent-ink); opacity: 0.8; }
.nav-label { grid-area: label; font-weight: 600; line-height: 1.25; }
.nav-note { grid-area: note; font-size: 0.8rem; color: var(--muted); }
.nav-doc.active .nav-note { color: var(--accent-ink); opacity: 0.85; }
.nav-sections { list-style: none; margin: 0; padding: 2px 0 8px 2.9rem; display: none; }
.nav-doc.active .nav-sections { display: grid; gap: 1px; }
.nav-sections a { display: block; font-size: 0.86rem; color: var(--muted); text-decoration: none; padding: 3px 6px; border-left: 2px solid var(--line); }
.nav-sections a:hover { color: var(--fg); border-left-color: var(--accent); }
main { min-width: 0; }
.doc { padding-block: 24px 48px; border-bottom: 1px solid var(--line); scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 72px); }
.doc-head { margin-bottom: 20px; }
.doc-eyebrow { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 0 0 6px; }
.doc-no { font-family: var(--font-mono); color: var(--accent); letter-spacing: 0; margin-right: 6px; }
.doc-file { text-transform: none; letter-spacing: 0; font-family: var(--font-mono); font-size: 0.78rem; }
.doc h1 { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.7rem, 1.2rem + 1.6vw, 2.4rem); line-height: 1.12; margin: 0; text-wrap: balance; letter-spacing: -0.01em; }
.doc-body h2 { font-family: var(--font-display); font-weight: 600; font-size: 1.45rem; line-height: 1.2; margin: 2.2em 0 0.6em; text-wrap: balance; scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 72px); padding-top: 0.6em; border-top: 1px solid var(--line); }
.doc-body h3 { font-size: 1.12rem; font-weight: 600; margin: 1.8em 0 0.5em; scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 72px); }
.doc-body h4 { font-size: 1rem; font-weight: 600; margin: 1.4em 0 0.4em; color: var(--accent); scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 72px); }
.doc-body p, .doc-body li { max-width: 74ch; }
.doc-body ul, .doc-body ol { padding-left: 1.4em; }
.doc-body li + li { margin-top: 0.25em; }
.doc-body hr { border: 0; border-top: 1px solid var(--line); margin: 2em 0; }
.doc-body strong { font-weight: 600; }
code { font-family: var(--font-mono); font-size: 0.86em; background: var(--code-bg); padding: 0.1em 0.35em; border-radius: 4px; }
pre.code { background: var(--code-bg); border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.4; }
pre.code code { background: none; padding: 0; font-size: inherit; }
.diagram { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 10px; overflow-x: auto; margin: 1em 0; }
.diagram pre.mermaid { margin: 0; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.35; white-space: pre; }
.diagram svg { max-width: 100%; height: auto; }
.table-wrap { overflow-x: auto; margin: 1em 0; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
th { font-weight: 600; background: var(--code-bg); position: sticky; top: 0; }
tbody tr:last-child td { border-bottom: 0; }
td code, th code { white-space: nowrap; }
.callout { border-left: 4px solid var(--line); background: var(--code-bg); padding: 10px 14px; margin: 14px 0; border-radius: 0 6px 6px 0; max-width: 80ch; }
.callout p { margin: 0; max-width: none; }
.callout p + p { margin-top: 6px; }
.callout-gap { border-left-color: var(--c-gap); }
.callout-conflict { border-left-color: var(--c-conflict); }
.callout-ambiguity { border-left-color: var(--c-ambiguity); }
.callout-decision { border-left-color: var(--accent); }
.callout-assumed { border-left-color: var(--c-assumed); }
.callout-covered { border-left-color: var(--c-covered); }
.callout-decided { border-left-color: var(--c-covered); background: color-mix(in srgb, var(--c-covered) 12%, var(--surface)); }
.callout-answer { border: 1px dashed var(--accent); border-left-width: 4px; background: var(--surface); }
.nav-group { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); padding: 14px 10px 4px; }
.foot { color: var(--muted); font-size: 0.85rem; padding-block: 24px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
@media print { .topbar, .rail { display: none; } .shell { display: block; } .doc { break-before: page; } }
</style>

<div class="topbar"><div class="topbar-inner">
  <p class="brand">${BRIEF ? 'AMPM Decision Brief' : 'AMPM Design Package'}</p>
  <p class="status">${BRIEF ? 'AMPM answered on 25 October 2026 · <b>11 points to confirm</b> · <a href="' + FULL_PACKAGE_URL + '" target="_blank" rel="noopener">Full package</a>' : 'Drafts v0.2 with AMPM\'s decisions of 25 October 2026 · <b>Not signed off</b> · ' + ORDER.length + ' documents, ' + totalDiagrams + ' diagrams'}</p>
</div></div>

<div class="shell">
  <aside class="rail">
    <details open>
      <summary></summary>
      <ul class="nav" id="nav">${navHtml}
      </ul>
    </details>
  </aside>
  <main id="main">${rendered.map(r => r.section).join('\n')}
  </main>
</div>
<p class="foot">${BRIEF ? 'A short brief for deciding. The full design package, with every finding and the developer drafts, is at <a href="' + FULL_PACKAGE_URL + '" target="_blank" rel="noopener">' + FULL_PACKAGE_URL + '</a>.' : 'Generated from the Markdown sources in the project\'s docs folder by docs/tools/site_build.mjs. Identifier prefixes are explained in the review guide.'}</p>

<script>
(function () {
  var docs = Array.prototype.slice.call(document.querySelectorAll('.doc'));
  var items = {};
  Array.prototype.forEach.call(document.querySelectorAll('.nav-doc'), function (li) { items[li.getAttribute('data-token')] = li; });
  function setActive(token) {
    Object.keys(items).forEach(function (k) { items[k].classList.toggle('active', k === token); });
  }
  var current = null;
  function update() {
    var marker = (window.innerHeight || 800) * 0.3;
    var pick = docs[0];
    for (var i = 0; i < docs.length; i++) { if (docs[i].getBoundingClientRect().top <= marker) pick = docs[i]; }
    if (pick && pick.id !== current) { current = pick.id; setActive(current); }
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) { setTimeout(function () { target.scrollIntoView(); update(); }, 0); }
  }
  update();
  var details = document.querySelector('.rail details');
  Array.prototype.forEach.call(document.querySelectorAll('.nav a'), function (a) {
    a.addEventListener('click', function () { if (window.innerWidth < 1000 && details) details.open = false; });
  });
})();
</script>
`;

mkdirSync(OUT, { recursive: true });
const outName = BRIEF ? 'brief.html' : 'index.html';
writeFileSync(join(OUT, outName), page, 'utf8');
if (!BRIEF) copyFileSync(join(DOCS, 'field-matrix.csv'), join(OUT, 'field-matrix.csv'));
const size = statSync(join(OUT, outName)).size;
console.log(`wrote site/${outName} (${(size / 1024 / 1024).toFixed(2)} MB), ${ORDER.length} documents, ${totalDiagrams} diagrams`);
rendered.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2, '0')} ${ORDER[i].file}: ${r.diagrams} diagrams, ${(r.section.length / 1024).toFixed(0)} KB`));
