/**
 * The PLP measurement condition, and the one place its URLs are built.
 *
 * ADR-0004 §5 / CONTEXT.md "Measurement condition": the full set of variables
 * that define one reproducible measurement is carried in the URL — path
 * (strategy) + query (data volume, cache warmth, and — since 2026-09-04 —
 * ADR-0005 §5's five data-plane params). This module is the single
 * derivation of that query on this variant's side, shared by the server
 * render and by every strategy island, so the URL a page was SERVED under,
 * the URL its data layer re-fetches, and the URL it pushes to history cannot
 * disagree.
 *
 * Client-safe by construction (no "server-only", no Next API): the strategy
 * islands import it. It imports NOTHING from the reference package: a
 * paradigm never ships the spec (ADR-0004 §2), so the three rules it shares
 * with `packages/reference/render/plp-query.mjs` — the n clamp, the q
 * normalizer, the href rule — are RE-TYPED here and pinned equal by the
 * identity guard over tables of inputs (the `clampPlpN`/`clampN` precedent).
 */
import type { PlpApplied } from "@pm/data-contract";

/** `packages/reference/render/plp.mjs`. The master renders exactly PER_PAGE
 *  cards, which is what the drift comparison is taken at. */
export const PER_PAGE = 24;

/** The data-volume knob's canonical bounds. The rule of record is
 *  `packages/measurement/src/beacon.ts` (`PLP_N` + `clampN`), consumed by
 *  the edge Worker's served condition AND by the chrome's `environment` beacon
 *  tag — so a variant that clamped differently would serve one condition and
 *  publish another. Re-implemented rather than imported because
 *  `@pm/measurement` publishes TypeScript source (`"exports": "./src/index.ts"`)
 *  and this module is compiled by Next, which does not transpile workspace
 *  packages without `transpilePackages`. Pinned equal to the real `clampN` in
 *  the identity guard, junk and out-of-range inputs included. */
export function clampPlpN(raw: string | null | undefined): number {
  const parsed = parseInt(raw ?? "", 10) || PER_PAGE;
  return Math.min(Math.max(parsed, 1), 240);
}

/** `?page=` is a positive integer; junk and sub-floor values are page 1, and
 *  the cap is `Number.MAX_SAFE_INTEGER` — `parseInt` of 309+ digits is
 *  Infinity, which would spell `page=Infinity` in the tray URL (the Worker
 *  reads that as page 1 while the island holds Infinity, and `settled` could
 *  never be true). Re-typed from plp-query.mjs `clampPage` and pinned equal
 *  over a table in the identity guard. The ceiling is the edge Worker's (a
 *  page past the end is served empty, never cached). */
export function clampPlpPage(raw: string | null | undefined): number {
  const parsed = parseInt(raw ?? "", 10) || 1;
  return Math.min(Math.max(parsed, 1), Number.MAX_SAFE_INTEGER);
}

/** ADR-0005 §5's three facet params, in canonical order. */
export const PLP_FACET_PARAMS = ["genre", "style", "format"] as const;
export type PlpFacetParam = (typeof PLP_FACET_PARAMS)[number];

/** The sort orders the data plane implements (plp-query.mjs PLP_SORTS). A
 *  value outside this list is still FORWARDED — the Worker 400s it and the
 *  route answers 404 — so a hand-typed `?sort=popularity` is an honest
 *  "no such filter", never silently the default. */
export const PLP_SORTS = ["year-desc", "year-asc", "price-asc", "price-desc", "title"] as const;

/** `q`'s normalized form (plp-query.mjs `normalizeQ`, re-typed): whitespace
 *  collapsed, trimmed, capped at 64 code units, trimmed again; `null` when
 *  nothing is left. Applied CLIENT-SIDE too, so the condition an island
 *  holds equals the `applied.q` the tray echoes — `settled` (below) compares
 *  the two, and a raw "  miles   davis " against an applied "miles davis"
 *  would never settle: the grid would move and the address bar would not
 *  (design critique). */
export const PLP_Q_MAX = 64;
export function normalizePlpQ(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const q = String(raw).replace(/\s+/g, " ").trim().slice(0, PLP_Q_MAX).trimEnd();
  return q === "" ? null : q;
}

export interface PlpCondition {
  /** Effective (clamped) rows per page — never the raw query value. */
  n: number;
  page: number;
  /** `cold` bypasses the KV warm tier; `default` reads it (ADR-0005 §1). */
  cache: "cold" | "default";
  /**
   * The harness isolation nonce. `""` when absent or malformed.
   *
   * This is part of the SERVED condition, not decoration: the bench runner
   * sets it on every measured URL (`tools/bench-runner/src/batch.ts`) and
   * the edge Worker folds a well-formed value into the KV key, which is how
   * a batch mints warm state without touching other runs' — or live
   * visitors'. A page that dropped it would send every batch, every
   * post-deploy smoke and every visitor through ONE infinite-TTL warm entry.
   */
  run: string;
  /** The chrome's snapshot selector (ADR-0004 §5/§6). Carried in every
   *  in-surface href and history write so the HUD keeps reading the profile
   *  the visitor chose; NEVER forwarded to the data plane and never part of
   *  a client-cache key — two visits differing only by profile hold one
   *  identical tray. `""` when absent or malformed. */
  profile: string;
  /** ADR-0005 §5's five, `null` when unapplied. `q` is normalized. */
  genre: string | null;
  style: string | null;
  format: string | null;
  sort: string | null;
  q: string | null;
}

/** The Worker's own rule, re-implemented rather than guessed
 *  (`workers/edge/src/index.js runKnob`): a malformed value is ignored,
 *  exactly as the Worker ignores it, so the page and the plane agree about
 *  which key was served. Asserted against the Worker's regex by the guard.
 *  `profile` is bounded by the same shape (the reference's CARRY_RE). */
export const PLP_RUN_RE = /^[A-Za-z0-9._-]{1,64}$/;

/** Read the served condition out of a request's search params. Clamping here
 *  (rather than passing the raw string on) is what keeps the served page and
 *  the chrome's `environment` beacon tag talking about the same condition:
 *  the tag is derived from the URL by `knobTags`, never from what was served,
 *  so a page that ignored `?n=` would publish a tag that is simply false.
 *  Empty values are ABSENT — `?sort=` and `?q=` are what a GET form submits
 *  for an untouched select and an empty search box (the Worker's rule too). */
export function readPlpCondition(params: URLSearchParams): PlpCondition {
  const run = params.get("run") ?? "";
  const profile = params.get("profile") ?? "";
  const facet = (key: string): string | null => {
    const value = params.get(key);
    return value === null || value === "" ? null : value;
  };
  return {
    n: clampPlpN(params.get("n")),
    page: clampPlpPage(params.get("page")),
    cache: params.get("cache") === "cold" ? "cold" : "default",
    run: PLP_RUN_RE.test(run) ? run : "",
    profile: PLP_RUN_RE.test(profile) ? profile : "",
    genre: facet("genre"),
    style: facet("style"),
    format: facet("format"),
    sort: facet("sort"),
    q: normalizePlpQ(params.get("q")),
  };
}

/**
 * Next hands a route its query as an already-parsed object whose values may be
 * a string, an array (a repeated param), or undefined. This turns that shape
 * into the served condition, and it exists as a FUNCTION because all three PLP
 * routes need it and nothing could otherwise test that a route reads its query
 * at all: a page that ignored `?n=` entirely would serve n=24 while the
 * chrome's beacon tag published `n=240|cache=cold`, and every assertion in
 * this unit's guard would still pass.
 *
 * A repeated param takes the FIRST value, which is what `URLSearchParams.get`
 * does, so a hand-typed `?n=24&n=240` resolves the same way everywhere.
 */
export function conditionFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): PlpCondition {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    params.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
  }
  return readPlpCondition(params);
}

/** The data-plane URL for a condition: `/api/plp` plus every knob the Worker
 *  reads, in a FIXED order so one condition is one URL (the Worker mints its
 *  KV key from the parsed knobs, but a stable request URL is what makes a
 *  receipt legible). The five ADR-0005 §5 params are forwarded again since
 *  2026-09-04 — the data plane filters on them, so the request that looks
 *  filtered IS. `profile` is NOT forwarded: it is the chrome's knob, and a
 *  tray does not vary by it. */
export function plpApiPath(condition: PlpCondition): string {
  const params = new URLSearchParams();
  params.set("n", String(condition.n));
  params.set("page", String(condition.page));
  for (const key of ["genre", "style", "format", "sort", "q"] as const) {
    const value = condition[key];
    if (value !== null) params.set(key, value);
  }
  if (condition.cache === "cold") params.set("cache", "cold");
  if (condition.run !== "") params.set("run", condition.run);
  return `/api/plp?${params.toString()}`;
}

/**
 * THE ONE HREF RULE (`packages/reference/render/plp.mjs conditionHref`,
 * re-typed): knobs in canonical order — page, n, cache, run, profile, genre,
 * style, format, sort, q — each omitted at its default, and the bare
 * condition spelled `?page=1` so no link is ever a bare `?`. Spelling is
 * `URLSearchParams`' (`+` for a space), the same encoding a browser gives a
 * GET form submit, so a JS-off form and a JS-on push reach the bar alike.
 *
 * Used for the anchors `PlpArticle` renders AND for every history write, so
 * the address bar after a JS-on click spells the same URL the anchor's own
 * href would have navigated to. `defaultN` is the master's PER_PAGE; it is a
 * parameter only so the guard can prove the omission rule.
 */
export function plpHistoryUrl(condition: PlpCondition, defaultN: number): string {
  const params = new URLSearchParams();
  if (condition.page !== 1) params.set("page", String(condition.page));
  if (condition.n !== defaultN) params.set("n", String(condition.n));
  if (condition.cache === "cold") params.set("cache", "cold");
  // Bounded on the way OUT as well as in (the reference's CARRY_RE): a
  // condition built by hand with a malformed nonce spells no nonce at all,
  // exactly as the reference's conditionHref does.
  if (condition.run !== "" && PLP_RUN_RE.test(condition.run)) params.set("run", condition.run);
  if (condition.profile !== "" && PLP_RUN_RE.test(condition.profile)) params.set("profile", condition.profile);
  for (const key of ["genre", "style", "format", "sort", "q"] as const) {
    const value = condition[key];
    if (value !== null && value !== "") params.set(key, value);
  }
  const query = params.toString();
  return query === "" ? "?page=1" : `?${query}`;
}

/** An in-surface href: the condition with `over` applied. Facets, sort and
 *  search reset `page` (a new filter starts at page 1); pagination keeps
 *  everything. */
export function plpHref(condition: PlpCondition, over: Partial<PlpCondition>): string {
  return plpHistoryUrl({ ...condition, ...over }, PER_PAGE);
}

/**
 * Do two conditions describe the same served state?
 *
 * Needed because a URL is not a canonical spelling of its condition: the
 * served `?n=24&run=abc&cache=cold` and this module's `?cache=cold&run=abc`
 * are the SAME condition in different orders, with the default `n` dropped.
 * String-comparing them says "different" and makes a client-side history
 * write fire for a page nobody navigated to.
 */
export function sameCondition(a: PlpCondition, b: PlpCondition): boolean {
  return (
    a.n === b.n &&
    a.page === b.page &&
    a.cache === b.cache &&
    a.run === b.run &&
    a.profile === b.profile &&
    a.genre === b.genre &&
    a.style === b.style &&
    a.format === b.format &&
    a.sort === b.sort &&
    a.q === b.q
  );
}

/** Is a tray the answer to this condition? The payload carries the query the
 *  data plane APPLIED (`PlpApplied`, ADR-0005 addendum), so the cache arms
 *  can tell "the page I asked for has landed" from "I am still showing the
 *  previous page under keepPreviousData" — and only then move the address
 *  bar. Compares the five params and the page; `n` is the payload's
 *  `perPage`. */
export function appliedMatches(
  payload: { page: number; perPage: number; applied: PlpApplied },
  condition: PlpCondition,
): boolean {
  const a = payload.applied;
  return (
    payload.page === condition.page &&
    payload.perPage === condition.n &&
    a.genre === condition.genre &&
    a.style === condition.style &&
    a.format === condition.format &&
    a.sort === condition.sort &&
    a.q === condition.q
  );
}

/** The cache key one condition occupies in a client data layer. Order is
 *  fixed for the same reason the Worker's KV key is: two spellings of one
 *  condition must not fork into two cache entries, or a "revisit" measures a
 *  miss and the published cell is a coin flip. `profile` is deliberately
 *  absent (it is absent from `plpApiPath`): two visits differing only by
 *  the HUD's profile hold one identical tray. */
export function plpCacheKey(condition: PlpCondition): string {
  return plpApiPath(condition);
}

/**
 * The client cache's PUBLISHED configuration (ADR-0005 §4): five minutes.
 *
 * "Client-cache config is published copy, never a silent default." Under
 * TanStack Query's own default (`staleTime: 0`, "consider cached data as
 * stale") a revisit paints instantly from cache but STILL refetches in the
 * background — the prototype measured 1 request / 11.6 KB — so "revisit = 0
 * bytes" is only true of a stated config. This constant is that statement.
 *
 * It applies to the LEAD ONLY. Apollo ships no `staleTime` at all: its window
 * under `cache-first` is unbounded, which `APOLLO_CACHE_WINDOW` states and a
 * canary pins. What the two arms hold equal is the POLICY SHAPE — cache-first,
 * seeded from the server, no hand-rolled TTL on either side.
 *
 * THE LEAD'S SECOND KNOB, published here because §4 says configuration is
 * published copy and this one was not. `createSeededQueryClient` also sets
 * `retry: false`, which is NOT TanStack's default (3 retries with exponential
 * backoff). It is set so a failed page change reaches the error floor at once
 * instead of after three silent re-requests — which would otherwise put bytes
 * and seconds into an interaction cell without appearing anywhere in the
 * receipt. Stating it is the rule; the exhibit's `cache-first` needs no
 * counterpart because Apollo does not retry by default.
 */
export const PLP_STALE_TIME_MS = 5 * 60 * 1000;
