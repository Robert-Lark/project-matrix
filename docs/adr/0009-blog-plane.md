---
status: accepted
date: 2026-07-17
ticket: blog
---

# The blog plane — Rob's writing home and its CMS

## Context

The domain is about to become roblark.com (`domain-cutover`), and Rob's
writing home moves in with the benchmark: a personal blog (engineering,
records, photography — anything) plus the CMS he writes it with. It is
deliberately NOT a store surface: no Catalogue tokens, no chrome, no HUD,
no receipts, outside every measurement fence (ADR-0001/0006/0008). What it
does inherit is the domain's floor — the benchmark's numbers must be
provably untouched, and the craft must survive a staff engineer's
view-source: semantic HTML, accessibility without exception, working RSS,
URLs that never break.

Interview-locked requirements (Rob, 2026-07-17): a web CMS reachable from
any device; an editor built for drafts that grow over days with several
open at once; four post kinds (essay, photo, note, link) with series as an
attachable grouping; per-post art direction as curated knobs, never raw
CSS; the Tumblr photo blog as aesthetic reference only, never imported;
secret revocable preview links; login identity robresearch87@gmail.com;
masthead "Rob Lark"; words never locked in.

## Decision

**1. The blog is a sibling Worker (`pm-blog`) behind the front Worker at a
single claimed prefix, `/blog/*`.** The front Worker's dispatch (ADR-0004
§3) gains one prefix → binding entry and the blog rides the existing
composition: `workers_dev: false`, reachable only through `pm-front`'s
service binding, original request forwarded untouched, blog assets nested
under `/blog/` so no path rewriting. Unlike variant HTML, BLOG responses
**bypass chrome injection entirely** and pass through byte-identical, the
same guard the EDGE binding uses — the blog carries no HUD and appears in
no receipt. The admin surface lives INSIDE the prefix at `/blog/admin/*`,
so the blog claims exactly one top-level path; `domain-cutover` sub-decision
(d) needs to reserve `/blog` and nothing else.

**2. Content lives in D1 (`pm-blog`); media lives in R2
(`pm-blog-media`).** Both are new resources — the benchmark's
`pm-snapshot` bucket and `pm-warm` KV are not touched. Markdown is the
source of truth (one `body_md` column per post); rendered HTML is a cache
column recomputed on save by the same pipeline that serves the public
page. Tables: `posts`, `revisions` (crash-safe autosave history),
`media`, `sessions`, `login_attempts`. Words are never locked in twice
over: the source format is plain markdown, and the admin ships a
one-request full export — a JSON dump of every post, every revision, the
media manifest, and the redirect map (a zip-of-`.md`-files variant is a
recorded editor follow-up); `wrangler d1 export pm-blog` is the
out-of-band backup path.

**3. The authoring model is markdown-plus-directives in a real editor, and
the preview IS the publish pipeline.** Rob writes markdown daily; the
pleasurable tool for a drafts-over-days engineer is text he can trust, not
a block UI he fights. The editor is CodeMirror 6 (markdown mode,
keyboard-first, slash-command block insertion, drag-drop image upload that
writes R2 and inserts the directive). Typographic range beyond CommonMark
— pull quotes, asides, footnotes, galleries with layout options
(full-bleed, inset, side-by-side), embeds — comes from `remark-directive`
blocks (`:::pullquote`, `:::gallery{layout=bleed}`, …). One unified
pipeline module (remark-parse → remark-gfm → remark-directive → custom
handlers → rehype, Shiki JS-engine highlighting with a curated grammar
set) renders the admin live preview, the published page, the preview-link
page, and the RSS body — the preview cannot drift from the blog because
they are the same function.

**4. Per-post art direction is curated knobs stored as data.** Three
post-level fields — `accent` (a color), `header_style` (one of a small set
of designed header treatments), `mood` (layout register) — map to
pre-designed CSS on the public side. A post can be individually dressed
without Rob ever touching CSS, and nothing a post carries can break the
blog's coherence. Kinds (essay/photo/note/link) select the base template;
series is a grouping field with prev/next navigation, not a kind.

**5. Auth is a Worker-side wall: one high-entropy credential, server-side
sessions, CSRF by custom header, rate-limited login.** Cloudflare Access
was the first choice and is rejected *for now* on a hard constraint: the
only public hostname is `pm-front.….workers.dev`, and Access on a
workers.dev hostname cannot be path-scoped — walling `/blog/admin` would
wall the benchmark. The equivalently-serious mechanism: a single
256-bit-entropy credential (single author — no usernames, nothing to
enumerate) stored only as a SHA-256 hash in a Worker secret; login issues
a 256-bit session id stored hashed in D1 (30-day rolling expiry; revocable
from the admin, including a "sign out everywhere" that kills every session
on every device) in an `HttpOnly; Secure; SameSite=Lax; Path=/blog` cookie;
every mutation requires a custom `x-pm-blog-csrf` header bound to the
session (cross-origin JS cannot set it without a preflight that will
fail) plus a same-origin `Sec-Fetch-Site` check; the login endpoint is
rate-limited in D1 (per-IP window with lockout backoff). Unauthenticated
`/blog/admin/*` yields only a login wall — no admin markup, no existence
disclosure; the editor's script bundle also sits behind the session, and
the only world-readable admin bytes are the login page's stylesheet. **Abuse case:** a write surface on a public domain invites
credential brute force and session riding; the design closes both — brute
force hits a rate-limited endpoint guarding a 256-bit secret with no
username dimension, and riding fails on the custom-header CSRF gate while
the stolen-cookie path is cut by HttpOnly + server-side revocation. At
`domain-cutover`, Cloudflare Access (allowlist robresearch87@gmail.com) is
layered onto `roblark.com/blog/admin/*` as defense-in-depth in front of
this wall, not instead of it.

**6. URLs are flat, author-owned, and permanent.** `/blog/` (contents),
`/blog/{slug}` (posts — slug is an editable field, no dates in the path,
so a URL never encodes something that can change), `/blog/tag/{tag}`,
`/blog/series/{series}`, `/blog/feed.xml` (full-content RSS),
`/blog/media/{id}` (immutable cache headers), `/blog/preview/{token}`
(secret drafts), `/blog/admin/*`. Route names are reserved words the slug
validator refuses. Published slug changes write a redirect row — old URLs
301, never 404.

**7. The public side ships zero framework bytes and the stack is four
defensible dependencies.** Public pages are server-rendered strings from
`pm-blog` — semantic HTML, one CSS file, no client JS except progressive
enhancement measured in single-digit KB. The dependency list: `codemirror`
(the editor — best-in-class text editing, admin-only bytes), the
`unified`/`remark`/`rehype` ecosystem (the de-facto standard markdown
pipeline), `shiki` (VS Code grammars, inline-styled output that survives
RSS readers and print); sortable ids come from a 20-line in-repo util, not
a dependency. Build is `esbuild` via the
repo's existing `build.mjs` convention. Fonts are self-hosted, subset, and
new to this plane — zero `@pm/tokens` imports (the workspace-isolation
guard should be able to prove it).

**8. Deploy order and suite coverage are additive.** `pm-blog` deploys
before `pm-front` (binding must resolve), joining the variants+edge leg of
the CI deploy job. The local origin suite gains the blog worker in
`run-local.mjs` orchestration and a new `blog.test.ts` — existing suite
files and assertions are untouched. The non-contamination claim rests on
exactly what is enforced: the store workers are byte-untouched (the whole
production diff is the front's dispatch seam), the full suite stays green,
and `blog.test.ts` asserts blog pages carry none of the front's injection
artifacts. Two honest limits, recorded: no store contract asserts the
absence of blog bytes (nothing about the store changed, so nothing needed
asserting), and the deployed smoke can prove the wall REFUSES but not that
it accepts — a missing `ADMIN_CREDENTIAL_HASH` secret is invisible to CI
and surfaces only at login (runbook step: verify login after arming).

## Considered alternatives

- **A subdomain (`blog.roblark.com`).** Cleanest isolation, but there is
  no zone until `domain-cutover`, it forks the single-origin story
  (ADR-0004's whole argument), and it buys nothing `/blog/*` passthrough
  doesn't already give. Rejected.
- **Assets-first singleton like home (ADR-0007).** The home pattern is for
  static composition at build time; the blog is dynamic (D1 reads, auth,
  uploads, preview tokens). Rejected on shape.
- **A second prefix (`/write`) for the CMS.** Reads nicely but doubles the
  claimed URL space the cutover must reserve forever, for zero functional
  gain over `/blog/admin`. Rejected.
- **Git as the content store.** Beautiful export story, but it breaks the
  interview's first lock — writing from any device — and turns every
  publish into a deploy. Rejected.
- **KV as the content store.** No queries, no transactions, eventual
  consistency on the write path of an editor. Rejected.
- **A block editor (ProseMirror/Tiptap) with JSON documents.** More
  editor, less trust: structured JSON is a worse source of truth than
  markdown for a writer who greps, diffs, and exports; and the block
  schema becomes a private format — exactly the lock-in the brief forbids.
  Rejected for this author; revisit only if directives prove insufficient.
- **Cloudflare Access today.** Rejected above (§5) on the workers.dev
  path-scoping constraint; explicitly planned as a cutover-time layer.
- **A static-site generator + git publish flow.** Fails "log into and
  write with tonight" from any device, and publish latency becomes build
  latency. Rejected.

## Consequences

- `workers/blog` joins the workspace as `@pm/blog`; `workers/front` gains
  one `services` entry and a prefix table line plus the BLOG passthrough
  guard — the complete production diff to the benchmark's plane.
- First D1 database in the repo (`pm-blog`), second R2 bucket
  (`pm-blog-media`); D1 migrations live in `workers/blog/migrations/` and
  run via `wrangler d1 migrations apply` (local and remote).
- New Worker secret on `pm-blog`: `ADMIN_CREDENTIAL_HASH` (SHA-256 of the
  credential; the credential itself lives in Rob's password manager).
- `run-local.mjs` starts a fifth dev process (port 8791) and applies
  migrations before the suite (content is written through the admin API by
  the tests themselves, with the committed fixture credential); `blog.test.ts` joins
  the suite additively.
- CI deploy job gains the `pm-blog` deploy step before `pm-front`; the
  post-deploy smoke gains blog checks. Merging to main deploys the blog —
  which is why this branch is presented as a preview
  (`wrangler versions upload`) and merging stays Rob's call.
- `domain-cutover` picks up two lines: `/blog` is a claimed prefix its
  redirect plan must preserve, and Access-on-`/blog/admin/*` joins the
  cutover checklist (§5).
- The blog is invisible to the measurement plane: no beacons, no
  `/_pm/*` bytes, no receipt rows; the drift gate and origin-suite store
  contracts never mention it. Separation is enforced by the same
  workspace-isolation guard that fences the variants.
