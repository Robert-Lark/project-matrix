/**
 * PLP — the catalogue under the data axis. The master renders the grid, the
 * count, the facet rail, the search and sort forms and the pagination for any
 * condition: (n, page, genre, style, format, sort, q), plus the three knobs
 * every in-surface href must carry (cache, run, profile).
 *
 * THE RAIL, THE SEARCH FORM AND THE SORT SELECT ARE BACK (2026-09-04), and
 * they were cut for a reason worth keeping in the file. Between 2026-08-29
 * and this commit the master rendered none of them: `workers/edge` read `n`,
 * `page`, `run` and `cache` and nothing else, so every one of those controls
 * navigated to a filtered URL and got the UNFILTERED grid back, under a
 * toolbar still reading "Showing 1–24 of 500 releases", with no error state.
 * The map's own rule (`decision-map.md`, pdp-controls): either the controls
 * become real in all variants, or they are removed from the master and the
 * CSS so no variant copies them. They are real now — ADR-0005 §5's five
 * params are honoured by the data plane, and the data-plane semantics the
 * grid is rendered from are THIS package's own (`plp-query.mjs`), imported by
 * the Worker rather than re-typed, so the master and the served page cannot
 * disagree about what a filtered condition contains.
 *
 * Facet display rule (stated, not silent): all genres, top 12 styles, top 8
 * formats — each group titled with its cut. Counts are the tray's facet
 * buckets, RECOUNTED over the filtered set (plp-query.mjs). The selected value
 * is always listed: if it ranks outside its group's cut it is appended after
 * the cut. A selected facet carries `aria-current="true"` and its href
 * REMOVES its own param — the same link toggles it off.
 *
 * Image loading contract (pinned): first 4 card images eager, card 1
 * fetchpriority="high", the rest loading="lazy" decoding="async".
 */
import { esc } from "./lib.mjs";
import { page, releaseCard } from "./shell.mjs";
import { PLP_SORTS, applyPlpQuery, normalizeQ } from "./plp-query.mjs";

export const PER_PAGE = 24;
export const STYLE_CUT = 12;
export const FORMAT_CUT = 8;

/** The sort select's options, in order. The default is the snapshot's
 *  committed order, which is id-ascending (snapshot-capture normalize.ts) —
 *  the pre-2026-08-29 master labelled it "Popularity", which it is not. */
export const SORT_OPTIONS = Object.freeze([
  ["", "Catalogue order"],
  ["year-desc", "Year — newest first"],
  ["year-asc", "Year — oldest first"],
  ["price-asc", "Price — low to high"],
  ["price-desc", "Price — high to low"],
  ["title", "Title — A to Z"],
]);

/**
 * THE ONE HREF RULE — for pagination, facets, both forms' hidden inputs, and
 * every variant's client-side history write. A condition is spelled with its
 * knobs in this order, every knob omitted at its default, and the default
 * condition itself spelled `?page=1` so that no link is ever a bare `?`.
 *
 * It replaces two rules: `pageHref` carried `page` and `n` only, so a
 * page-flip from `?cache=cold` landed on the WARM tier while the injected
 * chrome — rendered against the original search, outside the swapped
 * subtree — still read `cache: cold` (PLP handoff §6.2(ii): the address bar
 * and the instrument disagreeing about one visit, in the flattering
 * direction). A query-only relative reference REPLACES the whole query
 * string (RFC 3986 §5.3), so the knobs must be carried explicitly.
 *
 * Spelling is `URLSearchParams`' (`+` for a space, `%2C` for a comma): the
 * same encoding a browser applies to a GET form submit, so a JS-off search
 * and a JS-on push reach the address bar with one spelling.
 *
 * `profile` is the chrome's snapshot selector (ADR-0004 §5/§6) and `run` the
 * harness nonce; both are opaque here and carried only when well-formed.
 */
export const PLP_PARAM_ORDER = Object.freeze([
  "page", "n", "cache", "run", "profile", "genre", "style", "format", "sort", "q",
]);
const CARRY_RE = /^[A-Za-z0-9._-]{1,64}$/;

export function conditionHref(condition) {
  const params = new URLSearchParams();
  const pageNo = condition.page ?? 1;
  if (pageNo !== 1) params.set("page", String(pageNo));
  if ((condition.n ?? PER_PAGE) !== PER_PAGE) params.set("n", String(condition.n));
  if (condition.cache === "cold") params.set("cache", "cold");
  if (condition.run && CARRY_RE.test(condition.run)) params.set("run", condition.run);
  if (condition.profile && CARRY_RE.test(condition.profile)) params.set("profile", condition.profile);
  for (const key of ["genre", "style", "format", "sort", "q"]) {
    if (condition[key]) params.set(key, condition[key]);
  }
  const query = params.toString();
  return query === "" ? "?page=1" : `?${query}`;
}

/** The hidden inputs a GET form carries so a submit keeps the condition it
 *  was made from. `page` is never carried — a new filter, sort or search
 *  starts at page 1 — and the form's own control (`q` or `sort`) is skipped
 *  because the visible field supplies it. Canonical order, so the browser's
 *  DOM-order serialization spells the URL the way `conditionHref` does. */
function hiddenKnobs(condition, own) {
  // Two halves, because a browser serializes a GET form in TREE order: the
  // knobs that canonically precede the form's own control go before it, the
  // ones that follow it (the sort form's `q`) go AFTER it. The first draft
  // emitted every hidden input first, so a JS-off sort submit with a search
  // applied spelled `…&q=…&sort=…` — a third spelling of one condition the
  // href rule exists to prevent (verify-slice, 2026-09-18).
  const before = [];
  const after = [];
  const field = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
  if ((condition.n ?? PER_PAGE) !== PER_PAGE) before.push(field("n", String(condition.n)));
  if (condition.cache === "cold") before.push(field("cache", "cold"));
  if (condition.run && CARRY_RE.test(condition.run)) before.push(field("run", condition.run));
  if (condition.profile && CARRY_RE.test(condition.profile)) before.push(field("profile", condition.profile));
  const knobs = ["genre", "style", "format", "sort", "q"];
  const ownAt = knobs.indexOf(own);
  knobs.forEach((key, i) => {
    if (key === own || !condition[key]) return;
    (i < ownAt ? before : after).push(field(key, condition[key]));
  });
  return { before, after };
}

function facetGroup(title, param, buckets, cut, condition) {
  const selected = condition[param] ?? null;
  let shown = cut ? buckets.slice(0, cut) : buckets;
  if (selected !== null && !shown.some((b) => b.value === selected)) {
    const own = buckets.find((b) => b.value === selected);
    if (own) shown = [...shown, own];
  }
  const cutNote = cut && buckets.length > cut ? ` · top ${cut} of ${buckets.length}` : "";
  const facet = (b) => {
    const isSelected = b.value === selected;
    const href = conditionHref({ ...condition, page: 1, [param]: isSelected ? null : b.value });
    return `<li><a class="pm-facets__facet" href="${esc(href)}"${isSelected ? ` aria-current="true"` : ""}>
              <span class="pm-facets__value">${esc(b.value)}</span>
              <span class="pm-facets__count">${b.count}</span></a></li>`;
  };
  return `<section class="pm-facets__group">
          <h3 class="pm-facets__title">${esc(title)}${cutNote}</h3>
          <ul class="pm-facets__list" role="list">
            ${shown.map(facet).join("\n            ")}
          </ul>
        </section>`;
}

/**
 * The `.pm-plp` block for a tray + the knobs its hrefs carry. Exported so a
 * guard can render the CONTRACT for any payload — including the ones a
 * committed master cannot express (page 2, a filter, a search) — and hold
 * both arms to it.
 *
 * `payload` is `GET /api/plp`'s tray (`plp-query.mjs applyPlpQuery`), which
 * carries the applied query; the rail's selected facet, the select's chosen
 * option and the search box's value all come from `payload.applied`, never
 * from the URL — see PlpApplied in @pm/data-contract for why.
 */
export function renderPlpBlock(payload, { origin = "", cache, run, profile } = {}) {
  const { items, page: current, perPage: n, total, totalPages, facets, applied } = payload;
  const condition = { n, page: current, cache, run, profile, ...applied };
  const start = (current - 1) * n;

  const cards = items
    .map((s, i) => {
      const attrs =
        i === 0
          ? `\n       fetchpriority="high" sizes="(max-width: 40em) 50vw, (max-width: 52em) 33vw, 240px"`
          : i < 4
            ? `\n       sizes="(max-width: 40em) 50vw, (max-width: 52em) 33vw, 240px"`
            : `\n       loading="lazy" decoding="async" sizes="(max-width: 40em) 50vw, (max-width: 52em) 33vw, 240px"`;
      return releaseCard(s, { imgAttrs: attrs, origin });
    })
    .join("\n");

  // An out-of-range page answers with an empty `items` array (the edge
  // Worker floors `page` at 1; the ceiling is applied on the way out — a
  // page past the end is served but never cached), and the arithmetic range
  // would read BACKWARDS — "Showing 241–240 of 240". An empty page shows
  // "0", which is true.
  const range = items.length ? `${start + 1}–${start + items.length}` : "0";

  // A five-wide window that CONTAINS the current page, clamped to the ends.
  // The naive `1..min(totalPages, 5)` is correct only on page 1: from page 6
  // on, nothing in the window matched the current page, so the nav carried NO
  // `aria-current="page"` at all and offered no route past 5. At page 1 this
  // window is `1..5` (and `1..1` at n=240), which is why it is byte-identical
  // to what the committed master already holds.
  const first = Math.min(Math.max(current - 2, 1), Math.max(totalPages - 4, 1));
  const pages = Array.from(
    { length: Math.min(5, Math.max(totalPages - first + 1, 1)) },
    (_, i) => first + i,
  );
  const pageLink = (p) =>
    p === current
      ? `<span class="pm-pagination__link pm-pagination__link--current" aria-current="page">${p}</span>`
      : `<a class="pm-pagination__link" href="${esc(conditionHref({ ...condition, page: p }))}">${p}</a>`;

  // "Next" is emitted only when a next page exists — otherwise it walked
  // forever into empty pages, and the two arms that mirror this file had
  // guessed differently about what to do there (2026-08-29).
  const hasNext = current < totalPages;
  // An EMPTY RESULT (a filter combination or search matching nothing) has no
  // pages, so it has no pagination landmark at all: a lone current "1" over
  // "Showing 0 of 0 releases" is page 1 of 0, and the arms-agree guard found
  // the two arms disagreeing about it the day the filters landed (the
  // reference floored the window at one link; react-next rendered an empty
  // nav). Neither is what a visitor needs. A page PAST THE END of a
  // non-empty result keeps its nav (the real pages are one click away).

  const searchHidden = hiddenKnobs(condition, "q");
  const sortHidden = hiddenKnobs(condition, "sort");
  const qValue = applied.q ? ` value="${esc(applied.q)}"` : "";
  const options = SORT_OPTIONS.map(
    ([value, label]) =>
      `<option value="${value}"${(applied.sort ?? "") === value ? " selected" : ""}>${esc(label)}</option>`,
  );

  return `      <div class="pm-plp">
        <header class="pm-plp__head">
          <h1 class="pm-page__title">Records</h1>
          <div class="pm-toolbar">
            <p class="pm-toolbar__count">Showing <span class="pm-toolbar__n">${range}</span> of <span class="pm-toolbar__n">${total}</span> releases</p>
            <form class="pm-toolbar__search" method="get" action="">${searchHidden.before.map((f) => `\n              ${f}`).join("")}
              <div>
                <label class="pm-toolbar__label" for="plp-q">Search the crate</label>
                <input class="pm-toolbar__input" id="plp-q" name="q" type="search" autocomplete="off"${qValue}>
              </div>${searchHidden.after.map((f) => `\n              ${f}`).join("")}
              <button class="pm-button pm-button--secondary" type="submit">Search</button>
            </form>
            <form class="pm-toolbar__sort" method="get" action="">${sortHidden.before.map((f) => `\n              ${f}`).join("")}
              <div>
                <label class="pm-toolbar__label" for="plp-sort">Sort</label>
                <select class="pm-toolbar__select" id="plp-sort" name="sort">
                  ${options.join("\n                  ")}
                </select>
              </div>${sortHidden.after.map((f) => `\n              ${f}`).join("")}
              <button class="pm-button pm-button--secondary" type="submit">Apply</button>
            </form>
          </div>
        </header>
        <div class="pm-plp__body">
          <nav class="pm-facets" aria-label="Filters">
            ${facetGroup("Genre", "genre", facets.genres, 0, condition)}
            ${facetGroup("Style", "style", facets.styles, STYLE_CUT, condition)}
            ${facetGroup("Format", "format", facets.formats, FORMAT_CUT, condition)}
          </nav>
          <div class="pm-plp__results">
            <ul class="pm-grid" role="list">
${cards}
            </ul>${
              totalPages > 0
                ? `
            <nav class="pm-pagination" aria-label="Pages">
              ${pages.map(pageLink).join("\n              ")}${
                hasNext
                  ? `\n              <a class="pm-pagination__link" href="${esc(conditionHref({ ...condition, page: current + 1 }))}" rel="next">Next</a>`
                  : ""
              }
            </nav>`
                : ""
            }
          </div>
        </div>
      </div>`;
}

/** The PLP's own sheets, after the shell's (shell.mjs head()). */
export const PLP_CSS = Object.freeze([
  "components/release-card.css",
  "components/facets.css",
  "components/toolbar.css",
  "components/pagination.css",
  "surfaces/plp.css",
]);

export function renderPlp(
  snapshot,
  {
    origin = "",
    n = PER_PAGE,
    page: current = 1,
    genre = null,
    style = null,
    format = null,
    sort = null,
    q = null,
    cache,
    run,
    profile,
    extraDepth = 0,
  } = {},
) {
  if (sort !== null && !PLP_SORTS.includes(sort)) throw new Error(`unknown sort: ${sort}`);
  const payload = applyPlpQuery(snapshot.summaries, {
    n,
    page: current,
    genre,
    style,
    format,
    sort,
    q: normalizeQ(q),
  });
  const content = renderPlpBlock(payload, { origin, cache, run, profile });

  return page({
    title: `Records — Long Decay Records`,
    depth: 2 + extraDepth,
    css: [...PLP_CSS],
    current: "plp",
    content,
  });
}
