/**
 * PLP — the catalogue under the data axis. The master renders the grid, the
 * count and the pagination for any (n, page).
 *
 * NO FACET RAIL, NO SEARCH FORM, NO SORT SELECT, and that is a scope cut
 * taken explicitly rather than a gap. They were here — rendered by every
 * variant that mirrors this file — as a pin on the URL shape ADR-0005 §5
 * specifies (`?genre= ?style= ?format= ?sort= ?q=`), written ahead of the
 * edge Worker that would honour them. `workers/edge` handlePlp reads `n`,
 * `page`, `run` and `cache` and nothing else, so every one of those controls
 * navigated to a filtered URL and got the UNFILTERED grid back, under a
 * toolbar still reading "Showing 1–24 of 500 releases", with no error state.
 * A silently wrong answer is the worst outcome this project has.
 *
 * The rule is this map's own, set by `pdp-controls` for the dead Zoom button
 * and the inert format group (`decision-map.md:323`): "either the controls
 * become real in all variants, or the scope cut is taken explicitly and the
 * dead controls are REMOVED from the master and the CSS so no variant copies
 * them. Shipping them inert is the falsely-interactive state." Implementing
 * §5 instead is a UNIT, not a merge fix — it needs a facet-value validation
 * path, a KV-key cardinality policy for five new params, and an ADR-0005
 * answer on whether a filtered response recounts its facets and whether
 * `PlpPage` grows a field naming the applied filters.
 *
 * Cutting now is also the honest moment: NO PLP number is published yet, so
 * nothing is invalidated — and measuring a page whose largest DOM subtree is
 * an inert rail would have priced a page the finished product never serves.
 * The rail, `components/facets.css` and the toolbar's search/sort rules come
 * back with the params, in one commit, working.
 *
 * Image loading contract (pinned): first 4 card images eager, card 1
 * fetchpriority="high", the rest loading="lazy" decoding="async".
 */
import { page, releaseCard } from "./shell.mjs";

const PER_PAGE = 24;

/** Pagination hrefs carry `page` and `n` — the two knobs this nav moves.
 *  `n` rides along whenever it differs from the default; a hardcoded
 *  ?page=N silently reset the visitor's density (verify-slice).
 *
 *  What they do NOT carry, stated because the comment here used to claim
 *  otherwise: a query-only relative reference REPLACES the whole query
 *  string, so `cache`, `run` and `profile` are dropped on every page-flip.
 *  That is a real gap against URL-as-receipt (ADR-0004 §5) and it is the
 *  same gap in all three renderers, which is why it is recorded here rather
 *  than fixed in one of them. */
function pageHref(page, n) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (n !== PER_PAGE) params.set("n", String(n));
  return `?${params.toString()}`;
}

export function renderPlp(
  snapshot,
  { origin = "", n = PER_PAGE, page: current = 1, extraDepth = 0 } = {},
) {
  const total = snapshot.summaries.length;
  const totalPages = Math.ceil(total / n);
  const start = (current - 1) * n;
  const items = snapshot.summaries.slice(start, start + n);

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
  // Worker floors `page` at 1 and applies no ceiling), and the arithmetic
  // range then reads BACKWARDS — "Showing 241–240 of 240". An empty page
  // shows "0", which is true.
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
      : `<a class="pm-pagination__link" href="${pageHref(p, n)}">${p}</a>`;

  // "Next" is emitted only when a next page exists. It used to be
  // unconditional, which at n=240 pointed at an empty page and let a visitor
  // walk forever past the end of the crate — and because the master could
  // only ever render page 1, the two variants that mirror it had to guess
  // what to do above it, and guessed DIFFERENTLY: react-next emitted the
  // link unconditionally and rendered "0–0"; htmx gated it and rendered "0".
  // Two arms serving structurally different DOM for the same URL is exactly
  // what the canonical markup contract exists to prevent, so the fix belongs
  // here, in the one file both mirror, and not in either of them.
  const hasNext = current < totalPages;

  const content = `      <div class="pm-plp">
        <header class="pm-plp__head">
          <h1 class="pm-page__title">Records</h1>
          <div class="pm-toolbar">
            <p class="pm-toolbar__count">Showing <span class="pm-toolbar__n">${range}</span> of <span class="pm-toolbar__n">${total}</span> releases</p>
          </div>
        </header>
        <div class="pm-plp__body">
          <div class="pm-plp__results">
            <ul class="pm-grid" role="list">
${cards}
            </ul>
            <nav class="pm-pagination" aria-label="Pages">
              ${pages.map(pageLink).join("\n              ")}${
                hasNext
                  ? `\n              <a class="pm-pagination__link" href="${pageHref(current + 1, n)}" rel="next">Next</a>`
                  : ""
              }
            </nav>
          </div>
        </div>
      </div>`;

  return page({
    title: `Records — Long Decay Records`,
    depth: 2 + extraDepth,
    css: [
      "components/release-card.css",
      "components/toolbar.css",
      "components/pagination.css",
      "surfaces/plp.css",
    ],
    current: "plp",
    content,
  });
}
