// The writing surface (ADR-0009 §3). Contracts this file keeps:
// - never lose a word: dirty-tracked autosave (idle + heartbeat + hidden-tab
//   flush with keepalive) AND a localStorage mirror consulted on boot;
// - the preview IS the blog: the iframe shows /api/render's full document —
//   the same pipeline and template the public page uses;
// - keyboard-first: ⌘S save, ⌘E preview, ⌘, settings, ⌘⇧M media library,
//   ⌘B/I/K markdown, slash-commands at line start, paste/drop image upload.

import { EditorView, keymap, placeholder, drawSelection } from "@codemirror/view";
import { EditorState, EditorSelection } from "@codemirror/state";
import {
  defaultKeymap, history, historyKeymap, indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { autocompletion } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";

const root = document.querySelector("main.editor");
const post = JSON.parse(document.getElementById("post-data").textContent);
const csrf = document.querySelector('meta[name="pm-blog-csrf"]').content;
const postId = root.dataset.postId;

const el = (id) => document.getElementById(id);
const saveState = el("save-state");
const wordCountEl = el("word-count");
const metaForm = el("meta-form");
const previewFrame = el("preview");
const previewPane = document.querySelector(".pane-preview");

const api = (path, options = {}) =>
  fetch(path, {
    ...options,
    headers: {
      "x-pm-blog-csrf": csrf,
      ...(options.body && typeof options.body === "string"
        ? { "content-type": "application/json" }
        : {}),
      ...(options.headers ?? {}),
    },
  });

// ---------------------------------------------------------------- fields --
function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 96);
}

function fields() {
  const data = Object.fromEntries(new FormData(metaForm));
  data.title = el("f-title").value;
  data.body_md = view.state.doc.toString();
  data.tags = (data.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  for (const key of ["series", "link_url", "original_date"]) {
    if (!data[key]) data[key] = null;
  }
  data.series_part = data.series_part ? Number(data.series_part) : null;
  if (accentCleared) data.accent = null;
  data.editor_state = JSON.stringify({
    anchor: view.state.selection.main.anchor,
    scroll: view.scrollDOM.scrollTop,
  });
  return data;
}

// ----------------------------------------------------------------- saving --
let dirty = false;
let idleTimer = null;
let accentCleared = !post.accent;
// Optimistic concurrency baseline — the server refuses saves whose base is
// stale (another tab / another device), so nothing silently clobbers.
let knownUpdatedAt = post.updated_at;
let savePromise = null;

function markDirty() {
  dirty = true;
  saveState.textContent = "Unsaved";
  clearTimeout(idleTimer);
  idleTimer = setTimeout(save, 1500);
  mirror();
  schedulePreview();
  updateWordCount();
}

async function saveOnce({ keepalive = false } = {}) {
  dirty = false;
  saveState.textContent = "Saving…";
  try {
    const res = await api(`/blog/admin/api/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify({ ...fields(), expected_updated_at: knownUpdatedAt }),
      keepalive,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      dirty = true;
      saveState.textContent = "Edited elsewhere — copy anything unsaved, then reload.";
      return false;
    }
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    knownUpdatedAt = data.updated_at ?? knownUpdatedAt;
    const warning = data.warnings && Object.values(data.warnings)[0];
    saveState.textContent = warning ? `Saved · ${warning}` : "Saved";
    localStorage.setItem(mirrorKey, JSON.stringify({ t: Date.now(), saved: true }));
    return true;
  } catch (err) {
    dirty = true;
    saveState.textContent = `Save failed — retrying (${err.message})`;
    return false;
  }
}

// One save at a time, and success means THE LATEST TEXT persisted: callers
// (Publish, ⌘S) share the in-flight run, which loops while more edits
// arrived mid-save.
function save(options) {
  savePromise ??= (async () => {
    try {
      let ok = true;
      while (dirty && ok) ok = await saveOnce(options);
      return ok;
    } finally {
      savePromise = null;
    }
  })();
  return savePromise;
}

setInterval(() => {
  if (dirty) save();
}, 15000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && dirty) save({ keepalive: true });
});
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    // The mirror is the unload-proof net (fetch keepalive caps at 64 KiB
    // and may not finish): write it SYNCHRONOUSLY before anything else.
    try {
      localStorage.setItem(
        mirrorKey,
        JSON.stringify({ t: Date.now(), body: view.state.doc.toString(), title: el("f-title").value }),
      );
    } catch {
      /* quota */
    }
    save({ keepalive: true });
    event.preventDefault();
  }
});

// ----------------------------------------------------- crash-safe mirror --
const mirrorKey = `pm-blog-mirror-${postId}`;
let mirrorTimer = null;
function mirror() {
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        mirrorKey,
        JSON.stringify({ t: Date.now(), body: view.state.doc.toString(), title: el("f-title").value }),
      );
    } catch {
      /* quota — the server autosave is still the net */
    }
  }, 800);
}

function offerRestore() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(mirrorKey) ?? "null");
  } catch {
    return;
  }
  if (!stored?.body || stored.saved) return;
  const serverTime = new Date(post.updated_at).getTime();
  if (stored.t > serverTime + 3000 && stored.body !== post.body_md) {
    const bar = el("restore-bar");
    bar.hidden = false;
    el("restore-local").addEventListener("click", () => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: stored.body },
      });
      if (stored.title) el("f-title").value = stored.title;
      bar.hidden = true;
      markDirty();
    });
    el("dismiss-restore").addEventListener("click", () => {
      localStorage.removeItem(mirrorKey);
      bar.hidden = true;
    });
  }
}

// ------------------------------------------------------------- word count --
function updateWordCount() {
  const words = view.state.doc.toString().trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 230));
  wordCountEl.textContent = words ? `${words.toLocaleString()} words · ${minutes} min` : "";
}

// ---------------------------------------------------------------- upload --
async function uploadFiles(files, view) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const token = `uploading-${Math.random().toString(36).slice(2, 8)}`;
    const placeholderText = `![Uploading ${file.name}…](${token})`;
    view.dispatch(view.state.replaceSelection(`${placeholderText}\n`));
    const form = new FormData();
    form.append("file", file, file.name);
    try {
      const res = await api("/blog/admin/api/media", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? res.status);
      const media = await res.json();
      replaceOnce(view, placeholderText, media.markdown);
    } catch (err) {
      replaceOnce(view, placeholderText, "");
      saveState.textContent = `Upload failed: ${err.message}`;
    }
  }
}

function replaceOnce(view, needle, replacement) {
  const doc = view.state.doc.toString();
  const at = doc.indexOf(needle);
  if (at === -1) return;
  view.dispatch({ changes: { from: at, to: at + needle.length, insert: replacement } });
}

// --------------------------------------------------------- slash commands --
function template(view, from, to, text, cursorFromEnd = 0) {
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.cursor(from + text.length - cursorFromEnd),
  });
  view.focus();
}

const SLASH = [
  { label: "/aside", detail: "margin note", apply: (v, _c, f, t) => template(v, f, t, ":::aside\n\n:::\n", 5) },
  { label: "/pullquote", detail: "lifted line", apply: (v, _c, f, t) => template(v, f, t, ":::pullquote\n\n:::\n", 5) },
  { label: "/gallery", detail: "image grid", apply: (v, _c, f, t) => template(v, f, t, ":::gallery{layout=grid}\n\n:::\n", 5) },
  { label: "/wide", detail: "wide block", apply: (v, _c, f, t) => template(v, f, t, ":::wide\n\n:::\n", 5) },
  { label: "/bleed", detail: "full-bleed block", apply: (v, _c, f, t) => template(v, f, t, ":::bleed\n\n:::\n", 5) },
  { label: "/code", detail: "code block", apply: (v, _c, f, t) => template(v, f, t, "```js\n\n```\n", 5) },
  { label: "/image", detail: "upload an image", apply: (v, _c, f, t) => { template(v, f, t, ""); el("file-input").click(); } },
  { label: "/footnote", detail: "reference + note", apply: (v, _c, f, t) => {
      const n = (v.state.doc.toString().match(/\[\^\d+\]:/g)?.length ?? 0) + 1;
      template(v, f, t, `[^${n}]`);
      const end = v.state.doc.length;
      v.dispatch({ changes: { from: end, to: end, insert: `\n[^${n}]: ` } });
    } },
  { label: "/hr", detail: "divider", apply: (v, _c, f, t) => template(v, f, t, "---\n") },
  { label: "/table", detail: "table", apply: (v, _c, f, t) => template(v, f, t, "| Col | Col |\n| --- | --- |\n|  |  |\n") },
];

function slashSource(context) {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  if (!/^\/[\w-]*$/.test(before)) return null;
  return {
    from: line.from,
    options: SLASH.map((cmd) => ({
      label: cmd.label,
      detail: cmd.detail,
      apply: (v, c, f, t) => cmd.apply(v, c, f, t),
    })),
    validFor: /^\/[\w-]*$/,
  };
}

// ------------------------------------------------------- inline formatting --
function wrapSelection(view, mark, endMark = mark) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: `${mark}${selected}${endMark}` },
    selection: selected
      ? EditorSelection.range(range.from, range.to + mark.length + endMark.length)
      : EditorSelection.cursor(range.from + mark.length),
  });
  return true;
}

function insertLink(view) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to) || "text";
  const text = `[${selected}](url)`;
  const urlStart = range.from + selected.length + 3;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: EditorSelection.range(urlStart, urlStart + 3),
  });
  return true;
}

// ----------------------------------------------------------------- theme --
const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.5em", fontWeight: "700" },
  { tag: tags.heading2, fontSize: "1.25em", fontWeight: "700" },
  { tag: tags.heading3, fontSize: "1.1em", fontWeight: "700" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--accent-ui)" },
  { tag: tags.url, color: "var(--faint)" },
  { tag: tags.quote, color: "var(--faint)" },
  { tag: tags.monospace, fontFamily: "var(--mono)", fontSize: "0.9em" },
  { tag: tags.meta, color: "var(--faint)" },
  { tag: tags.processingInstruction, color: "var(--faint)" },
  { tag: tags.labelName, color: "var(--accent-ui)" },
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "17px" },
  ".cm-scroller": {
    fontFamily: "var(--prose)",
    lineHeight: "1.7",
    padding: "2.5rem 0 50vh",
  },
  ".cm-content": {
    maxWidth: "42rem",
    margin: "0 auto",
    padding: "0 1.25rem",
    caretColor: "var(--accent-ui)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftWidth: "2px" },
  // Autocomplete (slash menu) — themed here because CM's injected styles
  // outrank admin.css in the cascade.
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--line)",
    background: "var(--pane)",
    borderRadius: "8px",
    overflow: "hidden",
    fontFamily: "var(--ui)",
    fontSize: "13px",
  },
  ".cm-tooltip-autocomplete ul li": { padding: "4px 8px" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    background: "var(--accent-ui)",
    color: "var(--paper)",
  },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
  ".cm-completionDetail": { fontStyle: "normal", opacity: "0.6", marginLeft: "0.75em" },
});

// ------------------------------------------------------------------ view --
const view = new EditorView({
  parent: el("cm-host"),
  state: EditorState.create({
    doc: post.body_md,
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(mdHighlight),
      editorTheme,
      placeholder("Write. / at a line start for blocks; drop or paste images."),
      autocompletion({ override: [slashSource], icons: false }),
      highlightSelectionMatches(),
      keymap.of([
        { key: "Mod-b", run: (v) => wrapSelection(v, "**") },
        { key: "Mod-i", run: (v) => wrapSelection(v, "*") },
        { key: "Mod-k", run: insertLink },
        { key: "Mod-s", run: () => { dirty = true; save(); return true; } },
        { key: "Mod-e", run: () => { togglePreview(); return true; } },
        ...markdownKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) markDirty();
      }),
      EditorView.domEventHandlers({
        paste: (event, v) => {
          const files = [...(event.clipboardData?.files ?? [])];
          if (files.length) {
            event.preventDefault();
            uploadFiles(files, v);
            return true;
          }
          return false;
        },
        drop: (event, v) => {
          const files = [...(event.dataTransfer?.files ?? [])];
          if (files.length) {
            event.preventDefault();
            uploadFiles(files, v);
            return true;
          }
          return false;
        },
      }),
    ],
  }),
});

// Hidden file input for /image and future toolbar use.
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/*";
fileInput.multiple = true;
fileInput.hidden = true;
fileInput.id = "file-input";
document.body.append(fileInput);
fileInput.addEventListener("change", () => {
  uploadFiles([...fileInput.files], view);
  fileInput.value = "";
});

// Restore cursor/scroll (drafts-over-days re-entry).
try {
  const state = JSON.parse(post.editor_state ?? "null");
  if (state?.anchor != null && state.anchor <= view.state.doc.length) {
    view.dispatch({ selection: EditorSelection.cursor(state.anchor), scrollIntoView: true });
    if (state.scroll) view.scrollDOM.scrollTop = state.scroll;
  }
} catch {
  /* fresh start */
}
view.focus();
updateWordCount();
offerRestore();

// The settings drawer opens below the header; publish this height as a CSS
// var so its content never tucks under the top bar (see .meta-panel).
const editorTop = document.querySelector(".editor-top");
const syncTopHeight = () =>
  document.documentElement.style.setProperty("--top-h", `${editorTop.offsetHeight}px`);
syncTopHeight();
new ResizeObserver(syncTopHeight).observe(editorTop);

// ---------------------------------------------------------------- preview --
let previewOn = false;
let previewTimer = null;

function togglePreview() {
  previewOn = !previewOn;
  previewPane.hidden = !previewOn;
  root.classList.toggle("split", previewOn);
  el("toggle-preview").setAttribute("aria-pressed", String(previewOn));
  if (previewOn) renderPreview();
}

async function renderPreview() {
  if (!previewOn) return;
  const res = await api("/blog/admin/api/render", {
    method: "POST",
    body: JSON.stringify(fields()),
  });
  if (!res.ok) return;
  const { html } = await res.json();
  previewFrame.srcdoc = html.replace(
    "<head>",
    `<head><base href="${window.location.origin}/">`,
  );
}

function schedulePreview() {
  if (!previewOn) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 700);
}

el("toggle-preview").addEventListener("click", togglePreview);

// -------------------------------------------------------------- meta panel --
const metaPanel = el("meta-panel");
const metaBackdrop = el("meta-backdrop");
const publishHint = el("publish-hint");
function toggleMeta(force) {
  const show = force ?? metaPanel.hidden;
  metaPanel.hidden = !show;
  metaBackdrop.hidden = !show;
  el("toggle-meta").setAttribute("aria-expanded", String(show));
  if (show) {
    publishHint.hidden = true; // clear stale guidance; the publish flow re-shows it
    el("f-slug").focus();
  } else {
    view.focus();
  }
}
el("toggle-meta").addEventListener("click", () => toggleMeta());
// Light-dismiss: click the dimmed backdrop or the ✕ to close (Escape also works).
metaBackdrop.addEventListener("click", () => toggleMeta(false));
el("close-meta").addEventListener("click", () => toggleMeta(false));
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === ",") {
    event.preventDefault();
    toggleMeta();
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
    event.preventDefault();
    if (!el("media-library").open) openMediaLibrary();
  }
  // The dialog owns Escape while open (native cancel) — don't also fold the
  // settings panel underneath it.
  if (event.key === "Escape" && !metaPanel.hidden && !el("media-library").open) {
    toggleMeta(false);
    view.focus();
  }
});

metaForm.addEventListener("input", markDirty);
el("f-title").addEventListener("input", markDirty);
el("f-slug").addEventListener("input", () => {
  el("slug-echo").textContent = el("f-slug").value;
  publishHint.hidden = true;
});
el("slug-from-title").addEventListener("click", () => {
  el("f-slug").value = slugify(el("f-title").value);
  el("slug-echo").textContent = el("f-slug").value;
  markDirty();
});
el("clear-accent").addEventListener("click", () => {
  accentCleared = true;
  markDirty();
});
el("f-accent").addEventListener("input", () => {
  accentCleared = false;
});

// ---------------------------------------------------------------- publish --
el("publish").addEventListener("click", async () => {
  if (el("f-slug").value.startsWith("draft-")) {
    // Open settings and offer a slug derived from the title, then wait: the
    // slug is the permanent URL, so the author confirms it before publishing.
    toggleMeta(true);
    if (el("f-title").value) {
      el("f-slug").value = slugify(el("f-title").value);
      el("slug-echo").textContent = el("f-slug").value;
      markDirty();
    }
    // The header status is transient (autosave overwrites it) and sits under
    // the drawer — put the guidance where the author is now looking.
    publishHint.textContent = el("f-slug").value
      ? "Check this URL — it’s permanent once published. Then press Publish again."
      : "Give this post a slug (its URL), then press Publish again.";
    publishHint.hidden = false;
    return;
  }
  publishHint.hidden = true;
  dirty = true;
  if (!(await save())) return;
  const res = await api(`/blog/admin/api/posts/${postId}/publish`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    saveState.textContent = data.error ?? `Publish failed (${res.status})`;
    return;
  }
  window.location.reload();
});

el("unpublish")?.addEventListener("click", async () => {
  const res = await api(`/blog/admin/api/posts/${postId}/unpublish`, { method: "POST" });
  if (res.ok) window.location.reload();
});

el("delete-post").addEventListener("click", async () => {
  if (!window.confirm("Delete this post permanently? Revisions go with it.")) return;
  const res = await api(`/blog/admin/api/posts/${postId}`, { method: "DELETE" });
  if (res.ok) {
    localStorage.removeItem(mirrorKey);
    window.location.href = "/blog/admin";
  }
});

// ------------------------------------------------------------ media library --
// Browse everything already in R2 (the media table), insert without
// re-uploading, fix alt after the fact. Inserts use the EMPTY-alt form so
// the library's alt flows through mediaLookup at render time — editing alt
// here re-fixes every referencing post's cached HTML on the server.
const mediaDialog = el("media-library");

function mediaCell(item) {
  const li = document.createElement("li");
  li.className = "media-cell";

  const img = document.createElement("img");
  img.src = `/blog/media/${item.key}`;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  if (item.width) {
    img.width = item.width;
    img.height = item.height;
  }

  const meta = document.createElement("p");
  meta.className = "media-meta";
  const dims = item.width ? `${item.width}×${item.height} · ` : "";
  const used = item.used_in.length
    ? `used in ${item.used_in.length} post${item.used_in.length === 1 ? "" : "s"}`
    : "unused";
  meta.textContent = `${item.filename || item.key} · ${dims}${used}`;
  meta.title = item.used_in.map((post) => post.title).join(", ");

  const altRow = document.createElement("div");
  altRow.className = "media-alt";
  const alt = document.createElement("input");
  alt.value = item.alt;
  alt.placeholder = "Alt text";
  alt.setAttribute("aria-label", `Alt text for ${item.filename || item.key}`);
  const saveAlt = document.createElement("button");
  saveAlt.type = "button";
  saveAlt.textContent = "Save alt";
  saveAlt.addEventListener("click", async () => {
    saveAlt.disabled = true;
    saveAlt.textContent = "Saving…";
    const res = await api(`/blog/admin/api/media/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ alt: alt.value }),
    });
    saveAlt.disabled = false;
    if (res.ok) {
      const { rerendered } = await res.json();
      saveAlt.textContent = rerendered
        ? `Saved · re-rendered ${rerendered} post${rerendered === 1 ? "" : "s"}`
        : "Saved";
    } else {
      saveAlt.textContent = "Failed — retry";
    }
    setTimeout(() => (saveAlt.textContent = "Save alt"), 2500);
  });
  altRow.append(alt, saveAlt);

  const insert = document.createElement("button");
  insert.type = "button";
  insert.className = "media-insert";
  insert.textContent = "Insert";
  insert.addEventListener("click", () => {
    view.dispatch(view.state.replaceSelection(`![](/blog/media/${item.key})\n`));
    mediaDialog.close();
    view.focus();
  });

  li.append(img, meta, altRow, insert);
  return li;
}

async function openMediaLibrary() {
  mediaDialog.showModal();
  const status = el("media-status");
  const grid = el("media-grid");
  grid.replaceChildren();
  status.textContent = "Loading…";
  const res = await api("/blog/admin/api/media");
  if (!res.ok) {
    status.textContent = "Could not load the library.";
    return;
  }
  const items = await res.json();
  status.textContent = items.length
    ? ""
    : "Nothing here yet — paste or drop an image into the editor to upload.";
  for (const item of items) grid.append(mediaCell(item));
}

el("open-media").addEventListener("click", openMediaLibrary);
el("close-media").addEventListener("click", () => mediaDialog.close());
// Light-dismiss fallback where <dialog closedby> is unsupported: a click
// whose coordinates land outside the content box is a backdrop click.
if (!("closedBy" in HTMLDialogElement.prototype)) {
  mediaDialog.addEventListener("click", (event) => {
    if (event.target !== mediaDialog) return;
    const rect = mediaDialog.getBoundingClientRect();
    const inside =
      rect.top <= event.clientY && event.clientY <= rect.bottom &&
      rect.left <= event.clientX && event.clientX <= rect.right;
    if (!inside) mediaDialog.close();
  });
}

// ------------------------------------------------------------------ schedule --
// A scheduled post is a draft carrying its go-live instant; the Worker cron
// publishes it through the same gates as the Publish button (db.js).
const scheduleZone = el("schedule-zone");

function renderSchedule() {
  if (!scheduleZone) return; // published posts carry no schedule block
  const at = scheduleZone.dataset.scheduled;
  scheduleZone.replaceChildren();
  if (at) {
    const line = document.createElement("p");
    line.className = "hint";
    line.textContent = `Publishes ${new Date(at).toLocaleString()} (checked every 5 minutes).`;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel schedule";
    cancel.addEventListener("click", async () => {
      const res = await api(`/blog/admin/api/posts/${postId}/schedule`, {
        method: "POST",
        body: JSON.stringify({ cancel: true }),
      });
      if (res.ok) {
        scheduleZone.dataset.scheduled = "";
        renderSchedule();
      }
    });
    scheduleZone.append(line, cancel);
    return;
  }
  const when = document.createElement("input");
  when.type = "datetime-local";
  when.setAttribute("aria-label", "Publish at");
  const schedule = document.createElement("button");
  schedule.type = "button";
  schedule.textContent = "Schedule";
  const note = document.createElement("p");
  note.className = "hint";
  schedule.addEventListener("click", async () => {
    const chosen = new Date(when.value);
    if (Number.isNaN(chosen.getTime())) {
      note.textContent = "Pick a date and time first.";
      return;
    }
    // Persist the draft first: the server gates on the SAVED slug, and a
    // schedule made against unsaved metadata would be a lie.
    dirty = true;
    if (!(await save())) return;
    const res = await api(`/blog/admin/api/posts/${postId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ at: chosen.toISOString() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      note.textContent = data.error ?? `Scheduling failed (${res.status})`;
      return;
    }
    scheduleZone.dataset.scheduled = data.scheduled_at;
    renderSchedule();
  });
  scheduleZone.append(when, schedule, note);
}
renderSchedule();

// ------------------------------------------------------------ preview link --
function renderPreviewLink() {
  const zone = el("preview-link-zone");
  const token = zone.dataset.token;
  zone.replaceChildren();
  if (token) {
    const url = `${window.location.origin}/blog/preview/${token}`;
    const code = document.createElement("code");
    code.textContent = url;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(url);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1500);
    });
    const revoke = document.createElement("button");
    revoke.type = "button";
    revoke.textContent = "Revoke";
    revoke.addEventListener("click", async () => {
      const res = await api(`/blog/admin/api/posts/${postId}/preview-token`, {
        method: "POST",
        body: JSON.stringify({ revoke: true }),
      });
      if (res.ok) {
        zone.dataset.token = "";
        renderPreviewLink();
      }
    });
    zone.append(code, copy, revoke);
  } else {
    const create = document.createElement("button");
    create.type = "button";
    create.textContent = "Create secret preview link";
    create.addEventListener("click", async () => {
      const res = await api(`/blog/admin/api/posts/${postId}/preview-token`, { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        zone.dataset.token = url.split("/preview/")[1];
        renderPreviewLink();
      }
    });
    zone.append(create);
  }
}
renderPreviewLink();

// ---------------------------------------------------------------- history --
async function loadRevisions() {
  const res = await api(`/blog/admin/api/posts/${postId}/revisions`);
  if (!res.ok) return;
  const revisions = await res.json();
  const list = el("revision-list");
  list.replaceChildren();
  for (const rev of revisions.slice(0, 30)) {
    const li = document.createElement("li");
    const when = new Date(rev.saved_at);
    const label = document.createElement("span");
    label.textContent = `${when.toLocaleString()} · ${rev.kind} · ${rev.size.toLocaleString()} chars`;
    const restore = document.createElement("button");
    restore.type = "button";
    restore.textContent = "Restore";
    restore.addEventListener("click", async () => {
      if (!window.confirm("Replace the current text with this revision? (The current text is snapshotted first.)")) return;
      await save();
      const res = await api(`/blog/admin/api/posts/${postId}/restore`, {
        method: "POST",
        body: JSON.stringify({ revision_id: rev.id }),
      });
      if (res.ok) {
        const { body_md, updated_at } = await res.json();
        knownUpdatedAt = updated_at ?? knownUpdatedAt;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: body_md } });
        dirty = false;
        saveState.textContent = "Restored";
        loadRevisions();
      }
    });
    li.append(label, restore);
    list.append(li);
  }
}
loadRevisions();
