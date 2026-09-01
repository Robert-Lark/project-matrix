<!--
  Build prompt for the blog: Rob's personal writing home on the domain —
  a CMS he writes in, and the public blog it publishes to.
  Drafted 2026-07-17 by the home-surface session. Paste everything inside
  the fenced block into a fresh session opened in this repo.

  Setup notes (for Rob, not part of the prompt):
  - Run it in a worktree (say "work in a worktree").
  - The agent is told to interview you briefly at kickoff (writing workflow,
    post types, media) before going autonomous — stay at the keyboard for
    the first ten minutes.
-->

```
Build the blog — my personal writing home on this domain, and the CMS I
will write it with.

This is 1000% separate from the benchmark. It is not a surface, not a
variant, not a measured page; it inherits none of the store's visual
system and none of its fences. It is where I write about anything —
engineering, records, photography, whatever — under the same roof as the
portfolio. Two deliverables, equally important:

1. THE CMS — the authoring experience. This must be insanely pleasurable
   to work in: the tool I *want* to open. Full-featured and giving me
   total control over the shape and formatting of every post.
2. THE BLOG — the public side: a contents page and the post pages
   themselves. Here you have full creative range. No inherited palette,
   no inherited typeface, no Catalogue. Go nuts — one coherent,
   distinctive vision, executed flawlessly.

── FIRST ACTION, BEFORE ANYTHING ──
Run `git fetch origin --prune` and branch your worktree from origin/main
— never from the local clone's idea of main (a previous session lost time
to a stale clone). Do NOT build on or entangle with any unmerged branch
you find (e.g. the store-surfaces spec branch); the blog touches none of
that work.

── SECOND ACTION: INTERVIEW ME, THEN GO AUTONOMOUS ──
Before designing anything, grill me for ten minutes (I am at the keyboard
at kickoff): How do I actually write — long sessions or fragments? Where
— always this machine, or phone/iPad too (this decides web-CMS vs
local-first)? What kinds of posts (essays, photo posts, link notes,
series)? How much per-post art direction do I really want — pull the
Tumblr photo blog (dreamstoday14-blog.tumblr.com) into scope or leave it?
Drafts shared with anyone before publishing? After that interview, make
every remaining call yourself and don't check in until it's built.

── READ FIRST (deliberately short — this build is separate) ──
docs/decision-map.md Notes + the domain-cutover ticket (the blog will
live on roblark.com when that cutover happens — your routing decision
feeds it), ADR-0004 §3 (how the front Worker composes the single origin
by path prefix — the least-invasive way in), workers/front/src (what you
may touch, minimally), and docs/adr/0007 §"Consequences" (how a sibling
singleton got served). You do NOT need the design-system or measurement
ADRs beyond knowing they exist — the blog is outside their fences.

── THE TWO THINGS THE BLOG STILL INHERITS ──
Separate does not mean careless. The blog shares a domain with a site
whose whole argument is engineering judgment, so:
1. DO NOT CONTAMINATE THE BENCHMARK. The store's numbers, chrome,
   measured KB paths, drift gate, and origin suite must be provably
   untouched — your front-Worker change should be a few lines of prefix
   dispatch, and the full origin suite must stay green. The blog carries
   no HUD and appears in no receipt.
2. DO NOT EMBARRASS THE CRAFT. Nobody will benchmark the blog, but a
   staff engineer WILL view source. Fast by default, semantic HTML,
   accessible without exception (visible focus, keyboard, reduced-motion,
   zoom/reflow, AA contrast — that's identity, not a store rule), RSS
   that works, URLs that never break. "No constraints" frees your
   aesthetics, not the floor.

── PART 1: THE CMS (the bar is "insanely pleasurable") ──
Design the authoring model around how I actually write (the interview),
not around what CMSes usually have. It is a single-author tool: no roles,
no workflow bureaucracy — drafts and published, me and nobody else.
What full-featured means here:
- Writing that feels instant: keyboard-first, autosave always, never a
  lost word (crash-safe drafts), fast enough that it never once makes me
  wait.
- Full control of shape and formatting: rich text/blocks with real
  typographic range — headings, pull quotes, footnotes, asides, code
  with highlighting, images/galleries with captions and layout options
  (full-bleed, inset, side-by-side), embeds — and per-post art direction
  (a post can carry its own accent, header treatment, or layout mood)
  without me touching CSS.
- Live preview that IS the blog rendering, not an approximation.
- The boring essentials done well: tags/series, post URLs I control,
  scheduling or at least publish-when-I-say, image upload straight into
  the post (R2 for media), edit-after-publish, and a way to see
  everything I've written at a glance.
- SECURITY IS LOAD-BEARING: this is a write surface on a public domain.
  Authentication before any write reaches storage (Cloudflare Access or
  an equivalently serious mechanism — decide and record why), CSRF
  protection on state changes, rate limiting, secrets in Worker secrets,
  no admin surface discoverable as anything but a login wall. Identify
  the abuse case and state how the design closes it.

── PART 2: THE BLOG (go nuts, then make it read) ──
The public side is a contents page and the posts. This is the one part
of the domain with zero visual inheritance — new palette, new type, new
register; take a real aesthetic risk and commit to it. Two disciplines
inside the freedom: long-form reading comfort is the floor (measure your
line lengths, rhythm, and contrast like you mean it — people will read
thousands of words here), and the design must scale from a three-line
note to a six-thousand-word essay with photos. The contents page is not
an afterthought: it is the front door of my writing and should make ten
years of future posts navigable (by date, by tag/series). Ship RSS (full
content), sensible meta/OG per post, and print styles if you have taste.

── ARCHITECTURE (decide, record, keep it boring) ──
Where it runs: the canonical plane (Cloudflare) — decide the shape
(likely a new blog Worker behind a front-Worker path prefix; state why
against alternatives like a subdomain, and note what the roblark.com
cutover will need). Where content lives: decide (D1 / R2 / KV / git) from
my actual workflow, and make backups/export trivial — my words must never
be locked in. Stack: your call; nothing on this domain ships a monolith
or a dependency you can't defend. Record the decisions the way this repo
records everything: an ADR, a decision-map entry, a build-log phase — the
blog is separate, but the record-keeping culture isn't.

── HOW TO WORK ──
Work in a git worktree (after fetching). This is Grilling + Prototype +
implement: interview → decide → record → build. Build the walking
skeleton first — write a post in the CMS, publish it, read it on the
public blog, end to end with auth — before any editor luxury; then spend
everything you have left making the writing experience and the reading
design extraordinary. Prototype the editor interactions and the post
design as real pages and critique them with your own eyes (screenshots,
the eight principles) before committing to them. Verify with real
tooling: the repo's checks, the FULL origin suite (proof of
non-contamination), your own browser passes (mobile, zoom, keyboard,
reduced-motion), and a Lighthouse/trace pass on both the contents page
and a heavy post. Run the standing verify-slice pass before committing.
Commit on your branch, present with a preview URL (`wrangler versions
upload` from the touched Worker); do NOT merge to main — merging deploys,
and that stays my call.

── DELIVERABLE ──
A working CMS I can log into and write with tonight, a public blog with
at least one real post flowing through the whole pipeline, the decision
records, and a short account of: the authoring model you chose and why,
the one aesthetic risk you took on the public side, the security model in
three sentences, and what you'd build next in the editor. Include the
preview URL.
```
