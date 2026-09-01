# Give the benchmark plane the security floor the blog already has

**Priority 4 of the 2026-08-29 audit.** The blog wall held up under an adversarial pass
(constant-time credential compare, hashed revocable sessions, header+form CSRF with
Sec-Fetch-Site, parameterized D1 throughout, rehype-sanitize + CSP, clean secrets — verified
live: `/blog/` 200 with the full floor, `/blog/admin/` 401). What's wrong sits **outside**
the wall: every page that is not the blog ships with zero security headers, and a few small
hardening items are cheap. Nothing here is a blocker — no published number is movable from
outside and no unauthenticated write reaches storage — but a header-checking staff reviewer
sees the inconsistency in the first minute.

Every file:line verified 2026-08-29, live probes included. Re-open each before editing.

---

## Task 1 — the header floor (the major)

Confirmed live: `/` and `/vanilla/editorial/` return **no** CSP, no
X-Frame-Options/frame-ancestors, no X-Content-Type-Options, no Referrer-Policy. The blog
names its floor at `workers/blog/src/html.js:1` and scopes it to ADR-0009; nothing in
docs/ records the store's absence as a decision (grep confirms).

Mechanism: `workers/front/src/index.js:153-186` ends in `.transform(upstream)`, preserving
upstream headers untouched; home + methodology are assets-first (wrangler `assets.directory
./dist`) and **no `_headers` file exists**, so the asset path has no floor either.

Fix in workers/front, uniformly (identical for every variant — the floor must be part of the
held-constant transport so it can never become a per-variant variable):

- `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a frame policy
  (`frame-ancestors 'none'` / `X-Frame-Options: DENY` — nothing legitimately embeds the
  store) on every response the script proxies.
- A `_headers` file for the assets-first paths (`/`, `/methodology/`, `/_pm/*`).
- **A full CSP is a separate decision, not this commit** — qwik/astro inline scripts would
  force `'unsafe-inline'` or nonces, and nonces would touch the byte-identity guards.
  Record the tradeoff as a decision-map note (or ADR addendum) rather than shipping a
  half-CSP silently.
- Measure and record the wire cost of the added headers — they ride every measured response,
  so the chrome-constant/byte discipline should at least name them (they are identical
  across variants, so they cancel in comparisons — say so in the record).

## Task 2 — beacon tag roster (small)

`workers/edge/src/index.js:202-224` validates the five beacon tags for presence and ≤96
bytes only; `:233-244` then uses `tags.variant` as the Analytics Engine index. Any string
becomes a sampling key. Published numbers are safe by mechanism (they come from committed
lab bundles, `workers/front/src/index.js:31`), so this is RUM-dashboard pollution — but the
roster exists (`workers/front/src/index.js:48-62`), so 400 unknown variants/surfaces. Rate
limiting stays deferred to domain-cutover as recorded; this is the part rate limiting can't
do.

## Task 3 — blog media upload: reject what the sniffer can't read (small)

`workers/blog/src/index.js:228` keys the extension off client-controlled `file.type`; `:234`
consults `imageDimensions(bytes)` only for width/height and a `null` result (unparseable
bytes) still uploads with null dims — silently forfeiting the zero-CLS-by-construction rule
the file's own comment at `:32-34` claims. XSS stays dead (no SVG in the whitelist, nosniff
on `/blog/media/*` at `:107`). Fix: 400 when the sniffer returns null, and derive the type
from the sniffed magic bytes (`dimensions.js` already distinguishes all five formats).

## Task 4 — two auth nits (lines, not sessions)

- **Atomic lockout increment:** `workers/blog/src/auth.js:44-63` is read-modify-write, so a
  concurrent burst exceeds the documented 5-per-10-min limit (harmless against a 256-bit
  credential, but the guard is not sabotage-proof by the repo's own standard). Express the
  increment in SQL (`count = login_attempts.count + 1` with a CASE for the window reset).
- **CSRF compare:** `auth.js:162` compares the CSRF token with `===` while the credential
  gets `crypto.subtle.timingSafeEqual` (`:23-29`). Use the same helper for both.

## Known and deliberately NOT here

Beacon rate limiting and Cloudflare Access on `/blog/admin/*` are recorded domain-cutover
work (`docs/decision-map.md:216`); the `?page=` KV ceiling lives in
`plp-data-plane-prompt.md` step 0.

## Done means

`curl -sD -` on `/`, `/methodology/`, `/vanilla/editorial/`, an image asset and a `/api/*`
response shows the floor; a junk-variant beacon 400s; a text file with `file.type:
image/png` 400s at upload; the lockout survives a 20-parallel-request sabotage in the blog
suite; origin suite green (its header assertions updated in the same commit).
