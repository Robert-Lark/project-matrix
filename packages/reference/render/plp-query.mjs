/**
 * The PLP query semantics — filter, search, sort, facet recount, slice — as
 * ONE pure module (ADR-0005 §5, implemented 2026-09-04; the addendum of that
 * date records the two decisions this file embodies).
 *
 * Two consumers, one function: the reference renderer (`plp.mjs`, the markup
 * contract of record) and the edge Worker (`workers/edge/src/index.js`, the
 * data plane that serves every variant). Before this module the Worker
 * RE-TYPED the reference's facet comparator and nothing compared the two —
 * the react-next identity guard's own header counts the eight `computeFacets`
 * hits at its base commit and finds "not one assertion". Filtering and
 * sorting would have been a second and third copy of the same class. So the
 * spec's own function serves the data: the Worker cannot disagree with the
 * master about what a filtered page contains, because it does not have its
 * own opinion.
 *
 * Deliberately IMPORT-FREE and platform-neutral: no `node:` module, no DOM,
 * no `Intl`, so it bundles into a Worker (wrangler/esbuild) and loads under
 * plain Node (the reference build, every pre-merge guard) identically.
 *
 * DETERMINISM RULES, each the answer to a recorded defect:
 *  - Comparators use CODE-UNIT order, never `localeCompare`: on the real
 *    crate the two disagreed at four positions and `localeCompare` is
 *    ICU-version-dependent — nondeterminism in a byte-pinned regeneration
 *    test (verify-slice F7, 2026-08-28).
 *  - Case folding is ASCII-only (`[A-Z]`), never `toLowerCase()`: full
 *    Unicode case mapping rides the engine's Unicode tables and can move
 *    between runtimes. The honest boundary: search is case-insensitive for
 *    A–Z and exact for every other script.
 *  - Ties break on committed order by EXPLICIT index, not on the engine's
 *    sort stability. (Every modern engine's sort is stable; the rule is
 *    stated here so the guarantee is this file's, not the runtime's.)
 *
 * The committed order is id-ascending — "the one neutral, deterministic
 * order that is not a presentation choice" (snapshot-capture normalize.ts).
 * It is NOT popularity, and the UI must not call it that.
 */

/**
 * The summary fields the query semantics READ — the slice of
 * @pm/data-contract's ReleaseSummary this module depends on, named here
 * because the module is import-free by design (above) and the edge Worker
 * checks itself against these signatures (`tsc --checkJs`, workers-hardening
 * 2026-09-25; ADR-0004 addendum). A field the contract renames fails the
 * reference's own master-regeneration test long before it fails here.
 * @typedef {object} PlpSummary
 * @property {number} id
 * @property {string} title
 * @property {string} artist
 * @property {number | null} year
 * @property {{ amount: number, currency: string } | null} priceFrom
 * @property {string[]} genres
 * @property {string[]} styles
 * @property {string} format
 */
/** @typedef {"genre" | "style" | "format"} PlpFacetParam */
/** @typedef {"year-desc" | "year-asc" | "price-asc" | "price-desc" | "title"} PlpSort */
/**
 * The served condition, parsed and clamped by the caller: `null` for an
 * unapplied knob.
 * @typedef {object} PlpQuery
 * @property {number} n
 * @property {number} page
 * @property {string | null} genre
 * @property {string | null} style
 * @property {string | null} format
 * @property {PlpSort | null} sort
 * @property {string | null} q
 */
/** @typedef {{ value: string, count: number }} PlpFacetBucket */
/**
 * `GET /api/plp`'s payload, exactly — the `PlpPage` contract.
 * @typedef {object} PlpPage
 * @property {PlpSummary[]} items
 * @property {number} page
 * @property {number} perPage
 * @property {number} total
 * @property {number} totalPages
 * @property {{ genres: PlpFacetBucket[], styles: PlpFacetBucket[], formats: PlpFacetBucket[] }} facets
 * @property {{ genre: string | null, style: string | null, format: string | null, sort: PlpSort | null, q: string | null }} applied
 */

/**
 * THE TRAY'S SHAPE VERSION — the edge Worker's KV key prefix (`v2:/api/plp…`).
 *
 * KV entries for visitor-facing conditions have NO TTL (frozen data), so a
 * tray warmed before a deploy is served after it. When this module changes
 * what `applyPlpQuery` returns, every such entry becomes a payload the
 * renderers no longer understand — the 2026-09-04 change added `applied`,
 * and under an unchanged prefix the default condition's pre-deploy entry
 * would have crashed both arms on `applied.q` for every visitor until a
 * manual flush. Bumping this constant moves every key; the old entries
 * simply stop being reachable. It is the shape's version, so it lives beside
 * the shape: change `applyPlpQuery`'s output, bump this, in one commit.
 */
export const PLP_TRAY_VERSION = 2;

/** ADR-0005 §5's three facet params, in canonical order. */
export const PLP_FACET_PARAMS = /** @type {readonly PlpFacetParam[]} */ (
  Object.freeze(["genre", "style", "format"])
);

/** The sort orders the data plane implements. Absent = committed order. */
export const PLP_SORTS = /** @type {readonly PlpSort[]} */ (
  Object.freeze(["year-desc", "year-asc", "price-asc", "price-desc", "title"])
);

/** Is this string one of PLP_SORTS? The Worker's 400 turns on it, and the
 *  narrowing lets the query carry the sort as the type it is.
 *  @param {string} value
 *  @returns {value is PlpSort} */
export function isPlpSort(value) {
  return /** @type {readonly string[]} */ (PLP_SORTS).includes(value);
}

/** `q` is trimmed, whitespace-collapsed and capped here; the cap bounds the
 *  Worker's work per request (search is never cached — see the Worker). */
export const PLP_Q_MAX = 64;

/** Format descriptors ride in the summary's format string ("Vinyl, LP,
 *  Album, Reissue"); the LEADING carrier token is not a facet — dropped
 *  positionally, never by a hardcoded carrier name. */
/** @param {PlpSummary} summary @returns {string[]} */
export function formatDescriptors(summary) {
  return summary.format.split(", ").slice(1);
}

/** @type {Readonly<Record<PlpFacetParam, (s: PlpSummary) => string[]>>} */
const PICK = Object.freeze({
  genre: (s) => s.genres,
  style: (s) => s.styles,
  format: formatDescriptors,
});

/** ASCII-only case fold — see the header for why not `toLowerCase()`.
 *  @param {string} text */
export function foldAscii(text) {
  return text.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** The applied form of a raw `q`: whitespace collapsed, trimmed, capped at
 *  PLP_Q_MAX code units, trimmed again (the cap can expose a trailing space).
 *  `null` when nothing is left — an empty search box is not a filter. */
/** @param {string | null | undefined} raw @returns {string | null} */
export function normalizeQ(raw) {
  if (raw === null || raw === undefined) return null;
  const q = String(raw).replace(/\s+/g, " ").trim().slice(0, PLP_Q_MAX).trimEnd();
  return q === "" ? null : q;
}

/** `?page=`: a positive integer, floored at 1 — junk, 0 and negatives are
 *  page 1 — and capped at `Number.MAX_SAFE_INTEGER`, because `parseInt` of
 *  309+ digits is `Infinity`, which JSON writes as `null` and the `PlpPage`
 *  contract rejects (verify-slice, 2026-09-18). The cap keeps the semantics
 *  honest: an absurd page is still "past the end" — an empty page, never
 *  page 1 — and the Worker's ceiling (`cacheable`) never stores it. The
 *  edge Worker imports this; react-next re-types it as `clampPlpPage` and
 *  pins the two equal over a table. */
/** @param {string | null | undefined} raw */
export function clampPage(raw) {
  const parsed = parseInt(raw ?? "", 10) || 1;
  return Math.min(Math.max(parsed, 1), Number.MAX_SAFE_INTEGER);
}

/** The distinct facet values a snapshot actually holds, per param — the
 *  validation sets. A value outside them is junk (ADR-0005 §5: a 400, never a
 *  KV key). */
/** @param {readonly PlpSummary[]} summaries @returns {Record<PlpFacetParam, Set<string>>} */
export function facetValueSets(summaries) {
  /** @type {Record<PlpFacetParam, Set<string>>} */
  const sets = { genre: new Set(), style: new Set(), format: new Set() };
  for (const s of summaries) {
    for (const param of PLP_FACET_PARAMS) for (const v of PICK[param](s)) sets[param].add(v);
  }
  return sets;
}

/** Facet buckets over `items`: count desc, then code-unit asc on the value.
 *  @param {readonly PlpSummary[]} items
 *  @param {(s: PlpSummary) => string[]} pick
 *  @returns {PlpFacetBucket[]} */
export function facetBuckets(items, pick) {
  /** @type {Map<string, number>} */
  const buckets = new Map();
  for (const s of items) {
    for (const v of pick(s)) buckets.set(v, (buckets.get(v) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([value, n]) => ({ value, count: n }));
}

/** Nulls last in EITHER direction: an unpriced record is not the cheapest
 *  and an undated one is not the newest.
 *  @template T
 *  @param {T | null} a
 *  @param {T | null} b
 *  @param {(x: T, y: T) => number} compare */
function nullsLast(a, b, compare) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b);
}

/** @type {Readonly<Record<PlpSort, (a: PlpSummary, b: PlpSummary) => number>>} */
const COMPARE = Object.freeze({
  "year-desc": (a, b) => nullsLast(a.year, b.year, (x, y) => y - x),
  "year-asc": (a, b) => nullsLast(a.year, b.year, (x, y) => x - y),
  // Amount only: the frozen crate is single-currency (USD throughout, both
  // snapshots). A mixed-currency crate would need a conversion rule here
  // before this sort could be honest; stated so nobody assumes it exists.
  "price-asc": (a, b) => nullsLast(a.priceFrom, b.priceFrom, (x, y) => x.amount - y.amount),
  "price-desc": (a, b) => nullsLast(a.priceFrom, b.priceFrom, (x, y) => y.amount - x.amount),
  title: (a, b) => {
    const x = foldAscii(a.title);
    const y = foldAscii(b.title);
    return x < y ? -1 : x > y ? 1 : 0;
  },
});

/** Sort with an explicit committed-order tie-break; `null` keeps committed
 *  order untouched. Throws on an unknown sort — validation is the caller's
 *  (the Worker 400s before it gets here; the reference is a spec renderer). */
/** @param {readonly PlpSummary[]} items @param {string | null | undefined} sort @returns {readonly PlpSummary[]} */
export function sortSummaries(items, sort) {
  if (sort === null || sort === undefined) return items;
  if (!isPlpSort(sort)) throw new Error(`unknown sort: ${sort}`);
  const compare = COMPARE[sort];
  return items
    .map((s, index) => ({ s, index }))
    .sort((a, b) => compare(a.s, b.s) || a.index - b.index)
    .map(({ s }) => s);
}

/**
 * The tray for one condition — `GET /api/plp`'s payload, exactly.
 *
 * `query` = `{ n, page, genre, style, format, sort, q }` with `null` for an
 * unapplied knob; `n` and `page` already clamped by the caller (`clampN` is
 * the shared knob in @pm/measurement; `page` is floored at 1 by the Worker
 * and applied as given by the reference). `q` must already be normalized
 * (`normalizeQ`) — it is echoed into `applied` as given.
 *
 * FACET RECOUNT (ADR-0005 addendum Q1): each group is counted over the items
 * that pass every applied filter EXCEPT that group's own. In the group you
 * filtered by, every value compatible with the other filters stays listed
 * with the count you would get by SWITCHING to it; in the other groups a
 * count is what you get by ADDING that facet. A bucket with zero items is not
 * listed — with ONE exception: the selected value is always listed, so the
 * rail always offers the toggle-off. When an intersection is empty
 * (`genre=Jazz&style=Minimal` with no such record) the recount leaves the
 * selected value no bucket, and without the exception every renderer drew a
 * rail with no marked facet and no link that removed either filter
 * (verify-slice, 2026-09-18). That bucket reads 0 — the one zero a rail may
 * show, and exactly what keeping the selection returns. Unfiltered, this is
 * the whole-crate count, so the committed master (the default condition) is
 * unchanged by the rule.
 */
/** @param {readonly PlpSummary[]} summaries @param {PlpQuery} query @returns {PlpPage} */
export function applyPlpQuery(summaries, query) {
  const { n, page } = query;
  /** @type {Record<PlpFacetParam, string | null>} */
  const filters = {
    genre: query.genre ?? null,
    style: query.style ?? null,
    format: query.format ?? null,
  };
  const sort = query.sort ?? null;
  const q = query.q ?? null;
  const qFolded = q === null ? null : foldAscii(q);

  /** @param {PlpSummary} s @param {PlpFacetParam | null} except */
  const passes = (s, except) => {
    for (const param of PLP_FACET_PARAMS) {
      if (param === except || filters[param] === null) continue;
      if (!PICK[param](s).includes(filters[param])) return false;
    }
    if (qFolded !== null) {
      return foldAscii(s.title).includes(qFolded) || foldAscii(s.artist).includes(qFolded);
    }
    return true;
  };

  const matched = summaries.filter((s) => passes(s, null));
  const facets = {
    genres: facetBuckets(filters.genre === null ? matched : summaries.filter((s) => passes(s, "genre")), PICK.genre),
    styles: facetBuckets(filters.style === null ? matched : summaries.filter((s) => passes(s, "style")), PICK.style),
    formats: facetBuckets(filters.format === null ? matched : summaries.filter((s) => passes(s, "format")), PICK.format),
  };
  // The selected value is always listed (the header's one exception). It can
  // be missing only when `matched` is empty — every matched item carries the
  // selected value, so a non-empty result always has its bucket — and then
  // the honest count for "keep this selected" is 0.
  /** @type {[PlpFacetParam, keyof PlpPage["facets"]][]} */
  const groups = [["genre", "genres"], ["style", "styles"], ["format", "formats"]];
  for (const [param, group] of groups) {
    const selected = filters[param];
    if (selected !== null && !facets[group].some((b) => b.value === selected)) {
      facets[group].push({ value: selected, count: matched.length });
    }
  }

  const ordered = sortSummaries(matched, sort);
  const total = ordered.length;
  const start = (page - 1) * n;
  return {
    items: ordered.slice(start, start + n),
    page,
    perPage: n,
    total,
    totalPages: Math.ceil(total / n),
    facets,
    applied: { genre: filters.genre, style: filters.style, format: filters.format, sort, q },
  };
}
