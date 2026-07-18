/**
 * PLP — the catalogue under the data axis. The master renders the default
 * condition (n=24, page 1, unfiltered); facets/sort/search are NAVIGATION
 * (ADR-0005 §5: every strategy delegates to the data plane; the canonical
 * params are ?genre= ?style= ?format= ?sort= ?q=, implemented by the PLP
 * build's edge-Worker contract — the markup pins the URL shape now).
 *
 * Image loading contract (pinned): first 4 card images eager, card 1
 * fetchpriority="high", the rest loading="lazy" decoding="async".
 *
 * Facet display rule (stated, not silent): all genres, top 12 styles, top 8
 * formats — each group titled with its cut. Counts render from the tray's
 * facet buckets.
 */
import { esc } from "./lib.mjs";
import { page, releaseCard } from "./shell.mjs";

const PER_PAGE = 24;
const STYLE_CUT = 12;
const FORMAT_CUT = 8;

/** The same facet computation the edge Worker ships (workers/edge
 *  computeFacets): count desc, CODE-UNIT tie-break — the comparator must
 *  match the Worker byte-for-byte or the crate-plane drift leg diverges
 *  (verify-slice F7: localeCompare disagreed at 4 positions on the real
 *  crate and is ICU-version-dependent — nondeterminism in a byte-pinned
 *  regeneration test). */
function computeFacets(summaries) {
  const count = (pick) => {
    const m = new Map();
    for (const s of summaries) for (const v of pick(s)) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()]
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
  };
  return {
    genres: count((s) => s.genres),
    styles: count((s) => s.styles),
    formats: count((s) => s.format.split(", ").slice(1)),
  };
}

function facetGroup(title, param, buckets, cut) {
  const shown = cut ? buckets.slice(0, cut) : buckets;
  const cutNote = cut && buckets.length > cut ? ` · top ${cut} of ${buckets.length}` : "";
  return `<section class="pm-facets__group">
          <h3 class="pm-facets__title">${esc(title)}${cutNote}</h3>
          <ul class="pm-facets__list" role="list">
            ${shown
              .map(
                (b) => `<li><a class="pm-facets__facet" href="?${param}=${encodeURIComponent(b.value)}">
              <span class="pm-facets__value">${esc(b.value)}</span>
              <span class="pm-facets__count">${b.count}</span></a></li>`,
              )
              .join("\n            ")}
          </ul>
        </section>`;
}

/** Pagination hrefs preserve the WHOLE condition (URL-as-receipt, ADR-0004
 *  §5): n rides along whenever it differs from the default — hardcoded
 *  ?page=N silently reset the visitor's condition (verify-slice). */
function pageHref(page, n) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (n !== PER_PAGE) params.set("n", String(n));
  return `?${params.toString()}`;
}

export function renderPlp(snapshot, { origin = "", n = PER_PAGE, extraDepth = 0 } = {}) {
  const items = snapshot.summaries.slice(0, n);
  const total = snapshot.summaries.length;
  const totalPages = Math.ceil(total / n);
  const facets = computeFacets(snapshot.summaries);

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

  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1);

  const content = `      <div class="pm-plp">
        <header class="pm-plp__head">
          <h1 class="pm-page__title">Records</h1>
          <div class="pm-toolbar">
            <p class="pm-toolbar__count">Showing <span class="pm-toolbar__n">1–${items.length}</span> of <span class="pm-toolbar__n">${total}</span> releases</p>
            <form class="pm-toolbar__search" method="get" action="">
              <div>
                <label class="pm-toolbar__label" for="plp-q">Search the crate</label>
                <input class="pm-toolbar__input" id="plp-q" name="q" type="search" autocomplete="off">
              </div>
              <button class="pm-button pm-button--secondary" type="submit">Search</button>
            </form>
            <form class="pm-toolbar__sort" method="get" action="">
              <div>
                <label class="pm-toolbar__label" for="plp-sort">Sort</label>
                <select class="pm-toolbar__select" id="plp-sort" name="sort">
                  <option value="" selected>Popularity</option>
                  <option value="year-desc">Year — newest first</option>
                  <option value="year-asc">Year — oldest first</option>
                  <option value="price-asc">Price — low to high</option>
                  <option value="price-desc">Price — high to low</option>
                  <option value="title">Title — A to Z</option>
                </select>
              </div>
              <button class="pm-button pm-button--secondary" type="submit">Apply</button>
            </form>
          </div>
        </header>
        <div class="pm-plp__body">
          <nav class="pm-facets" aria-label="Filters">
            ${facetGroup("Genre", "genre", facets.genres)}
            ${facetGroup("Style", "style", facets.styles, STYLE_CUT)}
            ${facetGroup("Format", "format", facets.formats, FORMAT_CUT)}
          </nav>
          <div class="pm-plp__results">
            <ul class="pm-grid" role="list">
${cards}
            </ul>
            <nav class="pm-pagination" aria-label="Pages">
              <span class="pm-pagination__link pm-pagination__link--current" aria-current="page">1</span>
              ${pages
                .slice(1)
                .map((p) => `<a class="pm-pagination__link" href="${pageHref(p, n)}">${p}</a>`)
                .join("\n              ")}
              <a class="pm-pagination__link" href="${pageHref(2, n)}" rel="next">Next</a>
            </nav>
          </div>
        </div>
      </div>`;

  return page({
    title: `Records — Long Decay Records`,
    depth: 2 + extraDepth,
    css: [
      "components/release-card.css",
      "components/facets.css",
      "components/toolbar.css",
      "components/pagination.css",
      "surfaces/plp.css",
    ],
    current: "plp",
    content,
  });
}
