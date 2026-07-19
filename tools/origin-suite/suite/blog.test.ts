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

  it("the media library lists the upload; alt edits re-render referencing posts", async () => {
    // Browse: the upload is in the library with its sniffed dimensions.
    const list = await authed("/blog/admin/api/media");
    expect(list.status).toBe(200);
    const items = (await list.json()) as Array<{
      id: string; key: string; filename: string; width: number;
      used_in: Array<{ id: string }>;
    }>;
    const mine = items.find((item) => item.filename === "dot.png");
    expect(mine).toBeDefined();
    expect(mine!.width).toBe(1);

    // Insert without re-uploading: the empty-alt form, so the library's alt
    // is what renders. Saving re-renders body_html through mediaLookup.
    const put = await authed(`/blog/admin/api/posts/${postId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body_md: `Opening paragraph.\n\n![](/blog/media/${mine!.key})\n`,
      }),
    });
    expect(put.status).toBe(200);
    const relisted = (await (await authed("/blog/admin/api/media")).json()) as typeof items;
    expect(
      relisted.find((item) => item.id === mine!.id)!.used_in.some((p) => p.id === postId),
    ).toBe(true);

    // Fixing alt on the media row re-fixes the PUBLISHED page's cached HTML.
    const patch = await authed(`/blog/admin/api/media/${mine!.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alt: "a better dot" }),
    });
    expect(patch.status).toBe(200);
    expect(((await patch.json()) as { rerendered: number }).rerendered).toBeGreaterThanOrEqual(1);
    const page = await (await get(`/blog/${slug}-moved`)).text();
    expect(page).toContain('alt="a better dot"');
    expect(page).toContain('width="1"');
  });

  it("media mutations refuse a missing CSRF header", async () => {
    const list = (await (await authed("/blog/admin/api/media")).json()) as Array<{ id: string }>;
    const res = await get(`/blog/admin/api/media/${list[0]!.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ alt: "riding" }),
    });
    expect(res.status).toBe(403);
  });

  it("accepts an AVIF upload now that its dimensions are sniffable", async () => {
    // Hand-built minimal AVIF: ftyp(avif) + meta{pitm,iprp{ipco[ispe 3×2],ipma}}.
    const cc = (s: string) => [...s].map((c) => c.charCodeAt(0));
    const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const u16 = (n: number) => [(n >>> 8) & 255, n & 255];
    const box = (type: string, ...parts: number[][]): number[] => {
      const body = parts.flat();
      return [...u32(8 + body.length), ...cc(type), ...body];
    };
    const full = (type: string, ...parts: number[][]) => box(type, [0, 0, 0, 0], ...parts);
    const avif = Uint8Array.from([
      ...box("ftyp", cc("avif"), u32(0), cc("mif1")),
      ...full("meta",
        full("pitm", u16(1)),
        box("iprp",
          box("ipco", full("ispe", u32(3), u32(2))),
          full("ipma", u32(1), u16(1), [1], [1]))),
    ]);
    const form = new FormData();
    form.append("file", new File([avif], "tiny.avif", { type: "image/avif" }), "tiny.avif");
    const res = await authed("/blog/admin/api/media", { method: "POST", body: form });
    expect(res.status).toBe(200);
    const media = (await res.json()) as { width: number; height: number; url: string };
    expect(media.width).toBe(3);
    expect(media.height).toBe(2);
    expect((await get(media.url)).headers.get("content-type")).toBe("image/avif");
  });

  it("the markdown zip carries every post plus the media manifest", async () => {
    const res = await authed("/blog/admin/api/export.zip");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // STORE'd entries sit raw in the archive — names and words included.
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain(`posts/${slug}-moved.md`);
    expect(text).toContain("media.json");
    expect(text).toContain("redirects.json");
    expect(text).toContain("Opening paragraph.");
  });

  it("scheduling refuses an already-published post", async () => {
    const res = await authed(`/blog/admin/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: new Date(Date.now() + 3_600_000).toISOString() }),
    });
    expect(res.status).toBe(400);
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

// The cron leg needs the blog worker's own dev server (`wrangler dev
// --test-scheduled` exposes /__scheduled on 8791) — local composition only;
// the deployed smoke can't and shouldn't fire production's trigger.
const BLOG_DEV = !process.env.PM_ORIGIN || ORIGIN.includes("127.0.0.1")
  ? "http://127.0.0.1:8791"
  : null;

describe.skipIf(!CREDENTIAL || !BLOG_DEV)("blog plane: scheduled publishing (local cron)", () => {
  let cookie = "";
  let csrf = "";
  let postId = "";
  const slug = `suite-sched-${Date.now().toString(36)}`;

  const authed = (path: string, init: RequestInit = {}) =>
    get(path, {
      ...init,
      redirect: "manual",
      headers: { cookie, "x-pm-blog-csrf": csrf, ...(init.headers ?? {}) },
    });

  it("logs in and drafts a post", async () => {
    const login = await get("/blog/admin/login", {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams({ credential: CREDENTIAL! }),
    });
    cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const desk = await get("/blog/admin", { headers: { cookie } });
    csrf = /name="pm-blog-csrf" content="([^"]+)"/.exec(await desk.text())?.[1] ?? "";
    const created = await authed("/blog/admin/new", {
      method: "POST",
      body: new URLSearchParams({ csrf, kind: "essay" }),
    });
    postId = created.headers.get("location")?.split("/edit/")[1] ?? "";
    expect(postId.length).toBeGreaterThan(10);
  });

  it("refuses to schedule a draft-slugged post (the permanent-URL gate)", async () => {
    const res = await authed(`/blog/admin/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: new Date(Date.now() + 3_600_000).toISOString() }),
    });
    expect(res.status).toBe(400);
  });

  // Generous timeout: publishDue runs under waitUntil, so the tail of this
  // test is a poll, not a race.
  it("schedules, stays invisible, then the cron publishes at the chosen instant", { timeout: 30_000 }, async () => {
    const save = await authed(`/blog/admin/api/posts/${postId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Scheduled post", slug, body_md: "Due words.\n" }),
    });
    expect(save.status).toBe(200);

    // A future schedule can be made and unmade without publishing anything.
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const scheduled = await authed(`/blog/admin/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: future }),
    });
    expect(scheduled.status).toBe(200);
    expect(((await scheduled.json()) as { scheduled_at: string }).scheduled_at).toBe(future);
    const cancelled = await authed(`/blog/admin/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cancel: true }),
    });
    expect(cancelled.status).toBe(200);

    // Schedule for a moment already in the past — due on the next tick.
    const at = new Date(Date.now() - 60_000).toISOString();
    const due = await authed(`/blog/admin/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at }),
    });
    expect(due.status).toBe(200);
    expect((await get(`/blog/${slug}`)).status).toBe(404); // still a draft

    const fired = await fetch(`${BLOG_DEV}/__scheduled?cron=*/5+*+*+*+*`);
    expect(fired.status).toBe(200);

    // publishDue runs under waitUntil — poll briefly rather than race it.
    let page: Response | null = null;
    for (let i = 0; i < 20; i += 1) {
      page = await get(`/blog/${slug}`);
      if (page.status === 200) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(page!.status).toBe(200);
    expect(await page!.text()).toContain("Due words.");

    // published_at is the author's chosen instant, not the tick's.
    const post = (await (await authed(`/blog/admin/api/posts/${postId}`)).json()) as {
      published_at: string; scheduled_at: string | null; status: string;
    };
    expect(post.status).toBe("published");
    expect(post.published_at).toBe(at);
    expect(post.scheduled_at).toBeNull();
  });

  it("a re-scheduled, once-published post republishes at the NEW instant, not the stale one", { timeout: 30_000 }, async () => {
    // The regression verify caught: publish (stamps a date) -> unpublish
    // (keeps published_at) -> schedule for a different instant -> the cron
    // must stamp the AUTHOR'S chosen instant, not COALESCE the stale one.
    const publishNow = await authed(`/blog/admin/api/posts/${postId}/publish`, { method: "POST" });
    expect(publishNow.status).toBe(200);
    const first = (await (await authed(`/blog/admin/api/posts/${postId}`)).json()) as { published_at: string };
    const stale = first.published_at;

    await authed(`/blog/admin/api/posts/${postId}/unpublish`, { method: "POST" });
    const chosen = new Date(Date.now() - 120_000).toISOString();
    const reschedule = await authed(`/blog/admin/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: chosen }),
    });
    expect(reschedule.status).toBe(200);

    await fetch(`${BLOG_DEV}/__scheduled?cron=*/5+*+*+*+*`);
    let post: { status: string; published_at: string } | null = null;
    for (let i = 0; i < 20; i += 1) {
      post = (await (await authed(`/blog/admin/api/posts/${postId}`)).json()) as typeof post;
      if (post!.status === "published") break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(post!.status).toBe("published");
    expect(post!.published_at).toBe(chosen);
    expect(post!.published_at).not.toBe(stale);
  });

  it("cleans up: the scheduled post is deleted", async () => {
    const res = await authed(`/blog/admin/api/posts/${postId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });
});
