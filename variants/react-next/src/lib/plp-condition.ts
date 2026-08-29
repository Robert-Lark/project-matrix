/**
 * The PLP measurement condition, and the one place its URLs are built.
 *
 * ADR-0004 §5 / CONTEXT.md "Measurement condition": the full set of variables
 * that define one reproducible measurement is carried in the URL — path
 * (strategy) + query (data volume, cache warmth). This module is the single
 * derivation of that query on this variant's side, shared by the server
 * render and by every strategy island, so the URL a page was SERVED under and
 * the URL its data layer re-fetches cannot disagree.
 *
 * Client-safe by construction (no "server-only", no Next API): the strategy
 * islands import it.
 */
import { clampPlpN, clampPlpPage } from "./plp";

/** The five canonical PLP facet params of ADR-0005 §5. The edge Worker does
 *  NOT implement them yet — `workers/edge/src/index.js:124-126` parses `n`,
 *  `page` and `run`, and `cache` is read separately at `:62` inside
 *  `serveData` (an earlier draft cited one range for all four, which is the
 *  slice's own citation-drift class) — so today they are forwarded and
 *  ignored:
 *  a facet click serves the UNFILTERED grid under a filtered URL. They are
 *  forwarded rather than dropped so the page is already correct the day the
 *  Worker's param contract lands — that Worker is in no unit's boundary and
 *  the exact diff is reported instead of applied. */
export const PLP_FACET_PARAMS = ["genre", "style", "format", "sort", "q"] as const;

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
   * sets it on every measured URL (`tools/bench-runner/src/batch.ts:79`) and
   * the edge Worker folds a well-formed value into the KV key
   * (`workers/edge/src/index.js:51-53, 127`), which is how a batch mints warm
   * state without touching other runs' — or live visitors'. A page that
   * dropped it would send every batch, every post-deploy smoke and every
   * visitor through ONE infinite-TTL warm entry, and the warm column would
   * stop being reproducible in the way its receipt claims. This build dropped
   * it until the verification pass caught it, and the round-trip guard could
   * not see the loss because `run` was not a field of this type — the repo's
   * vacuity shape in a new place.
   */
  run: string;
  /** Forwarded facet params, in PLP_FACET_PARAMS order. */
  filters: readonly (readonly [string, string])[];
}

/** The Worker's own rule, re-implemented rather than guessed
 *  (`workers/edge/src/index.js:52-53`): a malformed value is ignored, exactly
 *  as the Worker ignores it, so the page and the plane agree about which key
 *  was served. Asserted against the Worker's regex by the guard. */
export const PLP_RUN_RE = /^[A-Za-z0-9._-]{1,64}$/;

/** Read the served condition out of a request's search params. Clamping here
 *  (rather than passing the raw string on) is what keeps the served page and
 *  the chrome's `environment` beacon tag talking about the same condition:
 *  the tag is derived from the URL by `knobTags`, never from what was served
 *  (`packages/measurement/src/beacon.ts:47-58`), so a page that ignored `?n=`
 *  would publish a tag that is simply false. */
export function readPlpCondition(params: URLSearchParams): PlpCondition {
  const filters: [string, string][] = [];
  for (const key of PLP_FACET_PARAMS) {
    const value = params.get(key);
    if (value !== null && value !== "") filters.push([key, value]);
  }
  const run = params.get("run") ?? "";
  return {
    n: clampPlpN(params.get("n")),
    page: clampPlpPage(params.get("page")),
    cache: params.get("cache") === "cold" ? "cold" : "default",
    run: PLP_RUN_RE.test(run) ? run : "",
    filters,
  };
}

/**
 * Next hands a route its query as an already-parsed object whose values may be
 * a string, an array (a repeated param), or undefined. This turns that shape
 * into the served condition, and it exists as a FUNCTION because all three PLP
 * routes need it and nothing could otherwise test that a route reads its query
 * at all: a page that ignored `?n=` entirely would serve n=24 while the
 * chrome's beacon tag published `n=240|cache=cold`, and every assertion in
 * this unit's guard would still pass (the same vacuity shape as five others it
 * found — asserting a constant rather than the mechanism that consumes it).
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

/** The data-plane URL for a condition: `/api/plp` plus the knobs, in a FIXED
 *  order so one condition is one URL (the Worker mints its KV key from the
 *  parsed knobs, but a stable request URL is what makes a receipt legible). */
export function plpApiPath(condition: PlpCondition): string {
  const params = new URLSearchParams();
  params.set("n", String(condition.n));
  params.set("page", String(condition.page));
  if (condition.cache === "cold") params.set("cache", "cold");
  if (condition.run !== "") params.set("run", condition.run);
  // `condition.filters` is deliberately NOT forwarded. The edge Worker reads
  // `n`, `page`, `run` and `cache`; forwarding the rest would not filter
  // anything, it would only make the request LOOK filtered — and worse, it
  // would make identical unfiltered payloads arrive under distinct request
  // URLs, which is what the TanStack arm keys its cache on. The client-cache
  // cell would then be measuring a cache miss it manufactured itself.
  //
  // The filters stay in `plpHistoryUrl` below: the address bar SHOULD keep
  // what the visitor asked for. Only the data-plane request drops them, and
  // only until ADR-0005 §5's params land in workers/edge — at which point
  // this line comes back and `plp-params-not-yet-honoured` (the guard in
  // this arm's suite) fails, on purpose, to say so.
  return `/api/plp?${params.toString()}`;
}

/** The BROWSER url for a condition — what a strategy pushes to history after
 *  answering a paginate click, so the address bar stays a receipt. Mirrors
 *  `pageHref`'s omissions deliberately (see its comment) plus `cache`, which
 *  a client-side page change must NOT silently drop: the reference's own
 *  hardcoded hrefs do drop it, and that is reported as a contract defect. */
export function plpHistoryUrl(condition: PlpCondition, defaultN: number): string {
  const params = new URLSearchParams();
  if (condition.page !== 1) params.set("page", String(condition.page));
  if (condition.n !== defaultN) params.set("n", String(condition.n));
  if (condition.cache === "cold") params.set("cache", "cold");
  // Carried for the same reason `cache` is: a client-side page change must not
  // silently move the visitor onto a different KV key than the one the URL
  // they were handed named. An earlier draft carried `cache` and not `run`,
  // with no comment saying why — which is what an oversight looks like next to
  // a decision.
  if (condition.run !== "") params.set("run", condition.run);
  for (const [key, value] of condition.filters) params.set(key, value);
  const query = params.toString();
  return query === "" ? "?" : `?${query}`;
}

/**
 * Do two conditions describe the same served state?
 *
 * Needed because a URL is not a canonical spelling of its condition: the
 * served `?n=24&run=abc&cache=cold` and this module's `?cache=cold&run=abc`
 * are the SAME condition in different orders, with the default `n` dropped.
 * String-comparing them says "different" and makes a client-side history
 * write fire for a page nobody navigated to — which is exactly what the first
 * draft of `usePushWhenSettled` did, on every bench-measured load.
 */
export function sameCondition(a: PlpCondition, b: PlpCondition): boolean {
  return (
    a.n === b.n &&
    a.page === b.page &&
    a.cache === b.cache &&
    a.run === b.run &&
    a.filters.length === b.filters.length &&
    a.filters.every(
      ([key, value], i) => b.filters[i]?.[0] === key && b.filters[i]?.[1] === value,
    )
  );
}

/** The cache key one condition occupies in a client data layer. Order is
 *  fixed for the same reason the Worker's KV key is: two spellings of one
 *  condition must not fork into two cache entries, or a "revisit" measures a
 *  miss and the published cell is a coin flip. */
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
 * It applies to the LEAD ONLY. An earlier draft of this comment said the
 * Apollo exhibit "is held to the same number so the two client caches differ
 * by library rather than by tuning" — the THIRD place that falsehood was
 * written (after the exhibit's own file header and the build log) and the last
 * one found. Apollo ships no `staleTime` at all: its window under
 * `cache-first` is unbounded, which `APOLLO_CACHE_WINDOW` states and a canary
 * pins. What the two arms hold equal is the POLICY SHAPE — cache-first, seeded
 * from the server, no hand-rolled TTL on either side.
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
