/**
 * The react-next PLP — this variant's OWN re-implementation of the canonical
 * catalogue markup (ADR-0003 §1: a component is a spec, re-implemented per
 * paradigm; `packages/reference/surfaces/plp/index.html` is the contract of
 * record and `packages/reference/render/plp.mjs` is the renderer that
 * produces it).
 *
 * DELIBERATELY SELF-CONTAINED — no import from `render.tsx`, `format.ts` or
 * `cart.ts`, and the release card is re-typed here rather than shared. That is
 * the `pdp-format.ts`/`pdp-cart.ts` precedent, and it is load-bearing rather
 * than stylistic: `tools/origin-suite/suite/pdp.test.ts` pins the editorial
 * page at exactly 8 client chunks, `render.tsx` is IN the client graph, and
 * adding an export or a prop there re-groups the chunk set under a published
 * initial-JS cell. `render.tsx`'s own `ReleaseCard` also has no escape hatch
 * for the PLP's POSITIONAL image attributes, so sharing it would drift on
 * every card anyway.
 *
 * Framework-neutral by construction (relative imports, no Next API, no
 * "use client"): the pre-merge identity guard in `test/master-identity.test.ts`
 * calls it straight through `react-dom/server`, exactly as the editorial and
 * PDP guards call `render.tsx` and `pdp.tsx`.
 *
 * WHERE EVERYTHING COMES FROM: THE PAYLOAD. This module computes NO facet
 * buckets, filters nothing, sorts nothing — the tray (`GET /api/plp` →
 * `PlpPage`) carries the paginated slice, the facets RECOUNTED over the
 * filtered set, and the query the data plane APPLIED, and the whole
 * `.pm-plp` block is rendered from that one object. That is ADR-0005 §5's
 * "every strategy delegates filter/sort/search to the data plane" applied to
 * the last inch: the rail's selected facet, the sort select's chosen option
 * and the search box's value come from `payload.applied`, never from the URL
 * the island was asked for. The distinction is live on the two client-cache
 * arms — under `keepPreviousData`/`previousData` the PREVIOUS tray is on
 * screen while a new condition is in flight, and controls rendered from the
 * request would show one condition's selection over another condition's
 * grid: a toggle-off link that does not toggle off. `carry` contributes only
 * the three knobs a tray cannot know (`cache`, `run`, `profile`).
 *
 * THE RAIL, THE SEARCH FORM AND THE SORT SELECT ARE BACK (2026-09-04). They
 * were cut on 2026-08-29 because the edge Worker honoured none of the params
 * they navigated to, and this arm made it worse than htmx's did: it FORWARDED
 * the params to /api/plp, so the request looked filtered while the payload
 * was not, and keyed TanStack's cache on them, so identical unfiltered
 * payloads cached under distinct keys. The plane honours all five now
 * (ADR-0005 §5 + its 2026-09-04 addendum), so the forwarding is true again.
 */
import type { PlpPage, PlpSort, Price, ReleaseSummary } from "@pm/data-contract";
import {
  PER_PAGE,
  PLP_RUN_RE,
  PLP_SORTS,
  clampPlpN,
  clampPlpPage,
  normalizePlpQ,
  plpHref,
  type PlpCondition,
} from "./plp-condition";

// Kept as exports of THIS module for the guard and the islands, which read
// them here historically; the definitions moved beside the href rule.
export { PER_PAGE, clampPlpN, clampPlpPage };

/** Designated hosts — `packages/reference/render/shell.mjs` HOSTS, ported.
 *  Re-typed rather than imported from render.tsx for the chunk reason above;
 *  only the two entries this surface actually links are carried. A card's
 *  title links the PDP's DESIGNATED HOST (`/vanilla/pdp/…`), never this
 *  variant's own PDP — the sparse-matrix rule. */
export const PLP_HOSTS = {
  pdp: (slug: string) => `/vanilla/pdp/${slug}/`,
};

/** `packages/reference/render/plp.mjs` STYLE_CUT / FORMAT_CUT: all genres,
 *  the top 12 styles, the top 8 formats, each group titled with its cut. */
export const STYLE_CUT = 12;
export const FORMAT_CUT = 8;

/** The sort select's options (plp.mjs SORT_OPTIONS). The default is the
 *  snapshot's committed order — id-ascending — labelled as such. */
export const SORT_OPTIONS: readonly (readonly [PlpSort | "", string])[] = [
  ["", "Catalogue order"],
  ["year-desc", "Year — newest first"],
  ["year-asc", "Year — oldest first"],
  ["price-asc", "Price — low to high"],
  ["price-desc", "Price — high to low"],
  ["title", "Title — A to Z"],
];

/* ── Canonical formatting rules ───────────────────────────────────────────────
 * `packages/reference/render/lib.mjs` is the rules of record; re-implemented,
 * not shared (the `format.ts` precedent — ADR-0002 §6 kept display strings out
 * of the trays for exactly this). Duplicated from `format.ts` rather than
 * imported, for the client-chunk reason in this file's header comment.
 */

/** "$" + two decimals + "," thousands for USD; "<amount> <CUR>" otherwise. */
export function formatPrice(priceFrom: Price | null): string | null {
  if (priceFrom == null) return null;
  const { amount, currency } = priceFrom;
  const fixed = amount.toFixed(2);
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return currency === "USD" ? `$${grouped}.${frac}` : `${grouped}.${frac} ${currency}`;
}

/** "N for sale" with a real singular; an honest zero, never a blank. */
export function stockLine(numForSale: number): string {
  if (numForSale === 0) return "none for sale";
  return numForSale === 1 ? "1 for sale" : `${numForSale} for sale`;
}

/** Format string + year, " · " separated; year may be null. */
export function metaLine(summary: Pick<ReleaseSummary, "format" | "year">): string {
  return summary.year == null ? summary.format : `${summary.format} · ${summary.year}`;
}

/* ── Components ───────────────────────────────────────────────────────────── */

/** `packages/reference/render/lib.mjs namedGlyph` — a bare "—" is not an
 *  accessible name, so the glyph is hidden and a real phrase supplied beside
 *  it. Both arguments are AUTHORED literals, never tray data. */
function NamedGlyph({ glyph, name }: { glyph: string; name: string }) {
  return (
    <>
      <span aria-hidden="true">{glyph}</span>
      <span className="pm-sr-only">{name}</span>
    </>
  );
}

/**
 * The release card (`shell.mjs releaseCard`), with the PLP's POSITIONAL image
 * attributes (`plp.mjs`): card 1 eager + `fetchpriority="high"`, cards 2-4
 * eager, the rest `loading="lazy" decoding="async"`; every card carries the
 * same `sizes`. The index boundary is `< 4`, and it is a needle — get it
 * wrong and exactly one of twenty-four cards diverges.
 *
 * React spells the prop `fetchPriority` and emits it CAMEL-CASED into the wire
 * bytes; a browser's tokenizer lowercases it on parse, so the served DOM
 * carries the master's `fetchpriority`. Measured, not assumed — and it is why
 * the identity guard lowercases attribute names before normalizing (linkedom
 * does not). React ALSO hoists a `<link rel="preload" as="image">` out of the
 * card for every eager image; `link` is a DELIVERY element the drift gate
 * drops unconditionally, so it is invisible to the contract and visible in
 * the byte cell, which is the correct split.
 */
function ReleaseCard({ summary, index }: { summary: ReleaseSummary; index: number }) {
  const price = formatPrice(summary.priceFrom);
  const c = summary.cover;
  const sizes = "(max-width: 40em) 50vw, (max-width: 52em) 33vw, 240px";
  return (
    <li className="pm-release-card">
      <img
        className="pm-release-card__media"
        width={c.width}
        height={c.height}
        alt={c.alt}
        src={c.src}
        {...(index === 0 ? { fetchPriority: "high" as const } : {})}
        {...(index < 4 ? {} : { loading: "lazy" as const, decoding: "async" as const })}
        sizes={sizes}
      />
      <div className="pm-release-card__body">
        <h3 className="pm-release-card__title">
          <a className="pm-release-card__link" href={PLP_HOSTS.pdp(summary.slug)}>
            {summary.title}
          </a>
        </h3>
        <p className="pm-release-card__artist">{summary.artist}</p>
        <p className="pm-release-card__meta">{metaLine(summary)}</p>
        <div className="pm-release-card__foot">
          <span className="pm-release-card__price">
            {price ?? <NamedGlyph glyph="—" name="No price listed" />}
          </span>
          <span className="pm-release-card__stock">{stockLine(summary.numForSale)}</span>
        </div>
      </div>
    </li>
  );
}

/** The three URL knobs a tray cannot know (plp.mjs `renderPlpBlock`'s second
 *  argument). Everything else the block renders comes from the payload. */
export interface PlpCarry {
  cache?: "cold" | "default";
  run?: string;
  profile?: string;
}

type FacetGroupKey = "genres" | "styles" | "formats";
type FacetParam = "genre" | "style" | "format";

/** The condition the block's hrefs are built from: the payload's served
 *  state plus the carried knobs. `n` is the payload's `perPage`, never a
 *  prop — the served value is the only one the hrefs may spell. */
function blockCondition(payload: PlpPage, carry: PlpCarry): PlpCondition {
  return {
    n: payload.perPage,
    page: payload.page,
    cache: carry.cache === "cold" ? "cold" : "default",
    run: carry.run ?? "",
    profile: carry.profile ?? "",
    genre: payload.applied.genre,
    style: payload.applied.style,
    format: payload.applied.format,
    sort: payload.applied.sort,
    q: payload.applied.q,
  };
}

/** A GET form's hidden inputs (plp.mjs `hiddenKnobs`): every non-default
 *  knob except `page` (a new filter starts at page 1) and the form's own
 *  control, in canonical order so DOM-order serialization spells the URL the
 *  way the href rule does. `defaultValue`, not `value`: these are
 *  uncontrolled and React must not warn about a missing onChange. */
function HiddenKnobs({
  condition,
  own,
  side,
}: {
  condition: PlpCondition;
  own: "q" | "sort";
  /** A browser serializes a GET form in TREE order, so the knobs that
   *  canonically FOLLOW the form's own control (the sort form's `q`) render
   *  AFTER it — `side="after"` — and a JS-off submit spells the condition the
   *  way the href rule does (plp.mjs `hiddenKnobs`; verify-slice 2026-09-18). */
  side: "before" | "after";
}) {
  const fields: [string, string][] = [];
  const knobs = ["genre", "style", "format", "sort", "q"] as const;
  const ownAt = knobs.indexOf(own);
  if (side === "before") {
    if (condition.n !== PER_PAGE) fields.push(["n", String(condition.n)]);
    if (condition.cache === "cold") fields.push(["cache", "cold"]);
    // Bounded like the reference's CARRY_RE and this arm's own href rule
    // (plpHistoryUrl): a junk `run`/`profile` is dropped, never re-emitted.
    // The routes blank a malformed carry before it gets here, but PlpArticle
    // is an exported seam, and unbounded here it was the one place the three
    // renderers disagreed (verify-slice, skeptic lens, 2026-09-18).
    if (PLP_RUN_RE.test(condition.run)) fields.push(["run", condition.run]);
    if (PLP_RUN_RE.test(condition.profile)) fields.push(["profile", condition.profile]);
  }
  knobs.forEach((key, i) => {
    const value = condition[key];
    if (key === own || value === null) return;
    if ((i < ownAt) === (side === "before")) fields.push([key, value]);
  });
  return (
    <>
      {fields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} defaultValue={value} />
      ))}
    </>
  );
}

/**
 * The catalogue, assembled — the whole `div.pm-plp` subtree.
 *
 * `onNavigate` is the seam every data strategy plugs into. When it is absent
 * (the server render, and this guard's render) every anchor is exactly the
 * master's plain link and every form is a plain GET form, so the SERVED page
 * is byte-faithful and works JS-off — ADR-0005 §8's "the anchor-link core
 * stays JS-off functional". When a strategy island supplies it, the click or
 * submit is intercepted and the strategy's data layer answers instead, with
 * the SAME condition the anchor's href spells.
 *
 * Everything rendered derives from `payload` (see the header): the sliding
 * five-wide page window, the `--current` marker, `Next` only when
 * `page < totalPages`, "0" for an empty page, the selected facet, the chosen
 * sort, the search box's value. `carry` adds only cache/run/profile to the
 * hrefs. At the default condition it reduces to the committed master
 * byte-for-byte, which the identity guard proves; `plp-arms-agree` holds
 * both arms to the reference for the conditions the master cannot express.
 */
export function PlpArticle({
  payload,
  carry = {},
  onNavigate,
}: {
  payload: PlpPage;
  carry?: PlpCarry;
  onNavigate?: (next: PlpCondition) => void;
}) {
  const condition = blockCondition(payload, carry);
  const { applied } = payload;
  const shown = payload.items.length;
  const start0 = (payload.page - 1) * payload.perPage;
  // An empty page reads "0", not "0–0" — one sentence, three renderers.
  const range = shown === 0 ? "0" : `${start0 + 1}–${start0 + shown}`;
  const PAGE_WINDOW = 5;
  const span = Math.min(payload.totalPages, PAGE_WINDOW);
  const first = Math.min(
    Math.max(payload.page - Math.floor(PAGE_WINDOW / 2), 1),
    Math.max(payload.totalPages - PAGE_WINDOW + 1, 1),
  );
  const pages = Array.from({ length: span }, (_, i) => first + i);
  const hasNext = payload.page < payload.totalPages;

  const intercept = (next: PlpCondition) =>
    onNavigate
      ? (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault: () => void }) => {
          // Modified clicks stay real navigations (open-in-new-tab must keep
          // working); everything else is answered by the strategy.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onNavigate(next);
        }
      : undefined;

  const pageLink = (page: number, rel?: "next", label?: string) => {
    const next = { ...condition, page };
    return (
      <a
        key={rel ?? page}
        className="pm-pagination__link"
        href={plpHref(condition, { page })}
        rel={rel}
        onClick={intercept(next)}
      >
        {label ?? String(page)}
      </a>
    );
  };

  const facetGroup = (title: string, param: FacetParam, group: FacetGroupKey, cut: number) => {
    const buckets = payload.facets[group];
    const selected = applied[param];
    let list = cut ? buckets.slice(0, cut) : buckets;
    // The selected value is always listed: outside its group's cut it is
    // appended after the cut (plp.mjs facetGroup).
    if (selected !== null && !list.some((b) => b.value === selected)) {
      const own = buckets.find((b) => b.value === selected);
      if (own) list = [...list, own];
    }
    const cutNote = cut && buckets.length > cut ? ` · top ${cut} of ${buckets.length}` : "";
    return (
      <section className="pm-facets__group">
        <h3 className="pm-facets__title">
          {title}
          {cutNote}
        </h3>
        <ul className="pm-facets__list" role="list">
          {list.map((b) => {
            const isSelected = b.value === selected;
            // A selected facet's href REMOVES its param — the same link
            // toggles it off. Every facet href resets `page`.
            const next: PlpCondition = { ...condition, page: 1, [param]: isSelected ? null : b.value };
            return (
              <li key={b.value}>
                <a
                  className="pm-facets__facet"
                  href={plpHref(condition, { page: 1, [param]: isSelected ? null : b.value })}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={intercept(next)}
                >
                  <span className="pm-facets__value">{b.value}</span>
                  <span className="pm-facets__count">{String(b.count)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  // The two GET forms: plain navigation JS-off (the browser serializes the
  // hidden knobs + the control in canonical order); intercepted JS-on into
  // the same condition the submit would have reached.
  const onSearch = onNavigate
    ? (event: { currentTarget: HTMLFormElement; preventDefault: () => void }) => {
        event.preventDefault();
        const raw = new FormData(event.currentTarget).get("q");
        onNavigate({ ...condition, page: 1, q: normalizePlpQ(typeof raw === "string" ? raw : null) });
      }
    : undefined;
  const onSort = onNavigate
    ? (event: { currentTarget: HTMLFormElement; preventDefault: () => void }) => {
        event.preventDefault();
        const raw = new FormData(event.currentTarget).get("sort");
        const sort = typeof raw === "string" && raw !== "" ? raw : null;
        onNavigate({ ...condition, page: 1, sort });
      }
    : undefined;

  return (
    <div className="pm-plp">
      <header className="pm-plp__head">
        <h1 className="pm-page__title">Records</h1>
        <div className="pm-toolbar">
          <p className="pm-toolbar__count">
            Showing <span className="pm-toolbar__n">{range}</span> of{" "}
            <span className="pm-toolbar__n">{String(payload.total)}</span> releases
          </p>
          <form className="pm-toolbar__search" method="get" action="" onSubmit={onSearch}>
            <HiddenKnobs condition={condition} own="q" side="before" />
            <div>
              <label className="pm-toolbar__label" htmlFor="plp-q">
                Search the crate
              </label>
              {/* `key`: both controls are UNCONTROLLED (`defaultValue`), the
                  plain-GET-form shape, and React never re-applies a changed
                  defaultValue to a mounted select or a dirty input. So on
                  Back/Forward — `applied` changes under a live island — the
                  select kept the old sort and the box the old search over a
                  grid that had moved: one condition's controls over another's,
                  the very thing addendum Q2 exists to prevent. Keying each on
                  its applied value remounts it when that value changes and
                  leaves the SSR bytes untouched (verify-slice, 2026-09-18). */}
              <input
                key={applied.q ?? ""}
                className="pm-toolbar__input"
                id="plp-q"
                name="q"
                type="search"
                autoComplete="off"
                defaultValue={applied.q ?? undefined}
              />
            </div>
            <HiddenKnobs condition={condition} own="q" side="after" />
            <button className="pm-button pm-button--secondary" type="submit">
              Search
            </button>
          </form>
          <form className="pm-toolbar__sort" method="get" action="" onSubmit={onSort}>
            <HiddenKnobs condition={condition} own="sort" side="before" />
            <div>
              <label className="pm-toolbar__label" htmlFor="plp-sort">
                Sort
              </label>
              <select
                key={applied.sort ?? ""}
                className="pm-toolbar__select"
                id="plp-sort"
                name="sort"
                defaultValue={applied.sort ?? ""}
              >
                {SORT_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <HiddenKnobs condition={condition} own="sort" side="after" />
            <button className="pm-button pm-button--secondary" type="submit">
              Apply
            </button>
          </form>
        </div>
      </header>
      <div className="pm-plp__body">
        <nav className="pm-facets" aria-label="Filters">
          {facetGroup("Genre", "genre", "genres", 0)}
          {facetGroup("Style", "style", "styles", STYLE_CUT)}
          {facetGroup("Format", "format", "formats", FORMAT_CUT)}
        </nav>
        <div className="pm-plp__results">
          <ul className="pm-grid" role="list">
            {payload.items.map((summary, i) => (
              <ReleaseCard key={summary.id} summary={summary} index={i} />
            ))}
          </ul>
          {/* An EMPTY result has no pagination landmark at all (plp.mjs): a
              lone current "1" over "Showing 0 of 0" is page 1 of 0. */}
          {payload.totalPages > 0 ? (
            <nav className="pm-pagination" aria-label="Pages">
              {pages.map((p) =>
                p === payload.page ? (
                  <span
                    key={p}
                    className="pm-pagination__link pm-pagination__link--current"
                    aria-current="page"
                  >
                    {String(p)}
                  </span>
                ) : (
                  pageLink(p)
                ),
              )}
              {hasNext ? pageLink(payload.page + 1, "next", "Next") : null}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Exported for the guard: the sort list the select offers must be the data
 *  plane's (a value outside it is a 404, not a default). */
export { PLP_SORTS };
