// Admin templates. Unauthenticated eyes see loginPage and nothing else —
// no admin markup, no existence disclosure (ADR-0009 §5). The editor page
// is a shell: values are server-rendered, behavior lives in the CM6 bundle
// (static/editor/main.js), and the post JSON rides a non-executable
// application/json block (CSP script-src 'self' untouched).

import { esc } from "../html.js";

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function shell({ title, body, csrf = null, script = null }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  ${csrf ? `<meta name="pm-blog-csrf" content="${esc(csrf)}">` : ""}
  <link rel="stylesheet" href="/blog/admin/static/admin.css">
</head>
<body>
${body}
${script ? `  <script type="module" src="${script}"></script>` : ""}
</body>
</html>
`;
}

export function loginPage({ error = null } = {}) {
  return shell({
    title: "Sign in",
    body: `  <main class="login">
    <form method="post" action="/blog/admin/login">
      <h1>Sign in</h1>
      ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
      <label for="credential">Credential</label>
      <input id="credential" name="credential" type="password"
             autocomplete="current-password" required autofocus>
      <button type="submit">Enter</button>
    </form>
  </main>`,
  });
}

const KINDS = ["essay", "photo", "note", "link"];
const HEADER_STYLES = ["standard", "display", "photo-hero", "bare"];
const MOODS = ["default", "quiet", "loud"];

function kindLabel(kind) {
  return { essay: "Essay", photo: "Photo", note: "Note", link: "Link" }[kind] ?? kind;
}

function rowTitle(post) {
  if (post.title) return post.title;
  const opener = (post.body_md || "").trim().split("\n")[0];
  return opener ? opener.slice(0, 80) : "(untitled)";
}

function wordCount(text) {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return words;
}

function relTime(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 86_400 * 30) return `${Math.round(seconds / 86_400)}d ago`;
  return iso.slice(0, 10);
}

export function dashboard({ posts, csrf }) {
  const drafts = posts.filter((p) => p.status === "draft");
  const published = posts.filter((p) => p.status === "published");
  const current = drafts[0] ?? null;

  const rows = (list) =>
    list
      .map(
        (post) => `        <li class="row row--${esc(post.kind)}">
          <a class="row-title" href="/blog/admin/edit/${esc(post.id)}">${esc(rowTitle(post))}</a>
          <span class="row-meta">
            <span class="pill pill--${esc(post.kind)}">${esc(kindLabel(post.kind))}</span>
            ${wordCount(post.body_md)} words · ${esc(relTime(post.updated_at))}
          </span>
        </li>`,
      )
      .join("\n");

  const continueCard = current
    ? `    <a class="continue" href="/blog/admin/edit/${esc(current.id)}">
      <span class="continue-eyebrow">Continue writing</span>
      <span class="continue-title">${esc(rowTitle(current))}</span>
      <span class="continue-meta">${wordCount(current.body_md)} words · last touched ${esc(relTime(current.updated_at))}</span>
    </a>`
    : "";

  return shell({
    title: "Writing desk",
    csrf,
    body: `  <main class="desk">
    <header class="desk-head">
      <h1>Writing desk</h1>
      <nav class="new-post" aria-label="New post">
${KINDS.map(
  (kind) => `        <form method="post" action="/blog/admin/new">
          <input type="hidden" name="csrf" value="${esc(csrf)}">
          <input type="hidden" name="kind" value="${kind}">
          <button type="submit">+ ${kindLabel(kind)}</button>
        </form>`,
).join("\n")}
      </nav>
      <div class="logout">
        <form method="post" action="/blog/admin/logout">
          <input type="hidden" name="csrf" value="${esc(csrf)}">
          <button type="submit">Sign out</button>
        </form>
        <form method="post" action="/blog/admin/logout-all"
              title="Revoke every session on every device — the stolen-cookie response">
          <input type="hidden" name="csrf" value="${esc(csrf)}">
          <button type="submit">Sign out everywhere</button>
        </form>
      </div>
    </header>
${continueCard}
${drafts.length ? `    <section>\n      <h2>Drafts <span class="count">${drafts.length}</span></h2>\n      <ul class="post-rows">\n${rows(drafts)}\n      </ul>\n    </section>` : ""}
${published.length ? `    <section>\n      <h2>Published <span class="count">${published.length}</span></h2>\n      <ul class="post-rows">\n${rows(published)}\n      </ul>\n    </section>` : ""}
    <footer class="desk-foot">
      <a href="/blog/admin/api/export" download>Export everything</a> ·
      <a href="/blog/">View blog</a> ·
      <a href="/blog/feed.xml">Feed</a>
    </footer>
  </main>`,
  });
}

export function editorPage({ post, csrf }) {
  const tags = JSON.parse(post.tags || "[]").join(", ");
  const published = post.status === "published";
  return shell({
    title: post.title ? `${post.title} — editing` : "New post",
    csrf,
    script: "/blog/admin/static/editor/main.js",
    body: `  <main class="editor" data-post-id="${esc(post.id)}">
    <script type="application/json" id="post-data">${jsonForHtml(post)}</script>
    <header class="editor-top">
      <a class="back" href="/blog/admin" aria-label="Back to the writing desk">←</a>
      <input id="f-title" class="title-input" name="title" value="${esc(post.title)}"
             placeholder="Title" autocomplete="off" aria-label="Post title">
      <span id="word-count" class="word-count" aria-hidden="true"></span>
      <span id="save-state" class="save-state" role="status" aria-live="polite">Saved</span>
      <button id="toggle-preview" type="button" aria-pressed="false" title="⌘E">Preview</button>
      <button id="toggle-meta" type="button" aria-expanded="false" aria-controls="meta-panel" title="⌘,">Settings</button>
      <button id="publish" type="button" class="primary">${published ? "Republish" : "Publish"}</button>
    </header>
    <p id="restore-bar" class="restore-bar" hidden>
      A newer local copy of this draft exists (a crash or lost connection?).
      <button id="restore-local" type="button">Restore it</button>
      <button id="dismiss-restore" type="button">Keep the server version</button>
    </p>
    <div class="editor-split">
      <section class="pane pane-write" aria-label="Markdown editor">
        <div id="cm-host"></div>
      </section>
      <section class="pane pane-preview" hidden aria-label="Live preview">
        <iframe id="preview" title="Live preview — rendered exactly as the blog renders"></iframe>
      </section>
    </div>
    <aside id="meta-panel" class="meta-panel" hidden aria-label="Post settings">
      <form id="meta-form">
        <h2>Post settings</h2>
        <label for="f-slug">Slug <button type="button" id="slug-from-title" class="linkish">from title</button></label>
        <input id="f-slug" name="slug" value="${esc(post.slug)}" autocomplete="off"
               pattern="[a-z0-9]+(-[a-z0-9]+)*" spellcheck="false">
        <p class="hint">URL: /blog/<span id="slug-echo">${esc(post.slug)}</span> — permanent once published (old slugs 301).</p>
        <label for="f-dek">Dek</label>
        <input id="f-dek" name="dek" value="${esc(post.dek)}" autocomplete="off">
        <label for="f-kind">Kind</label>
        <select id="f-kind" name="kind">
          ${KINDS.map((k) => `<option value="${k}"${post.kind === k ? " selected" : ""}>${kindLabel(k)}</option>`).join("")}
        </select>
        <label for="f-link-url">Link URL <span class="hint-inline">(link posts)</span></label>
        <input id="f-link-url" name="link_url" value="${esc(post.link_url ?? "")}" autocomplete="off" inputmode="url">
        <label for="f-tags">Tags <span class="hint-inline">(comma-separated)</span></label>
        <input id="f-tags" name="tags" value="${esc(tags)}" autocomplete="off">
        <label for="f-series">Series</label>
        <input id="f-series" name="series" value="${esc(post.series ?? "")}" autocomplete="off">
        <label for="f-series-part">Part number</label>
        <input id="f-series-part" name="series_part" value="${esc(post.series_part ?? "")}" inputmode="numeric" autocomplete="off">
        <label for="f-original-date">Display date <span class="hint-inline">(optional, YYYY-MM-DD)</span></label>
        <input id="f-original-date" name="original_date" value="${esc(post.original_date ?? "")}" autocomplete="off" spellcheck="false">

        <h2>Art direction</h2>
        <label for="f-accent">Accent</label>
        <div class="accent-row">
          <input id="f-accent" name="accent" type="color" value="${esc(post.accent || "#0f62fe")}">
          <button type="button" id="clear-accent" class="linkish">none</button>
        </div>
        <label for="f-header-style">Header treatment</label>
        <select id="f-header-style" name="header_style">
          ${HEADER_STYLES.map((h) => `<option value="${h}"${post.header_style === h ? " selected" : ""}>${h}</option>`).join("")}
        </select>
        <label for="f-mood">Mood</label>
        <select id="f-mood" name="mood">
          ${MOODS.map((m) => `<option value="${m}"${post.mood === m ? " selected" : ""}>${m}</option>`).join("")}
        </select>
      </form>

      <section class="panel-block">
        <h2>Preview link</h2>
        <div id="preview-link-zone" data-token="${esc(post.preview_token ?? "")}"></div>
      </section>

      <section class="panel-block">
        <h2>History</h2>
        <ol id="revision-list" class="revision-list"></ol>
      </section>

      <section class="panel-block danger-zone">
        <h2>Danger</h2>
        ${published ? `<button id="unpublish" type="button">Unpublish</button>` : ""}
        <button id="delete-post" type="button">Delete post</button>
      </section>
    </aside>
  </main>`,
  });
}
