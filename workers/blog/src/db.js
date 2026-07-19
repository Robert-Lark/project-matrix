// Post lifecycle + queries (ADR-0009 §2, §6). Markdown in, cached HTML out,
// revisions on content change, redirects on published-slug change — the
// invariants live here so every route shares them.

import { newId } from "./ids.js";
import { renderMarkdown } from "./render.js";

// Route names a slug may never shadow (ADR-0009 §6).
const RESERVED = new Set([
  "admin", "static", "media", "tag", "series", "preview", "api", "assets",
  "feed", "feed.xml", "rss", "index",
]);

export function validSlug(slug) {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 96 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    !RESERVED.has(slug)
  );
}

function nowIso() {
  return new Date().toISOString();
}

// Injected into the render pipeline so uploaded images get their stored
// dimensions and alt text (render.js rehypeImages).
export function mediaLookup(env) {
  return async (keys) => {
    const marks = keys.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT key, width, height, alt FROM media WHERE key IN (${marks})`,
    )
      .bind(...keys)
      .all();
    return new Map(results.map((row) => [row.key, row]));
  };
}

export async function createPost(env, kind) {
  const id = newId();
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO posts (id, slug, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, `draft-${id}`, kind, now, now)
    .run();
  return id;
}

export async function getPost(env, id) {
  return env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
}

const SAVABLE = new Set([
  "slug", "title", "dek", "body_md", "kind", "tags", "series", "series_part",
  "accent", "header_style", "mood", "link_url", "original_date",
  "cover_media_id", "editor_state",
]);
const CONTENT_FIELDS = new Set([
  "slug", "title", "dek", "body_md", "kind", "tags", "series", "series_part",
  "accent", "header_style", "mood", "link_url", "original_date",
  "cover_media_id",
]);
const REVISION_GAP_MS = 5 * 60 * 1000;

const HEADER_STYLES = new Set(["standard", "display", "photo-hero", "bare"]);
const MOODS = new Set(["default", "quiet", "loud"]);

// Save a whitelisted patch. Returns { ok, updated_at, warnings? } or
// { error }. "Never a lost word" shapes the error model: an invalid
// METADATA field is dropped with a warning — it must never block the body
// from persisting. Rendering happens here so body_html can never drift
// from body_md.
export async function savePost(env, id, patch) {
  const post = await getPost(env, id);
  if (!post) return { error: "not found", status: 404 };

  // Optimistic concurrency: a second tab / another device must not clobber.
  if (
    patch?.expected_updated_at &&
    patch.expected_updated_at !== post.updated_at
  ) {
    return { error: "edited elsewhere", status: 409 };
  }

  const fields = {};
  const warnings = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (SAVABLE.has(key)) fields[key] = value;
  }

  if ("kind" in fields && !["essay", "photo", "note", "link"].includes(fields.kind)) {
    warnings.kind = "unknown kind — kept the old one";
    delete fields.kind;
  }
  // Art direction is curated at the wall, not just in the picker (ADR-0009
  // §4): arbitrary strings would leak into class names and CSS variables.
  if ("header_style" in fields && !HEADER_STYLES.has(fields.header_style)) {
    warnings.header_style = "unknown header treatment — kept the old one";
    delete fields.header_style;
  }
  if ("mood" in fields && !MOODS.has(fields.mood)) {
    warnings.mood = "unknown mood — kept the old one";
    delete fields.mood;
  }
  if ("accent" in fields && fields.accent !== null && !/^#[0-9a-fA-F]{6}$/.test(fields.accent)) {
    warnings.accent = "accent must be a #rrggbb color — kept the old one";
    delete fields.accent;
  }
  if ("link_url" in fields && fields.link_url !== null && !/^https?:\/\//.test(fields.link_url)) {
    warnings.link_url = "link URL must be http(s) — kept the old one";
    delete fields.link_url;
  }
  if (
    "original_date" in fields &&
    fields.original_date !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(fields.original_date)
  ) {
    warnings.original_date = "display date must be YYYY-MM-DD — kept the old one";
    delete fields.original_date;
  }

  if ("slug" in fields && fields.slug !== post.slug) {
    let slugProblem = null;
    if (!validSlug(fields.slug)) slugProblem = "invalid slug — kept the old one";
    else {
      const taken = await env.DB.prepare(
        "SELECT id FROM posts WHERE slug = ? AND id != ?",
      )
        .bind(fields.slug, id)
        .first();
      if (taken) slugProblem = "slug in use — kept the old one";
    }
    if (slugProblem) {
      warnings.slug = slugProblem;
      delete fields.slug;
    } else if (post.published_at) {
      // Any once-published slug 301s forever — including while the post is
      // temporarily unpublished; a slug reclaiming its old name unwinds it.
      await env.DB.prepare("DELETE FROM redirects WHERE from_slug = ?")
        .bind(fields.slug)
        .run();
      await env.DB.prepare(
        `INSERT INTO redirects (from_slug, to_slug, created_at) VALUES (?, ?, ?)
         ON CONFLICT (from_slug) DO UPDATE SET to_slug = excluded.to_slug`,
      )
        .bind(post.slug, fields.slug, nowIso())
        .run();
      await env.DB.prepare("UPDATE redirects SET to_slug = ? WHERE to_slug = ?")
        .bind(fields.slug, post.slug)
        .run();
    }
  }

  let tags = null;
  if ("tags" in fields) {
    tags = Array.isArray(fields.tags)
      ? fields.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [];
    fields.tags = JSON.stringify([...new Set(tags)]);
  }

  const bodyChanged = "body_md" in fields && fields.body_md !== post.body_md;
  if (bodyChanged) {
    fields.body_html = await renderMarkdown(fields.body_md, {
      mediaLookup: mediaLookup(env),
    });
  }

  const contentChanged = Object.keys(fields).some(
    (key) => CONTENT_FIELDS.has(key) && fields[key] !== post[key],
  );
  if (contentChanged) fields.updated_at = nowIso();

  const keys = Object.keys(fields);
  if (keys.length > 0) {
    const assignments = keys.map((k, i) => `${k} = ?${i + 1}`).join(", ");
    await env.DB.prepare(
      `UPDATE posts SET ${assignments} WHERE id = ?${keys.length + 1}`,
    )
      .bind(...keys.map((k) => fields[k]), id)
      .run();
  }

  if (tags !== null) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(id),
      ...[...new Set(tags)].map((tag) =>
        env.DB.prepare("INSERT INTO post_tags (post_id, tag) VALUES (?, ?)").bind(id, tag),
      ),
    ]);
  }

  if (bodyChanged) {
    const latest = await env.DB.prepare(
      "SELECT saved_at FROM revisions WHERE post_id = ? ORDER BY saved_at DESC LIMIT 1",
    )
      .bind(id)
      .first();
    const gapFloor = new Date(Date.now() - REVISION_GAP_MS).toISOString();
    if (!latest || latest.saved_at < gapFloor) {
      await addRevision(env, id, "autosave", fields.title ?? post.title, fields.body_md);
    }
  }

  return {
    ok: true,
    rendered: bodyChanged,
    updated_at: fields.updated_at ?? post.updated_at,
    ...(Object.keys(warnings).length ? { warnings } : {}),
  };
}

export async function listRevisions(env, postId, limit = 50) {
  const { results } = await env.DB.prepare(
    `SELECT id, kind, title, saved_at, length(body_md) AS size
     FROM revisions WHERE post_id = ? ORDER BY saved_at DESC LIMIT ?`,
  )
    .bind(postId, limit)
    .all();
  return results;
}

export async function getRevision(env, postId, revisionId) {
  return env.DB.prepare(
    "SELECT * FROM revisions WHERE id = ? AND post_id = ?",
  )
    .bind(revisionId, postId)
    .first();
}

export async function addRevision(env, postId, kind, title, bodyMd) {
  await env.DB.prepare(
    `INSERT INTO revisions (id, post_id, kind, title, body_md, saved_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(newId(), postId, kind, title ?? "", bodyMd ?? "", nowIso())
    .run();
}

// `at` backdates published_at for scheduled publishing (ADR-0009 addendum):
// the moment the author chose, not the cron tick that executed it. Either
// path consumes any pending schedule.
//
// The instant rule, deliberately (a scheduled re-publish of a post that was
// once published keeps a stale published_at under COALESCE, misfiling it on
// the shelf and in RSS — caught in verify): an explicit `at` WINS, because
// the author picked it in the schedule dialog; a plain manual publish (at
// null) stamps now on a first publish but PRESERVES an existing date, so a
// manual re-publish keeps the post's original publication date. The display
// date is a separate author-owned field (original_date) either way.
export async function publishPost(env, id, { at = null } = {}) {
  const post = await getPost(env, id);
  if (!post) return { error: "not found", status: 404 };
  // The permanent-URL gate lives HERE, not in the editor bundle: the
  // auto-generated draft-<id> slug passes validSlug, so refuse it by shape.
  if (!validSlug(post.slug) || post.slug.startsWith("draft-")) {
    return { error: "set a real slug before publishing", status: 400 };
  }
  const publishedAt = at ?? post.published_at ?? nowIso();
  await env.DB.prepare(
    `UPDATE posts SET status = 'published',
       published_at = ?, updated_at = ?, scheduled_at = NULL
     WHERE id = ?`,
  )
    .bind(publishedAt, nowIso(), id)
    .run();
  await addRevision(env, id, "snapshot", post.title, post.body_md);
  return { ok: true };
}

export async function unpublishPost(env, id) {
  const post = await getPost(env, id);
  if (!post) return { error: "not found", status: 404 };
  // Any pre-publish schedule was consumed or superseded — never let a stale
  // scheduled_at silently re-publish an unpublished post from the cron.
  await env.DB.prepare(
    "UPDATE posts SET status = 'draft', updated_at = ?, scheduled_at = NULL WHERE id = ?",
  )
    .bind(nowIso(), id)
    .run();
  return { ok: true };
}

// ------------------------------------------------ scheduled publishing ----
// The mechanism is a cron trigger calling publishDue (ADR-0009 addendum):
// public queries stay untouched — a scheduled post is an ordinary draft
// until the trigger publishes it through the same publishPost invariants
// (slug gate, snapshot revision, redirect story) a manual publish gets.

export async function schedulePost(env, id, at) {
  const post = await getPost(env, id);
  if (!post) return { error: "not found", status: 404 };
  if (post.status === "published") {
    return { error: "already published", status: 400 };
  }
  // The same permanent-URL gate as publish, enforced when the promise is
  // MADE — a schedule that could never fire is a word-losing surprise.
  if (!validSlug(post.slug) || post.slug.startsWith("draft-")) {
    return { error: "set a real slug before scheduling", status: 400 };
  }
  const when = new Date(at ?? "");
  if (Number.isNaN(when.getTime())) {
    return { error: "publish time must be a valid date", status: 400 };
  }
  const iso = when.toISOString();
  await env.DB.prepare("UPDATE posts SET scheduled_at = ? WHERE id = ?")
    .bind(iso, id)
    .run();
  return { ok: true, scheduled_at: iso };
}

export async function cancelSchedule(env, id) {
  const result = await env.DB.prepare(
    "UPDATE posts SET scheduled_at = NULL WHERE id = ?",
  )
    .bind(id)
    .run();
  if (result.meta.changes === 0) return { error: "not found", status: 404 };
  return { ok: true };
}

// The cron body. A refused publish (the slug was edited back to draft-… or
// went invalid after scheduling) drops the schedule rather than retrying
// forever — the post stays a draft, no words move, and the editor shows it
// unscheduled.
export async function publishDue(env, log = () => {}) {
  const { results } = await env.DB.prepare(
    `SELECT id, scheduled_at FROM posts
     WHERE status = 'draft' AND scheduled_at IS NOT NULL AND scheduled_at <= ?`,
  )
    .bind(nowIso())
    .all();
  let published = 0;
  for (const row of results) {
    const result = await publishPost(env, row.id, { at: row.scheduled_at });
    if (result.ok) {
      published += 1;
      log("scheduled-publish", { id: row.id, at: row.scheduled_at });
    } else {
      await env.DB.prepare("UPDATE posts SET scheduled_at = NULL WHERE id = ?")
        .bind(row.id)
        .run();
      log("scheduled-publish-refused", { id: row.id, error: result.error });
    }
  }
  return published;
}

export async function deletePost(env, id) {
  const post = await getPost(env, id);
  if (!post) return { ok: true };
  await env.DB.batch([
    env.DB.prepare("DELETE FROM revisions WHERE post_id = ?").bind(id),
    env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(id),
    // Redirect rows pointing at this post would be permanent 301→404s.
    env.DB.prepare("DELETE FROM redirects WHERE to_slug = ?").bind(post.slug),
    env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  ]);
  return { ok: true };
}

// Shelf order follows the DISPLAYED date (original_date when set), or the
// year groups would misfile backdated posts.
const SHELF_ORDER = "COALESCE(original_date, published_at) DESC";

export async function listPublished(env, { tag = null, series = null } = {}) {
  if (tag) {
    const { results } = await env.DB.prepare(
      `SELECT p.* FROM posts p
       JOIN post_tags pt ON pt.post_id = p.id AND pt.tag = ?
       WHERE p.status = 'published' ORDER BY ${SHELF_ORDER}`,
    )
      .bind(tag)
      .all();
    return results;
  }
  if (series) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM posts WHERE status = 'published' AND series = ?
       ORDER BY COALESCE(series_part, 0) ASC, published_at ASC`,
    )
      .bind(series)
      .all();
    return results;
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM posts WHERE status = 'published' ORDER BY ${SHELF_ORDER}`,
  ).all();
  return results;
}

export async function getPublishedBySlug(env, slug) {
  return env.DB.prepare(
    "SELECT * FROM posts WHERE slug = ? AND status = 'published'",
  )
    .bind(slug)
    .first();
}

export async function getRedirect(env, slug) {
  return env.DB.prepare("SELECT to_slug FROM redirects WHERE from_slug = ?")
    .bind(slug)
    .first();
}

export async function seriesNeighbors(env, post) {
  if (!post.series) return { prev: null, next: null };
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title, series_part FROM posts
     WHERE status = 'published' AND series = ?
     ORDER BY COALESCE(series_part, 0) ASC, published_at ASC`,
  )
    .bind(post.series)
    .all();
  const at = results.findIndex((p) => p.id === post.id);
  return {
    prev: at > 0 ? results[at - 1] : null,
    next: at >= 0 && at < results.length - 1 ? results[at + 1] : null,
  };
}

export async function listAdmin(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM posts ORDER BY updated_at DESC",
  ).all();
  return results;
}

export async function getMediaById(env, id) {
  return env.DB.prepare("SELECT * FROM media WHERE id = ?").bind(id).first();
}

// The media library (editor follow-up, ADR-0009 addendum): every R2 object
// through its media row, newest first, each carrying where it is used — one
// posts scan in JS beats N LIKE queries at admin-library scale.
export async function listMedia(env) {
  const [media, posts] = await Promise.all([
    env.DB.prepare("SELECT * FROM media ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT id, slug, title, body_md, cover_media_id FROM posts").all(),
  ]);
  return media.results.map((row) => ({
    ...row,
    used_in: posts.results
      .filter(
        (post) =>
          post.body_md.includes(`/blog/media/${row.key}`) ||
          post.cover_media_id === row.id,
      )
      .map((post) => ({ id: post.id, title: post.title || post.slug })),
  }));
}

// Alt lives on the media row and feeds rendering through mediaLookup — but
// body_html is a CACHE, so an alt fix must re-render every post whose body
// references the key or published pages would keep serving the stale alt.
// body_html-only updates: updated_at stays put, so an open editor's
// optimistic-concurrency baseline survives an alt fix elsewhere.
export async function updateMediaAlt(env, id, alt) {
  const row = await getMediaById(env, id);
  if (!row) return { error: "not found", status: 404 };
  await env.DB.prepare("UPDATE media SET alt = ? WHERE id = ?")
    .bind(String(alt ?? ""), id)
    .run();
  const { results } = await env.DB.prepare(
    "SELECT id, body_md FROM posts WHERE body_md LIKE ?",
  )
    .bind(`%/blog/media/${row.key}%`)
    .all();
  for (const post of results) {
    const html = await renderMarkdown(post.body_md, {
      mediaLookup: mediaLookup(env),
    });
    await env.DB.prepare("UPDATE posts SET body_html = ? WHERE id = ?")
      .bind(html, post.id)
      .run();
  }
  return { ok: true, rerendered: results.length };
}

// The contents page's browse block: every published tag and series.
export async function listBrowse(env) {
  const [tags, series] = await Promise.all([
    env.DB.prepare(
      `SELECT pt.tag AS name, COUNT(*) AS n FROM post_tags pt
       JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
       GROUP BY pt.tag ORDER BY n DESC, pt.tag ASC`,
    ).all(),
    env.DB.prepare(
      `SELECT series AS name, COUNT(*) AS n FROM posts
       WHERE status = 'published' AND series IS NOT NULL
       GROUP BY series ORDER BY n DESC, series ASC`,
    ).all(),
  ]);
  return { tags: tags.results, series: series.results };
}

// The zip-of-markdown variant of the export (ADR-0009 §2 recorded
// follow-up): every post as front-matter + body_md, readable anywhere,
// plus the media manifest and redirect map. Revisions stay the JSON
// dump's job — the zip is the CURRENT words in the most portable shape.
function yamlLine(key, value) {
  // JSON scalars are valid YAML scalars; numbers stay bare.
  return `${key}: ${typeof value === "number" ? value : JSON.stringify(value)}`;
}

export function postFrontMatter(post) {
  const tags = JSON.parse(post.tags || "[]");
  const lines = [];
  for (const key of [
    "id", "slug", "kind", "status", "title", "dek", "series", "series_part",
    "accent", "header_style", "mood", "link_url", "cover_media_id",
    "created_at", "updated_at", "published_at", "original_date", "scheduled_at",
  ]) {
    const value = post[key];
    if (value !== null && value !== undefined && value !== "") {
      lines.push(yamlLine(key, value));
    }
  }
  if (tags.length) lines.push(`tags: ${JSON.stringify(tags)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

export async function exportMarkdownEntries(env) {
  const [posts, media, redirects] = await Promise.all([
    env.DB.prepare("SELECT * FROM posts ORDER BY created_at ASC").all(),
    env.DB.prepare("SELECT * FROM media ORDER BY created_at ASC").all(),
    env.DB.prepare("SELECT * FROM redirects").all(),
  ]);
  const entries = posts.results.map((post) => ({
    name: `posts/${post.slug}.md`,
    data: `${postFrontMatter(post)}${post.body_md}${post.body_md.endsWith("\n") || post.body_md === "" ? "" : "\n"}`,
    mtime: new Date(post.updated_at),
  }));
  entries.push({
    name: "media.json",
    data: JSON.stringify(media.results, null, 2),
  });
  entries.push({
    name: "redirects.json",
    data: JSON.stringify(redirects.results, null, 2),
  });
  return entries;
}

export async function exportAll(env) {
  const [posts, revisions, media, redirects] = await Promise.all([
    env.DB.prepare("SELECT * FROM posts ORDER BY created_at ASC").all(),
    env.DB.prepare("SELECT * FROM revisions ORDER BY saved_at ASC").all(),
    env.DB.prepare("SELECT * FROM media ORDER BY created_at ASC").all(),
    env.DB.prepare("SELECT * FROM redirects").all(),
  ]);
  return {
    exported_at: nowIso(),
    format: "pm-blog-export/1",
    posts: posts.results,
    // Every word ever written includes the words since overwritten.
    revisions: revisions.results,
    media: media.results,
    redirects: redirects.results,
  };
}
