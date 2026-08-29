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
 * than stylistic: `tools/origin-suite/suite/pdp.test.ts:641` pins the
 * editorial page at exactly 8 client chunks, `render.tsx` is IN the client
 * graph (`src/app/(editorial)/editorial/error.tsx:1-3` is a client entry that
 * imports `Shell`), and adding an export or a prop there re-groups the chunk
 * set under a published initial-JS cell. `render.tsx`'s own `ReleaseCard`
 * (:135-162) also has no escape hatch for the PLP's POSITIONAL image
 * attributes, so sharing it would drift on every card anyway.
 *
 * Framework-neutral by construction (relative imports, no Next API, no
 * "use client"): the pre-merge identity guard in `test/master-identity.test.ts`
 * calls it straight through `react-dom/server`, exactly as the editorial and
 * PDP guards call `render.tsx` and `pdp.tsx`.
 *
 * WHERE THE FACETS COME FROM. This module computes NO facet buckets. The tray
 * carries them (`GET /api/plp` → `PlpPage.facets`, minted by
 * `workers/edge/src/index.js:101-119`), which is ADR-0005 §5's "every strategy
 * delegates filter/sort/search to the data plane" applied to the one
 * derivation that is byte-load-bearing: `packages/reference/render/plp.mjs:22-27`
 * records that `localeCompare` disagreed with the Worker at four positions on
 * the real crate and is ICU-version-dependent. A third copy of that comparator
 * living in a variant is exactly the second-opinion class this repo keeps
 * paying for.
 */
import type { PlpPage, Price, ReleaseSummary } from "@pm/data-contract";

/** Designated hosts — `packages/reference/render/shell.mjs` HOSTS, ported.
 *  Re-typed rather than imported from render.tsx for the chunk reason above;
 *  only the two entries this surface actually links are carried. A card's
 *  title links the PDP's DESIGNATED HOST (`/vanilla/pdp/…`), never this
 *  variant's own PDP — the sparse-matrix rule, asserted at
 *  `tools/origin-suite/suite/pdp.test.ts:514-523`. */
export const PLP_HOSTS = {
  pdp: (slug: string) => `/vanilla/pdp/${slug}/`,
};

/* ── Canonical knobs, mirrored from the contract ──────────────────────────── */

/** `packages/reference/render/plp.mjs`. The master renders exactly PER_PAGE
 *  cards, which is what the drift comparison is taken at. */
export const PER_PAGE = 24;

/** The data-volume knob's canonical bounds. The rule of record is
 *  `packages/measurement/src/beacon.ts:35-40` (`PLP_N` + `clampN`), consumed by
 *  the edge Worker's served condition AND by the chrome's `environment` beacon
 *  tag — so a variant that clamped differently would serve one condition and
 *  publish another. Re-implemented rather than imported because
 *  `@pm/measurement` publishes TypeScript source (`"exports": "./src/index.ts"`)
 *  and this module is compiled by Next, which does not transpile workspace
 *  packages without `transpilePackages`. The duplication is not left to trust:
 *  `test/master-identity.test.ts` asserts this function equals the real
 *  `clampN` over a table of inputs, including the junk and out-of-range ones. */
export function clampPlpN(raw: string | null | undefined): number {
  const parsed = parseInt(raw ?? "", 10) || PER_PAGE;
  return Math.min(Math.max(parsed, 1), 240);
}

/** `?page=` is a positive integer; anything else is page 1. */
export function clampPlpPage(raw: string | null | undefined): number {
  return Math.max(parseInt(raw ?? "", 10) || 1, 1);
}

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

/* ── Within-surface condition links ───────────────────────────────────────── */

/**
 * `packages/reference/render/plp.mjs:63-68`, ported EXACTLY — including what it
 * does not carry.
 *
 * The renderer's own comment says these hrefs "preserve the WHOLE condition
 * (URL-as-receipt, ADR-0004 §5)", and the code preserves `n` only: `?cache=`
 * is dropped, so a paginate click from `?cache=cold` silently lands on the
 * edge-cached condition. That is a defect in the CONTRACT, reported with its
 * diff rather than fixed here — a variant that unilaterally improved on the
 * master would fork it, and the htmx PLP arriving in parallel would then have
 * to guess which behaviour to copy.
 */
export function pageHref(page: number, n: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (n !== PER_PAGE) params.set("n", String(n));
  return `?${params.toString()}`;
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
 * attributes (`plp.mjs:76-86`): card 1 eager + `fetchpriority="high"`, cards
 * 2-4 eager, the rest `loading="lazy" decoding="async"`; every card carries
 * the same `sizes`. The index boundary is `< 4`, and it is a needle — get it
 * wrong and exactly one of twenty-four cards diverges.
 *
 * React spells the prop `fetchPriority` and emits it CAMEL-CASED into the wire
 * bytes; a browser's tokenizer lowercases it on parse, so the served DOM
 * carries the master's `fetchpriority`. Measured, not assumed — and it is why
 * the identity guard lowercases attribute names before normalizing (linkedom
 * does not). React ALSO hoists a `<link rel="preload" as="image">` out of the
 * card for every eager image; `link` is a DELIVERY element the drift gate
 * drops unconditionally (`normalize.ts:295`), so it is invisible to the
 * contract and visible in the byte cell, which is the correct split.
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

/**
 * The catalogue, assembled — the whole `div.pm-plp` subtree.
 *
 * `onSelectPage` is the seam every data strategy plugs into. When it is
 * absent (the server render, and this guard's render) the pagination anchors
 * are exactly the master's plain links, so the SERVED page is byte-faithful
 * and works JS-off — ADR-0005 §8's "the anchor-link core stays JS-off
 * functional". When a strategy island supplies it, the click is intercepted
 * and the strategy's data layer answers instead.
 *
 * WHAT THE CONTRACT COVERS — ALL OF IT, NOW.
 * `renderPlp` used to take no `page` argument: it rendered page 1 from
 * `summaries.slice(0, n)` and always marked "1" current, while the master
 * itself linked `?page=2..5` on every visit. Page ≥ 2 was therefore not
 * expressible by the reference at all, and both arms had to generalize it
 * unaided — which they did DIFFERENTLY: this one emitted `rel="next"`
 * unconditionally and rendered "0–0" on an empty page, htmx gated the link
 * and rendered "0". Two arms serving structurally different DOM for one URL
 * is precisely what the canonical markup contract exists to prevent, and no
 * gate could see it because the only thing either was compared against
 * rendered page 1.
 *
 * The reference is now page-aware (`renderPlp(snapshot, { page })`), so the
 * generalization is the CONTRACT's and this file mirrors it rather than
 * inventing it: sliding window, `--current` on the served page, `Next` only
 * when `page < totalPages`, and "0" for an empty page. At page 1 it reduces
 * to the committed master byte-for-byte, which is what the identity guard
 * proves, and the cross-arm leg below proves the rest.
 */
export function PlpArticle({
  payload,
  n,
  onSelectPage,
}: {
  payload: PlpPage;
  n: number;
  onSelectPage?: (page: number) => void;
}) {
  const shown = payload.items.length;
  const start0 = (payload.page - 1) * payload.perPage;
  // An empty page reads "0", not "0–0". The master renders the same string
  // from the same arithmetic (`plp.mjs` `range`), and htmx's arm does too —
  // one sentence, three renderers, because a screen reader reads whichever
  // one the visitor landed on.
  const range = shown === 0 ? "0" : `${start0 + 1}–${start0 + shown}`;
  // The window SLIDES with the served page rather than anchoring at 1.
  // Anchoring is what the reference does (`plp.mjs:88`), and it is correct
  // there because `renderPlp` only ever renders page 1 — but generalized to
  // page N it means no rendered link equals the served page from page 6 on,
  // so the `--current` marker never renders and a full grid of 24 real cards
  // ships with ZERO `aria-current` in its pagination. Reachable in one click
  // from page 5's own Next link, and found by the verification pass reading
  // this unit's own probe output, which had printed it.
  //
  // At page 1 this reduces to the reference exactly — `start` is 1 and the
  // window is [1..5] — which is what the identity legs prove.
  const PAGE_WINDOW = 5;
  const span = Math.min(payload.totalPages, PAGE_WINDOW);
  const start = Math.min(
    Math.max(payload.page - Math.floor(PAGE_WINDOW / 2), 1),
    Math.max(payload.totalPages - PAGE_WINDOW + 1, 1),
  );
  const pages = Array.from({ length: span }, (_, i) => start + i);
  // Gated, matching the master (`plp.mjs` `hasNext`) and htmx's arm. It was
  // unconditional here — mirroring a reference that could only render page 1
  // — which meant "Next" walked forever into empty pages, and meant the two
  // PLP arms served structurally different DOM for the same URL: htmx gated
  // it, this one did not. The reference is now page-aware, so there is one
  // answer and all three renderers give it.
  const hasNext = payload.page < payload.totalPages;

  const pageLink = (page: number, rel?: "next", label?: string) => (
    <a
      key={rel ?? page}
      className="pm-pagination__link"
      href={pageHref(page, n)}
      rel={rel}
      onClick={
        onSelectPage
          ? (event) => {
              // Modified clicks stay real navigations (open-in-new-tab must
              // keep working); everything else is answered by the strategy.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onSelectPage(page);
            }
          : undefined
      }
    >
      {label ?? String(page)}
    </a>
  );

  return (
    <div className="pm-plp">
      <header className="pm-plp__head">
        <h1 className="pm-page__title">Records</h1>
        <div className="pm-toolbar">
          <p className="pm-toolbar__count">
            Showing <span className="pm-toolbar__n">{range}</span> of{" "}
            <span className="pm-toolbar__n">{String(payload.total)}</span> releases
          </p>
          {/* The search form, the sort select and the facet rail were here,
              mirroring the master. They are OUT with it: the edge Worker
              reads `n`, `page`, `run` and `cache` and nothing else, so every
              one of them navigated to a filtered URL and got the unfiltered
              grid back under a count that still said "of 500". This arm made
              it worse than htmx's did — it FORWARDED the params to /api/plp,
              so the request looked filtered, and it put them in the TanStack
              query key, so identical unfiltered payloads cached under
              distinct keys and the client-cache cell measured a fiction.
              They return with ADR-0005 §5's params — see the plp.mjs
              docblock for why that is a unit and not a merge fix. */}
        </div>
      </header>
      <div className="pm-plp__body">
        <div className="pm-plp__results">
          <ul className="pm-grid" role="list">
            {payload.items.map((summary, i) => (
              <ReleaseCard key={summary.id} summary={summary} index={i} />
            ))}
          </ul>
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
        </div>
      </div>
    </div>
  );
}
