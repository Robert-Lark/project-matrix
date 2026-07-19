// Blog plane Worker — ADR-0009. Public reading surface + the CMS, one
// script: the wall (auth.js) decides before any write reaches storage, and
// every route under /blog/admin/* that lacks a session sees only a login
// page. Arrives via pm-front's BLOG binding with the original /blog/* path.

import {
  checkLockout, csrfOk, getSession, login, logout, logoutAll,
} from "./auth.js";
import {
  addRevision, cancelSchedule, createPost, deletePost, exportAll,
  exportMarkdownEntries, getMediaById, getPost, getPublishedBySlug,
  getRedirect, getRevision, listAdmin, listBrowse, listMedia, listPublished,
  listRevisions, mediaLookup, publishDue, publishPost, savePost,
  schedulePost, seriesNeighbors, unpublishPost, updateMediaAlt,
} from "./db.js";
import { imageDimensions } from "./dimensions.js";
import { adminPage, json, notFound, publicPage, seeOther } from "./html.js";
import { newId, newToken } from "./ids.js";
import { renderMarkdown } from "./render.js";
import { zipStore } from "./zip.js";
import { dashboard, editorPage, loginPage } from "./admin/pages.js";
import {
  contentsPage, feedXml, postPage, previewPage,
} from "./public/pages.js";

function log(level, event, fields) {
  const line = JSON.stringify({ level, worker: "pm-blog", event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

// Every type here is one dimensions.js can sniff — an un-sniffed format
// would silently break the zero-CLS-by-construction rule. AVIF joined once
// the ISOBMFF ispe walk landed (dimensions.js).
const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MEDIA_MAX_BYTES = 25 * 1024 * 1024;

// Malformed percent-encoding is a 404, not a 500.
function softDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

async function handlePublic(request, env, url, sub) {
  const origin = url.origin;
  if (sub === "" || sub === "/") {
    const [posts, browse] = await Promise.all([listPublished(env), listBrowse(env)]);
    return publicPage(contentsPage(posts, { origin, browse }));
  }
  if (sub === "/feed.xml") {
    const posts = await listPublished(env);
    return new Response(feedXml(posts, origin), {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (sub.startsWith("/tag/")) {
    const tag = softDecode(sub.slice("/tag/".length));
    if (tag === null) return notFound();
    const posts = await listPublished(env, { tag });
    if (posts.length === 0) return notFound();
    return publicPage(
      contentsPage(posts, { origin, heading: `Tagged “${tag}”`, path: `/blog${sub}` }),
    );
  }
  if (sub.startsWith("/series/")) {
    const series = softDecode(sub.slice("/series/".length));
    if (series === null) return notFound();
    const posts = await listPublished(env, { series });
    if (posts.length === 0) return notFound();
    return publicPage(
      contentsPage(posts, { origin, heading: series, path: `/blog${sub}` }),
    );
  }
  if (sub.startsWith("/media/")) {
    const key = sub.slice("/media/".length);
    const row = await env.DB.prepare("SELECT * FROM media WHERE key = ?")
      .bind(key)
      .first();
    if (!row) return notFound();
    const object = await env.MEDIA.get(key);
    if (!object) return notFound();
    const etag = object.httpEtag;
    // If-None-Match may carry a list and weak validators.
    const inm = (request.headers.get("if-none-match") ?? "")
      .split(",")
      .map((v) => v.trim().replace(/^W\//, ""));
    if (inm.includes(etag) || inm.includes("*")) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    return new Response(object.body, {
      headers: {
        "content-type": row.mime,
        "content-length": String(row.size),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        etag,
      },
    });
  }
  if (sub.startsWith("/preview/")) {
    const token = sub.slice("/preview/".length);
    if (token.length < 20) return notFound();
    const post = await env.DB.prepare("SELECT * FROM posts WHERE preview_token = ?")
      .bind(token)
      .first();
    if (!post) return notFound();
    const cover = post.cover_media_id ? await getMediaById(env, post.cover_media_id) : null;
    return publicPage(previewPage(post, { origin, cover }), {
      headers: { "x-robots-tag": "noindex", "cache-control": "no-store" },
    });
  }
  // Single path segment → a post slug, else a recorded redirect, else 404.
  const slug = sub.slice(1);
  if (slug.includes("/")) return notFound();
  const post = await getPublishedBySlug(env, slug);
  if (post) {
    const [neighbors, cover] = await Promise.all([
      seriesNeighbors(env, post),
      post.cover_media_id ? getMediaById(env, post.cover_media_id) : null,
    ]);
    return publicPage(postPage(post, { origin, neighbors, cover }));
  }
  const redirect = await getRedirect(env, slug);
  if (redirect) {
    return new Response(null, {
      status: 301,
      headers: { location: `/blog/${redirect.to_slug}` },
    });
  }
  return notFound();
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handleAdminApi(request, env, url, sub, session) {
  const method = request.method;

  if (sub === "/api/export" && method === "GET") {
    return json(await exportAll(env), {
      headers: {
        "content-disposition": `attachment; filename="blog-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }

  // The words in their most portable shape: front-matter markdown, one file
  // per post, zipped without compression (zip.js) — a pure read, so GET.
  if (sub === "/api/export.zip" && method === "GET") {
    const bytes = zipStore(await exportMarkdownEntries(env));
    return new Response(bytes, {
      headers: {
        "content-type": "application/zip",
        "content-length": String(bytes.length),
        "content-disposition": `attachment; filename="blog-markdown-${new Date().toISOString().slice(0, 10)}.zip"`,
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
      },
    });
  }

  if (sub === "/api/media" && method === "GET") {
    return json(await listMedia(env));
  }

  const getPostMatch = /^\/api\/posts\/([a-z0-9]+)$/.exec(sub);
  if (getPostMatch && method === "GET") {
    const post = await getPost(env, getPostMatch[1]);
    return post ? json(post) : json({ error: "not found" }, { status: 404 });
  }

  // Reads are covered by the session; every mutation also needs CSRF.
  if (method !== "GET" && !csrfOk(request, session)) {
    return json({ error: "csrf" }, { status: 403 });
  }

  // The live preview IS the publish pipeline: same renderMarkdown, same
  // postPage template, same CSS — a full document for the preview iframe.
  if (sub === "/api/render" && method === "POST") {
    const body = await readJson(request);
    const draft = {
      id: "preview",
      slug: typeof body.slug === "string" && body.slug ? body.slug : "preview",
      kind: ["essay", "photo", "note", "link"].includes(body.kind) ? body.kind : "essay",
      status: "draft",
      title: String(body.title ?? ""),
      dek: String(body.dek ?? ""),
      body_html: await renderMarkdown(String(body.body_md ?? ""), {
        mediaLookup: mediaLookup(env),
      }),
      tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
      series: body.series ?? null,
      accent: body.accent ?? null,
      header_style: String(body.header_style || "standard"),
      mood: String(body.mood || "default"),
      link_url: body.link_url ?? null,
      published_at: new Date().toISOString(),
      original_date: body.original_date ?? null,
    };
    return json({
      html: postPage(draft, { origin: url.origin, neighbors: { prev: null, next: null } }),
    });
  }

  if (sub === "/api/media" && method === "POST") {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "no file" }, { status: 400 });
    }
    const ext = MEDIA_TYPES[file.type];
    if (!ext) return json({ error: "unsupported type" }, { status: 415 });
    if (file.size > MEDIA_MAX_BYTES) {
      return json({ error: "too large" }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dims = imageDimensions(bytes) ?? {};
    const id = newId();
    const key = `${id}.${ext}`;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType: file.type },
    });
    await env.DB.prepare(
      `INSERT INTO media (id, key, filename, mime, size, width, height, alt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id, key, file.name ?? "", file.type, file.size,
        dims.width ?? null, dims.height ?? null,
        String(form.get("alt") ?? ""), new Date().toISOString(),
      )
      .run();
    const alt = String(form.get("alt") ?? "");
    return json({
      id,
      url: `/blog/media/${key}`,
      width: dims.width ?? null,
      height: dims.height ?? null,
      markdown: `![${alt}](/blog/media/${key})`,
    });
  }

  // Alt text is the media row's to own (mediaLookup feeds every render), so
  // fixing it here re-fixes every referencing post's cached body_html.
  const mediaMatch = /^\/api\/media\/([a-z0-9]+)$/.exec(sub);
  if (mediaMatch && method === "PATCH") {
    const body = await readJson(request);
    const result = await updateMediaAlt(env, mediaMatch[1], body.alt);
    return result.ok ? json(result) : json({ error: result.error }, { status: result.status });
  }

  const revMatch = /^\/api\/posts\/([a-z0-9]+)\/revisions$/.exec(sub);
  if (revMatch && method === "GET") {
    return json(await listRevisions(env, revMatch[1]));
  }

  const postMatch = /^\/api\/posts\/([a-z0-9]+)(\/[a-z-]+)?$/.exec(sub);
  if (postMatch) {
    const [, id, action] = postMatch;
    if (action === "/restore" && method === "POST") {
      const body = await readJson(request);
      const revision = await getRevision(env, id, String(body.revision_id ?? ""));
      if (!revision) return json({ error: "not found" }, { status: 404 });
      // Snapshot the CURRENT text before overwriting — the writing since
      // the last autosave revision exists only in posts.body_md, and this
      // is the promise the restore dialog makes.
      const current = await getPost(env, id);
      if (!current) return json({ error: "not found" }, { status: 404 });
      await addRevision(env, id, "snapshot", current.title, current.body_md);
      const result = await savePost(env, id, { body_md: revision.body_md });
      return result.ok
        ? json({ ok: true, body_md: revision.body_md, updated_at: result.updated_at })
        : json({ error: result.error }, { status: result.status });
    }
    if (!action && method === "PUT") {
      const result = await savePost(env, id, await readJson(request));
      return result.ok
        ? json(result)
        : json({ error: result.error }, { status: result.status });
    }
    if (!action && method === "DELETE") {
      return json(await deletePost(env, id));
    }
    if (action === "/publish" && method === "POST") {
      const result = await publishPost(env, id);
      return result.ok
        ? json(result)
        : json({ error: result.error }, { status: result.status });
    }
    if (action === "/unpublish" && method === "POST") {
      return json(await unpublishPost(env, id));
    }
    if (action === "/schedule" && method === "POST") {
      const body = await readJson(request);
      const result = body.cancel
        ? await cancelSchedule(env, id)
        : await schedulePost(env, id, body.at);
      return result.ok
        ? json(result)
        : json({ error: result.error }, { status: result.status });
    }
    if (action === "/preview-token" && method === "POST") {
      const body = await readJson(request);
      const token = body.revoke ? null : newToken();
      const result = await env.DB.prepare(
        "UPDATE posts SET preview_token = ? WHERE id = ?",
      )
        .bind(token, id)
        .run();
      if (result.meta.changes === 0) {
        return json({ error: "not found" }, { status: 404 });
      }
      return json({ url: token ? `/blog/preview/${token}` : null });
    }
  }

  return json({ error: "not found" }, { status: 404 });
}

async function handleAdmin(request, env, url, sub) {
  // The login endpoint is the only admin route that works without a session.
  if (sub === "/login" && request.method === "POST") {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return adminPage(loginPage({ error: "Cross-origin login refused." }), { status: 403 });
    }
    if (await checkLockout(env, request)) {
      log("info", "login-lockout", {});
      return adminPage(loginPage({ error: "Too many attempts. Try again later." }), { status: 429 });
    }
    const form = await request.formData();
    const result = await login(env, request, String(form.get("credential") ?? ""));
    if (result.locked) {
      return adminPage(loginPage({ error: "Too many attempts. Try again later." }), { status: 429 });
    }
    if (!result.ok) {
      log("info", "login-failed", {});
      return adminPage(loginPage({ error: "That’s not it." }), { status: 403 });
    }
    log("info", "login-ok", {});
    return seeOther("/blog/admin", { "set-cookie": result.setCookie });
  }

  const session = await getSession(env, request);
  if (!session) {
    // One wall for every admin path: a login page and nothing else.
    return adminPage(loginPage(), { status: 401 });
  }

  if (sub === "/logout" && request.method === "POST") {
    const form = await request.formData();
    if (!csrfOk(request, session, String(form.get("csrf") ?? ""))) {
      return adminPage(loginPage(), { status: 403 });
    }
    const clear = await logout(env, request);
    return seeOther("/blog/admin", { "set-cookie": clear });
  }

  if (sub === "/logout-all" && request.method === "POST") {
    const form = await request.formData();
    if (!csrfOk(request, session, String(form.get("csrf") ?? ""))) {
      return adminPage(loginPage(), { status: 403 });
    }
    log("info", "logout-all", {});
    const clear = await logoutAll(env);
    return seeOther("/blog/admin", { "set-cookie": clear });
  }

  if (sub === "" || sub === "/") {
    return adminPage(dashboard({ posts: await listAdmin(env), csrf: session.csrf_token }));
  }

  // Creating a draft is a state change — POST + CSRF, never GET (security
  // floor: no state changes on GET).
  if (sub === "/new" && request.method === "POST") {
    const form = await request.formData();
    if (!csrfOk(request, session, String(form.get("csrf") ?? ""))) {
      return seeOther("/blog/admin");
    }
    const kind = String(form.get("kind") ?? "essay");
    if (!["essay", "photo", "note", "link"].includes(kind)) {
      return seeOther("/blog/admin");
    }
    const id = await createPost(env, kind);
    return seeOther(`/blog/admin/edit/${id}`);
  }

  const edit = /^\/edit\/([a-z0-9]+)$/.exec(sub);
  if (edit) {
    const post = await getPost(env, edit[1]);
    if (!post) return adminPage("<p>No such post. <a href='/blog/admin'>Back</a></p>", { status: 404 });
    return adminPage(editorPage({ post, csrf: session.csrf_token }));
  }

  if (sub.startsWith("/api/")) {
    return handleAdminApi(request, env, url, sub, session);
  }

  return adminPage(`<p>Not found. <a href="/blog/admin">Back to the desk</a></p>`, { status: 404 });
}

export default {
  // The scheduled-publishing tick (ADR-0009 addendum; crons in
  // wrangler.jsonc). publishDue owns the invariants; this stays a shim.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      publishDue(env, (eventName, fields) => log("info", eventName, fields)),
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    // Exactly /blog or /blog/* — "/blogfoo" is not this plane's traffic.
    if (url.pathname !== "/blog" && !url.pathname.startsWith("/blog/")) {
      return notFound();
    }
    const path = url.pathname.slice("/blog".length);

    try {
      // Static bytes — explicit delegation, the script stays the wall for
      // everything routed (run_worker_first). The public css/fonts and the
      // login page's admin.css are world-readable; the EDITOR bundle sits
      // behind the session like every other admin surface.
      if (path.startsWith("/admin/static/editor/")) {
        const session = await getSession(env, request, { renew: false });
        if (!session) return adminPage(loginPage(), { status: 401 });
        return env.ASSETS.fetch(request);
      }
      if (path.startsWith("/static/") || path.startsWith("/admin/static/")) {
        return env.ASSETS.fetch(request);
      }
      if (path === "/admin" || path.startsWith("/admin/")) {
        const sub = path.slice("/admin".length);
        const response = await handleAdmin(request, env, url, sub);
        log("info", "admin", { path: url.pathname, status: response.status });
        return response;
      }
      const response = await handlePublic(request, env, url, path);
      log("info", "serve", { path: url.pathname, status: response.status });
      return response;
    } catch (err) {
      // Generic message out; details stay server-side (security.md).
      log("error", "unhandled", {
        path: url.pathname,
        message: err.message,
        stack: err.stack,
      });
      return publicPage("<h1>Something broke on our side.</h1>", { status: 500 });
    }
  },
};
