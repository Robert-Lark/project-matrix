/**
 * Blog plane (ADR-0009) — additive suite file; every store contract lives
 * elsewhere and is untouched. Two layers:
 *
 * 1. Read-only contracts that must hold at ANY origin (local + deployed
 *    smoke): /blog/* dispatches, carries no injected chrome and no /_pm
 *    bytes (the non-contamination fence), the admin is nothing but a
 *    login wall, and the feed answers.
 *
 * 2. The write path — login, autosave, CSRF refusal, publish, public read,
 *    preview link, slug-change redirect, media round-trip — which needs the
 *    fixture credential and therefore runs only where PM_BLOG_CREDENTIAL is
 *    set (run-local.mjs sets it; the post-deploy smoke deliberately does
 *    not, so the suite never writes to production).
 */
import { describe, expect, it } from "vitest";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const CREDENTIAL = process.env.PM_BLOG_CREDENTIAL;

const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);

describe("blog plane: dispatch + non-contamination", () => {
  it("/blog/ serves the contents page through the front Worker", async () => {
    const res = await get("/blog/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Rob Lark");
  });

  it("blog HTML passes through byte-identical (no chrome injection)", async () => {
    // Assert the INJECTION ARTIFACTS (the exact markup the front Worker's
    // HTMLRewriter emits), never bare substrings — a legitimate blog post
    // ABOUT the benchmark may mention '/_pm/' or 'pm-chrome' as prose or
    // code, and markdown cannot produce these raw tags (sanitize strips
    // link/div injection shapes).
    const body = await (await get("/blog/")).text();
    expect(body).not.toContain('<link rel="stylesheet" href="/_pm/chrome.css">');
    expect(body).not.toContain('href="/_pm/fonts/PMInstrumentMono.var.woff2"');
    expect(body).not.toContain('<div id="pm-chrome-slot"');
  });

  it("unknown blog paths 404 without leaking internals", async () => {
    const res = await get("/blog/no-such-post-ever");
    expect(res.status).toBe(404);
  });

  it("prefix matching is exact — /blogfoo is not this plane's traffic", async () => {
    // Through the composed origin /blogfoo is the front Worker's 404; this
    // guards the blog worker's own boundary for direct/preview access.
    const res = await get("/blogfoo");
    expect(res.status).toBe(404);
  });

  it("the editor bundle sits behind the wall", async () => {
    const res = await get("/blog/admin/static/editor/main.js");
    expect(res.status).toBe(401);
    // The login page's stylesheet is the only world-readable admin byte.
    expect((await get("/blog/admin/static/admin.css")).status).toBe(200);
  });

  it("/blog/feed.xml is RSS with a self link", async () => {
    const res = await get("/blog/feed.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const body = await res.text();
    expect(body).toContain("<rss version=\"2.0\"");
    expect(body).toContain("/blog/feed.xml");
  });

  it("the admin is a login wall and nothing else", async () => {
    const res = await get("/blog/admin");
    expect(res.status).toBe(401);
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    const body = await res.text();
    expect(body).toContain("Sign in");
    // No admin markup behind the wall.
    expect(body).not.toContain("Writing desk");
    expect(body).not.toContain("pm-blog-csrf");
  });

  it("admin APIs refuse unauthenticated writes", async () => {
    const res = await get("/blog/admin/api/posts/abc123", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "nope" }),
    });
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!CREDENTIAL)("blog plane: the write path (fixture credential)", () => {
  let cookie = "";
  let csrf = "";
  let postId = "";
  const slug = `suite-post-${Date.now().toString(36)}`;

  const authed = (path: string, init: RequestInit = {}) =>
    get(path, {
      ...init,
      redirect: "manual",
      headers: {
        cookie,
        "x-pm-blog-csrf": csrf,
        ...(init.headers ?? {}),
      },
    });

  it("refuses a wrong credential", async () => {
    const res = await get("/blog/admin/login", {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams({ credential: "not-the-credential" }),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("logs in with the credential and gets a hardened session cookie", async () => {
    const res = await get("/blog/admin/login", {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams({ credential: CREDENTIAL! }),
    });
    expect(res.status).toBe(303);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/blog");
    cookie = setCookie.split(";")[0] ?? "";
    expect(cookie).not.toBe("");
  });

  it("the dashboard carries the CSRF token for this session", async () => {
    const res = await get("/blog/admin", { headers: { cookie } });
    expect(res.status).toBe(200);
    const match = /name="pm-blog-csrf" content="([^"]+)"/.exec(await res.text());
    expect(match).not.toBeNull();
    csrf = match?.[1] ?? "";
    expect(csrf).not.toBe("");
  });

  it("creates a draft (POST — no state change on GET)", async () => {
    const res = await authed("/blog/admin/new", {
      method: "POST",
      body: new URLSearchParams({ csrf, kind: "essay" }),
    });
    expect(res.status).toBe(303);
    postId = res.headers.get("location")?.split("/edit/")[1] ?? "";
    expect(postId.length).toBeGreaterThan(10);
  });

  it("refuses a save without the CSRF header", async () => {
    const res = await get(`/blog/admin/api/posts/${postId}`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "riding" }),
    });
    expect(res.status).toBe(403);
  });

  it("saves markdown and renders it through the one pipeline", async () => {
    const res = await authed(`/blog/admin/api/posts/${postId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Suite post",
        slug,
        dek: "Written by the origin suite.",
        tags: ["suite"],
        body_md:
          "Opening paragraph.\n\n:::pullquote\nThe quote.\n:::\n\n```js\nconst n = 1;\n```\n",
      }),
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
  });

  it("drafts are invisible to the public side", async () => {
    expect((await get(`/blog/${slug}`)).status).toBe(404);
  });

  it("mints a secret preview link that renders the draft", async () => {
    const res = await authed(`/blog/admin/api/posts/${postId}/preview-token`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const preview = await get(url);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("x-robots-tag")).toContain("noindex");
    expect(await preview.text()).toContain("Suite post");
  });

  it("publishes, and the public page serves the rendered post", async () => {
    const res = await authed(`/blog/admin/api/posts/${postId}/publish`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const page = await get(`/blog/${slug}`);
    expect(page.status).toBe(200);
    const body = await page.text();
    expect(body).toContain("Suite post");
    expect(body).toContain("bp-pullquote");
    expect(body).toContain("shiki");
    expect(body).not.toContain("pm-chrome-slot");
  });

  it("the feed carries the full post content", async () => {
    const body = await (await get("/blog/feed.xml")).text();
    expect(body).toContain("Suite post");
    expect(body).toContain("bp-pullquote");
    expect(body).toContain(`/blog/${slug}`);
  });

  it("a published slug change leaves a 301 behind", async () => {
    const moved = `${slug}-moved`;
    const res = await authed(`/blog/admin/api/posts/${postId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: moved }),
    });
    expect(res.status).toBe(200);
    const redirect = await get(`/blog/${slug}`, { redirect: "manual" });
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe(`/blog/${moved}`);
    expect((await get(`/blog/${moved}`)).status).toBe(200);
  });

  it("uploads media into R2 and serves it immutable", async () => {
    // Smallest valid PNG (1×1).
    const png = Uint8Array.from(atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    ), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new File([png], "dot.png", { type: "image/png" }), "dot.png");
    form.append("alt", "a dot");
    const res = await authed("/blog/admin/api/media", { method: "POST", body: form });
    expect(res.status).toBe(200);
    const media = (await res.json()) as { url: string; width: number; height: number };
    expect(media.width).toBe(1);
    expect(media.height).toBe(1);
    const served = await get(media.url);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toContain("immutable");
  });

  it("export returns every word ever written", async () => {
    const res = await authed("/blog/admin/api/export");
    expect(res.status).toBe(200);
    const dump = (await res.json()) as { format: string; posts: Array<{ body_md: string }> };
    expect(dump.format).toBe("pm-blog-export/1");
    expect(dump.posts.some((p) => p.body_md.includes("Opening paragraph."))).toBe(true);
  });

  it("cleans up: the suite post is deleted", async () => {
    const res = await authed(`/blog/admin/api/posts/${postId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect((await get(`/blog/${slug}-moved`)).status).toBe(404);
  });
});
