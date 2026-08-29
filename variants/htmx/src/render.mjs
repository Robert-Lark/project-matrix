// The htmx variant's pages — this variant's OWN re-implementation of the
// canonical markup (ADR-0003 §1: a component is a spec, re-implemented per
// paradigm; ADR-0008: the masters under packages/reference/surfaces/ are the
// contract of record). Two surfaces live here: the EDITORIAL page (slice E)
// and, since 2026-08-28, the PLP catalogue grid — this paradigm's arm of the
// data-strategy comparison (ADR-0005). The paradigm IS the template: hypermedia means the server
// renders complete HTML per request, so plain template literals in the
// Worker are the idiomatic shape — no framework, no compile step, nothing
// here imports the reference renderer (essay copy is re-typed as
// variant-owned content, the recorded slice-A call; the drift gate polices
// textual identity in CI against the fixture master and on the deployed
// plane against the master re-rendered from the resolved snapshot,
// ADR-0008 §9).
//
// Framework-neutral by construction: this module renders from plain data and
// touches no Worker API, so the pre-merge master-identity guards import and
// drive it directly, byte-strict — the vanilla mechanism. Those guards now
// sit in TWO homes, which is worth knowing before adding a third surface:
// editorial's is tools/repo-checks/test/variant-master-identity.test.ts
// (both snapshots), and the PLP's is this variant's own variants/htmx/test/
// — repo-checks belongs to another unit's boundary, and the split is
// recorded in the PLP build's handoff for a later consolidation call.

/** HTML-escape interpolated tray values (frozen data is still external).
 *  Byte-identical to the reference renderer's esc() — decimal &#39;. */
export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Canonical price formatting (lib.mjs rules of record): "$" + two decimals
 *  + "," thousands for USD; "<amount> <CUR>" otherwise; null stays null. */
function formatPrice(priceFrom) {
  if (priceFrom == null) return null;
  const { amount, currency } = priceFrom;
  const fixed = amount.toFixed(2);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return currency === "USD" ? `$${grouped}.${frac}` : `${grouped}.${frac} ${currency}`;
}

/** Canonical stock line: real singular, honest zero. */
function stockLine(numForSale) {
  if (numForSale === 0) return "none for sale";
  return numForSale === 1 ? "1 for sale" : `${numForSale} for sale`;
}

/** Canonical meta line: format + year, " · " separated; year may be null. */
function metaLine(release) {
  return release.year == null ? release.format : `${release.format} · ${release.year}`;
}

/** Canonical stand-in for absent data (lib.mjs rules of record): a lone "—"
 *  announces as "em dash" or as nothing, so the glyph is hidden and a real
 *  phrase rides beside it. Both arguments are authored literals. */
function namedGlyph(glyph, name) {
  return `<span aria-hidden="true">${glyph}</span><span class="pm-sr-only">${name}</span>`;
}

/* ── The per-snapshot essays — committed CONTENT, re-typed verbatim from the
      contract of record (packages/reference/render/editorial.mjs). Prose
      narrates allusively; every precise number interpolates tray fields;
      the dateline is the manifest's freeze date. ─────────────────────────── */

const CRATE_ESSAY = {
  kicker: "Staff pick",
  title: "The price of stillness",
  dek: "A drone record from 2007 has become the most expensive thing in our crate — without a single loud moment on it.",
  body: (d) => [
    `p:There are records you put on and records you put up — and ${esc(d.artist)}'s <em>${esc(d.title)}</em> has spent nearly two decades being both. Two hours of tape-saturated strings and horns that barely move, released on ${esc(d.labels[0]?.name ?? "Kranky")} in ${d.year}, it is the kind of album whose fans describe it in architectural terms: a room, a horizon, a place they go.`,
    `p:It is also, as of this crate's freeze, the most expensive record we stock. The original pressing sits north of five hundred dollars with a single copy on offer — ${formatPrice(d.priceFrom)} at the freeze, to be exact — and the story of how it got there is the story of what vinyl does when music refuses to be background for the people who love it.`,
    `blockquote:Stillness scales badly. You can stream it anywhere, but the people who want this record want the object — the gatefold, the etched runout, the side you have to stand up and flip. Scarcity does the rest.`,
    `p:The economics are unsentimental. A triple LP of very quiet music is expensive to press and risky to repress, so supply arrives in slow, deliberate waves; a reissue surfaces, sells through, and the originals resume their climb. Meanwhile the music itself does the one thing collectible records must do: it keeps being recommended, year after year, by people who sound slightly embarrassed at how much they mean it.`,
    `p:We are not in the appreciation business — this is a record store, and our copy count is what it is. But if you have ever wondered what people hear in a record that seems to do nothing, this is the one to start with. Put it on in the late afternoon. Let it be the room.`,
  ],
  featureNote: () =>
    `The pressing described above, as captured in the frozen snapshot — price and availability are the real aggregate at the freeze.`,
};

const FIXTURE_ESSAY = {
  kicker: "Staff pick",
  title: "A quiet variation, on repeat",
  dek: "The fixture's stand-in essay: synthetic prose over synthetic data, exercising every structure the real one uses.",
  body: (d) => [
    `p:<em>${esc(d.title)}</em> by ${esc(d.artist)} is not a real record — it is release ${d.id} of the synthesized fixture crate, pressed on ${esc(d.labels[0]?.name ?? "a placeholder label")} in ${d.year} by a deterministic generator. This essay exists so the editorial surface renders honestly in CI, where the real crate never travels.`,
    `p:It carries everything the real staff pick carries: a priced feature card rendered from the tray (${formatPrice(d.priceFrom) ?? "unpriced"} at the fixture's pinned capture date), a figure with data-sized dimensions, one blockquote, and exactly one interaction below.`,
    `blockquote:If you can read this in a published benchmark screenshot, the wrong snapshot is being served — the fixture never leaves CI.`,
    `p:Structure is the point: the drift gate compares this page's rendered DOM against every paradigm's re-implementation, so even placeholder prose is part of the contract. The words are synthetic; the markup is law.`,
    `p:The real essay ships wherever the real crate is served, with the same shape and the same rules — numbers from trays, dates from the manifest, verdicts from nowhere.`,
  ],
  featureNote: () =>
    `The fixture's featured release, rendered from its tray — same contract as the real crate's.`,
};

/* ── The shell — canonical skeleton (packages/reference/render/shell.mjs):
      skip link FIRST, then the chrome slot (variants only), then .pm-page.
      Cross-surface links absolute to each surface's designated host. ─────── */

/** The shell sheets every surface links, in the reference `head()`'s order
 *  (shell.mjs:130-134) — the per-surface list is appended after them, so a
 *  variant page's cascade order matches its master's. */
const SHELL_CSS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
];

const EDITORIAL_CSS = [
  ...SHELL_CSS,
  "components/release-card.css",
  "components/prose.css",
  "surfaces/editorial.css",
];

/** The PLP's per-surface sheets (packages/reference/render/plp.mjs:143-149). */
const PLP_CSS = [
  ...SHELL_CSS,
  "components/release-card.css",
  "components/toolbar.css",
  "components/pagination.css",
  "surfaces/plp.css",
];

/** The asset base is ABSOLUTE (`/htmx/assets/pm`): the page is rendered by
 *  the Worker at any path depth it may later serve partials from, so
 *  relative asset paths would be a latent trap; the front Worker never
 *  rewrites paths, so the /htmx/ prefix is this variant's own duty. */
const ASSETS = "/htmx/assets";

/** The canonical font-loading markup (@pm/tokens/fonts/loading-markup.html)
 *  verbatim modulo the base path — ADR-0003 §8: fonts are a controlled
 *  constant, only the asset base may differ per consumer. Template literals
 *  reproduce the file byte-for-byte (bare `crossorigin`, unclosed void
 *  elements), so the suite's assertion here is the strict form, like
 *  vanilla's and astro's. */
const FONT_MARKUP = [
  `<link rel="preload" href="${ASSETS}/pm/fonts/FamiljenGrotesk.var.woff2" as="font" type="font/woff2" crossorigin>`,
  `<link rel="preload" href="${ASSETS}/pm/fonts/PMCrateSymbols.woff2" as="font" type="font/woff2" crossorigin>`,
  `<link rel="stylesheet" href="${ASSETS}/pm/css/fonts.css">`,
];

function head(title, css) {
  return [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    ...FONT_MARKUP,
    ...css.map((f) => `<link rel="stylesheet" href="${ASSETS}/pm/css/${f}">`),
  ].join("\n  ");
}

/** The paradigm's scripts. The vendored htmx runtime (the documented
 *  install is a script tag, served same-origin — never a CDN include: the
 *  suite's request tracker fails any request off the composed origin) plus
 *  the cart enhancement ride EVERY page: `cart.js` populates the masthead's
 *  `[data-pm-cart-count]` slot on every shell page load, which the cart
 *  contract requires of every surface, not just the one with a button
 *  (shell.mjs CART_CONTRACT, "Count"). It costs nothing on a page with no
 *  add-to-cart control — it returns early when the editorial feature button
 *  is absent (cart.js:62).
 *
 *  Script elements are delivery, not contract (ADR-0008 freedoms), but they
 *  are still measured BYTES, so the list is per-surface: editorial must not
 *  gain the PLP's enhancement, whose numbers are already published. */
const EDITORIAL_SCRIPTS = [
  `<script src="${ASSETS}/htmx.min.js" defer></script>`,
  `<script src="${ASSETS}/cart.js" defer></script>`,
];

const PLP_SCRIPTS = [
  ...EDITORIAL_SCRIPTS,
  // The half of "loaders + PE" that a partial swap makes necessary: focus
  // and announcement, which `hx-boost` takes away from the navigation it
  // replaces. See src/plp.js for the whole argument.
  `<script src="${ASSETS}/plp.js" defer></script>`,
];

/** One masthead link; `aria-current="page"` marks the surface being served
 *  (the reference `shell()`'s `current` parameter, shell.mjs:140-142). */
function mastheadLink(href, label, key, current) {
  return `<a class="pm-masthead__link" href="${href}"${current === key ? ` aria-current="page"` : ""}>${label}</a>`;
}

/** The shared page frame: canonical shell around `content`, with this
 *  variant's delivery (font/CSS links, htmx runtime, cart enhancement).
 *  `hooks` carries extra pre-script elements (the cart's JSON data hook);
 *  `css` is the surface's sheet list and `current` its masthead marker —
 *  both were editorial-only constants until the PLP build (2026-08-28). */
function pageFrame({ title, content, hooks = [], css, current, scripts }) {
  return `<!doctype html>
<html lang="en">
<head>
  ${head(title, css)}
</head>
<body>
  <a class="pm-skip pm-button" href="#main">Skip to content</a>
  <div id="pm-chrome-slot"></div>
  <div class="pm-page">
    <header class="pm-masthead">
      <a class="pm-masthead__brand" href="/">Long Decay<span> Records</span></a>
      <nav class="pm-masthead__nav" aria-label="Store">
        ${mastheadLink("/react-next/plp/plain/", "Records", "plp", current)}
        ${mastheadLink("/vanilla/editorial/", "Editorial", "editorial", current)}
      </nav>
      <a class="pm-masthead__cart" href="/vanilla/checkout/">Cart<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span></a>
    </header>
    <main id="main">
${content}
    </main>
    <p class="pm-status" role="status" data-pm-status></p>
    <footer class="pm-footer">
      <p class="pm-footer__fiction">A working store on frozen Discogs data — nothing ships, checkout is simulated.</p>
      <nav class="pm-footer__nav" aria-label="About this site">
        <a href="/">What is this?</a>
        <a href="/vanilla/a11y/">Accessibility, shown</a>
        <a href="/how-it-was-built/">How it was built</a>
        <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">GitHub</a>
      </nav>
    </footer>
  </div>
  ${[...hooks, ...scripts].join("\n  ")}
</body>
</html>
`;
}

/** `imgAttrs` is the caller's image-loading contract, appended verbatim
 *  inside the `<img>` tag (the reference `releaseCard`'s own parameter,
 *  shell.mjs:186-191). Editorial's feature card passes none, so its markup
 *  is unchanged; the PLP pins eager/lazy by position. */
function releaseCard(release, imgAttrs = "") {
  const price = formatPrice(release.priceFrom);
  const c = release.cover;
  return `<li class="pm-release-card">
  <img class="pm-release-card__media" width="${c.width}" height="${c.height}"
       alt="${esc(c.alt)}" src="${esc(c.src)}"${imgAttrs}>
  <div class="pm-release-card__body">
    <h3 class="pm-release-card__title"><a class="pm-release-card__link" href="${esc(`/vanilla/pdp/${release.slug}/`)}">${esc(release.title)}</a></h3>
    <p class="pm-release-card__artist">${esc(release.artist)}</p>
    <p class="pm-release-card__meta">${esc(metaLine(release))}</p>
    <div class="pm-release-card__foot">
      <span class="pm-release-card__price">${price ?? namedGlyph("—", "No price listed")}</span>
      <span class="pm-release-card__stock">${esc(stockLine(release.numForSale))}</span>
    </div>
  </div>
</li>`;
}

/**
 * Render the editorial page from this request's resolved data:
 * `{ isFixture, capturedAt, featured }` — the served manifest picks the
 * honest essay, the dateline IS the freeze date (ADR-0008 §8), and the
 * featured release's DETAIL tray supplies every rendered field (the
 * request-time shape: one /api/snapshot + one /api/pdp/{id} through the
 * edge binding; the card's fields are tray-identical between summary and
 * detail, which the byte-strict pre-merge guard proves rather than assumes).
 */
export function renderEditorialPage({ isFixture, capturedAt, featured }) {
  const essay = isFixture ? FIXTURE_ESSAY : CRATE_ESSAY;

  const blocks = essay.body(featured).map((b) => {
    const [kind, ...rest] = b.split(":");
    const text = rest.join(":");
    return kind === "blockquote" ? `<blockquote><p>${text}</p></blockquote>` : `<p>${text}</p>`;
  });
  // The one figure sits after the opening paragraph (contract of record).
  const figureImg = featured.images[1] ?? featured.images[0];
  blocks.splice(
    1,
    0,
    `<figure><img src="${esc(figureImg.src)}" width="${figureImg.width}" height="${figureImg.height}" alt="${esc(figureImg.alt)}" loading="lazy" decoding="async"><figcaption>${esc(featured.artist)} — ${esc(featured.title)} (${esc(featured.labels[0]?.name ?? "")}${featured.labels[0]?.catno ? ` · ${esc(featured.labels[0].catno)}` : ""}), from the frozen snapshot.</figcaption></figure>`,
  );

  // The enhancement's data hook rides a script element — delivery, not
  // contract (ADR-0008 freedoms) — so the canonical DOM carries no extra
  // attribute. `<` is escaped so a tray string can never close the script
  // element early.
  const cartItem = JSON.stringify({ id: featured.id, title: featured.title }).replace(
    /</g,
    "\\u003c",
  );

  const content = `      <article class="pm-editorial">
        <header class="pm-editorial__head">
          <p class="pm-page__kicker">${esc(essay.kicker)}</p>
          <h1 class="pm-editorial__title">${esc(essay.title)}</h1>
          <p class="pm-editorial__dek">${esc(essay.dek)}</p>
          <p class="pm-editorial__dateline">From the crate · frozen <time datetime="${esc(capturedAt)}">${esc(capturedAt)}</time></p>
        </header>
        <div class="pm-prose">
          ${blocks.join("\n          ")}
        </div>
        <aside class="pm-editorial__feature" aria-label="Featured release">
          <ul class="pm-grid" role="list">
${releaseCard(featured)}
          </ul>
          <div class="pm-editorial__feature-body">
            <p class="pm-editorial__feature-note">${esc(essay.featureNote(featured))}</p>
            <div><button class="pm-button" type="button"${featured.numForSale === 0 ? " disabled" : ""}>Add to cart</button></div>
            <p class="pm-editorial__feature-note">The only interactive element on this page — that's the experiment.</p>
          </div>
        </aside>
      </article>`;

  return pageFrame({
    title: `${essay.title} — Long Decay Records`,
    content,
    hooks: [`<script type="application/json" id="pm-cart-item">${cartItem}</script>`],
    css: EDITORIAL_CSS,
    current: "editorial",
    scripts: EDITORIAL_SCRIPTS,
  });
}

/* ── The PLP (catalogue grid) — the data axis's server-rendered arm
      (ADR-0005 §1: "the server fetches the tray and returns finished HTML;
      interactions are real links enhanced into partial swaps (works
      JS-off)"). Re-implemented from the contract of record
      (packages/reference/render/plp.mjs), never imported: same rule as the
      editorial page above. ─────────────────────────────────────────────── */

/** The reference's defaults, re-typed (plp.mjs:18-20). PER_PAGE is
 *  load-bearing beyond the default page size: `pageHref` omits `n` when it
 *  equals PER_PAGE, so the master's hrefs read `?page=2` rather than
 *  `?page=2&n=24`. */
const PER_PAGE = 24;

// STYLE_CUT / FORMAT_CUT and `facetGroup` lived here, re-typing the master's
// facet rail. Both are gone with the rail itself — the edge Worker honours
// none of the params those links carried, so every one of them answered a
// filtered request with the unfiltered grid. See the plp.mjs docblock; this
// arm's own tripwire below is what fails the day the Worker grows them.

/**
 * The master's pagination href shape, reproduced exactly (plp.mjs:63-68) —
 * including a defect, and the comment says so because the reference's does
 * not.
 *
 * `renderPlp`'s own comment above that function claims these hrefs "preserve
 * the WHOLE condition (URL-as-receipt, ADR-0004 §5)". They do not. A
 * query-only relative reference REPLACES the entire query (RFC 3986 §5.3,
 * verified: `new URL("?page=2", ".../plp/?cache=cold&run=bench-7&n=240")` →
 * `.../plp/?page=2`), and this builds a fresh `URLSearchParams` carrying
 * `page` and — only when it differs from the default — `n`. So a page-flip
 * silently drops `cache`, `run` and `profile`: the three knobs ADR-0004 §5
 * calls live request modifiers and the snapshot selector. From this arm's
 * own switcher preset (`/htmx/plp/?cache=cold`) a click on "2" lands on the
 * WARM tier while the injected chrome — rendered server-side against the
 * original search, and outside the swapped subtree — still reads
 * `cache: cold`. The address bar and the instrument disagree about one
 * visit, in the flattering direction.
 *
 * NOT diverged from here, for the reason the `rel="next"` defect is not
 * either: the master emits these exact hrefs and the identity guard compares
 * them at page 1, so a variant-side fix would be a silent disagreement with
 * the contract. The fix belongs in `packages/reference/render/plp.mjs`,
 * whose comment should stop claiming the opposite of its three lines; the
 * diff is in this unit's handoff note, and a guard leg pins the current
 * shape so it cannot land on one side only.
 */
function pageHref(target, n) {
  const params = new URLSearchParams();
  params.set("page", String(target));
  if (n !== PER_PAGE) params.set("n", String(n));
  return `?${params.toString()}`;
}

/**
 * THE PARADIGM'S MECHANISM, and the reason this build registers `^hx-`
 * under `behaviorAttrPatterns` (tools/drift-gate/src/normalize.ts).
 *
 * `hx-boost` is htmx's documented "real links, enhanced" attribute: the
 * anchors below keep their own `href` and are byte-identical to the
 * master's, so with JavaScript off the pagination is ordinary navigation —
 * ADR-0005 §1's "(works JS-off)" is a property of the markup, not a claim.
 * With htmx loaded, the same click becomes a GET whose response replaces
 * `.pm-plp` in place and pushes the URL (boosted links push by default),
 * so the measurement condition stays a URL-shaped receipt (ADR-0004 §5).
 *
 * All three attributes ride the ONE `<nav>` element rather than each
 * anchor: `hx-target` and `hx-swap` are inherited by htmx's own attribute
 * inheritance and `hx-boost` applies to descendant anchors, so the links
 * themselves need nothing. That keeps the registered noise to three
 * attributes on one element — the smallest registration that buys the
 * mechanism.
 *
 * The server half is in src/index.js: a request carrying htmx's
 * `HX-Request` header is answered with this block alone instead of the
 * whole document, which is what makes the swap a PARTIAL one and what the
 * `plp-paginate` interaction cell (ADR-0005 §3) would eventually measure.
 */
const PAGINATION_HX = ` hx-boost="true" hx-target=".pm-plp" hx-swap="outerHTML"`;

/**
 * The `.pm-plp` block — the whole surface, and the unit a page-flip swaps.
 *
 * Takes the edge Worker's `/api/plp` payload verbatim
 * (`{ items, page, perPage, total, totalPages, facets }`, workers/edge
 * handlePlp): the tray already carries the paginated slice AND the facet
 * buckets computed over the full snapshot with the same count-desc,
 * code-unit tie-break comparator the reference uses, so this renderer
 * re-derives nothing the data plane already decided. That is the arm:
 * "where the data layer lives" is the server, and the server asks the edge.
 *
 * KNOWN LIMIT, stated rather than hidden: the reference renderer has no
 * `page` option — it renders page 1 and nothing else (plp.mjs:70-72,
 * `summaries.slice(0, n)`; the current-page marker is the literal `1` at
 * :129). At page 1 this function is byte-identical to it, which the
 * pre-merge guard proves. At page > 1 there is no master to be identical
 * TO, so the three things that must vary — the count range, the
 * page-number window, and whether a next link exists at all — are this
 * variant's own until the reference grows the option (the diff is in this
 * unit's handoff note).
 */
function plpBlock({ items, page, perPage, total, totalPages }) {
  const n = perPage;
  const start = (page - 1) * n;
  // An out-of-range page answers 200 with an empty `items` array (the edge
  // Worker floors `page` at 1 but applies no ceiling, workers/edge:125), and
  // the arithmetic range then reads BACKWARDS — "Showing 241–240 of 240",
  // measured, and `src/plp.js` would announce that sentence to a screen
  // reader verbatim. An empty page shows "0", which is true.
  const range = items.length ? `${start + 1}–${start + items.length}` : "0";

  const cards = items
    .map((s, i) => {
      const sizes = `sizes="(max-width: 40em) 50vw, (max-width: 52em) 33vw, 240px"`;
      const attrs =
        i === 0
          ? `\n       fetchpriority="high" ${sizes}`
          : i < 4
            ? `\n       ${sizes}`
            : `\n       loading="lazy" decoding="async" ${sizes}`;
      return releaseCard(s, attrs);
    })
    .join("\n");

  // A five-wide window that CONTAINS the current page, clamped to the ends.
  // The reference pins `1..min(totalPages, 5)` because it only ever renders
  // page 1 (plp.mjs:88), and copying that literally was a defect this unit
  // shipped and then measured: from page 6 on, `p === page` matched nothing,
  // so the nav carried NO `aria-current="page"` at all and offered no route
  // past 5 — six clicks from the front page, on both snapshots. At page 1
  // this window is `1..5` (and `1..1` at n=240), which is why byte identity
  // with the master survives the fix.
  const first = Math.min(Math.max(page - 2, 1), Math.max(totalPages - 4, 1));
  const pages = Array.from(
    { length: Math.min(5, Math.max(totalPages - first + 1, 1)) },
    (_, i) => first + i,
  );
  const pageLink = (p) =>
    p === page
      ? `<span class="pm-pagination__link pm-pagination__link--current" aria-current="page">${p}</span>`
      : `<a class="pm-pagination__link" href="${pageHref(p, n)}">${p}</a>`;

  // "Next" is the reference's one unconditional element (plp.mjs:134) — it
  // emits the link even when there is no next page, which at n=240 points at
  // an empty one. That defect is REPRODUCED at page 1, deliberately: the
  // master can render that condition and the identity guard compares it, so
  // diverging here would be a silent disagreement with the contract at a
  // condition nothing checks. Above page 1 the reference cannot render at
  // all, so there is no contract to honour and the link is emitted only when
  // a next page exists — otherwise "Next" walks forever into empty pages.
  // The one-line reference fix is in this unit's handoff note.
  //
  // THAT FIX LANDED (`renderPlp` now takes `page`), so the escape is gone.
  // `page === 1 ||` existed for exactly one reason: to reproduce the master's
  // unconditional Next at the single condition the master could render, so
  // this arm would not silently disagree with the contract. The contract now
  // gates it too, and react-next mirrors the same rule — one answer, three
  // renderers, which is the point of having a master at all.
  const hasNext = page < totalPages;

  return `      <div class="pm-plp">
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
            <nav class="pm-pagination" aria-label="Pages"${PAGINATION_HX}>
              ${pages.map(pageLink).join("\n              ")}${
                hasNext
                  ? `\n              <a class="pm-pagination__link" href="${pageHref(page + 1, n)}" rel="next">Next</a>`
                  : ""
              }
            </nav>
          </div>
        </div>
      </div>`;
}


/** The full document. `data` is the edge's `/api/plp` payload. */
export function renderPlpPage(data) {
  return pageFrame({
    title: `Records — Long Decay Records`,
    content: plpBlock(data),
    css: PLP_CSS,
    current: "plp",
    scripts: PLP_SCRIPTS,
  });
}

/** The partial: the swap target's own markup, nothing else. Answered to
 *  htmx-originated requests (the `HX-Request` header). */
export function renderPlpFragment(data) {
  return `${plpBlock(data).trimStart()}\n`;
}

/**
 * The branded fallback for a live data-plane failure (the slice-B/D
 * precedent: this is a request-time variant, so an edge error is a real
 * runtime state). Keeps the visitor inside Long Decay Records' own shell —
 * chrome slot included, so the instrument still frames the failure.
 *
 * `current` names the surface the visitor was ON, and it defaults to
 * "editorial" so this page stays byte-identical to the one editorial's
 * receipts were measured against. It is a parameter because a PLP failure
 * was otherwise served with `aria-current="page"` on the masthead's
 * EDITORIAL link — telling a screen-reader user on /htmx/plp/ that the
 * current page is Editorial, a wrong ARIA state served deliberately. The
 * stylesheets stay editorial's either way: the fallback markup is
 * `.pm-editorial`, so those are the sheets it actually needs.
 */
export function renderUnavailablePage({ current = "editorial" } = {}) {
  const content = `      <div class="pm-editorial">
        <p class="pm-page__kicker">Staff pick</p>
        <h1>This page couldn&#39;t load</h1>
        <p>The store&#39;s data plane didn&#39;t answer. This is a simulated demo storefront — nothing was ordered, nothing was lost.</p>
      </div>`;
  return pageFrame({
    title: "This page couldn't load — Long Decay Records",
    content,
    css: EDITORIAL_CSS,
    current,
    scripts: EDITORIAL_SCRIPTS,
  });
}
