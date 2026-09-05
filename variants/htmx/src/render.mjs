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

/** The PLP's per-surface sheets (packages/reference/render/plp.mjs PLP_CSS).
 *  `facets.css` is back with the rail it styles (2026-09-04). */
const PLP_CSS = [
  ...SHELL_CSS,
  "components/release-card.css",
  "components/facets.css",
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

/** The reference's defaults, re-typed (plp.mjs PER_PAGE / STYLE_CUT /
 *  FORMAT_CUT). PER_PAGE is load-bearing beyond the default page size:
 *  `conditionHref` omits `n` when it equals PER_PAGE, so the master's hrefs
 *  read `?page=2` rather than `?page=2&n=24`. */
const PER_PAGE = 24;
const STYLE_CUT = 12;
const FORMAT_CUT = 8;

/** The sort select's options, in the master's order (plp.mjs SORT_OPTIONS).
 *  The default is the snapshot's committed order — id-ascending, per
 *  snapshot-capture — and is labelled as such, never "Popularity". */
const SORT_OPTIONS = [
  ["", "Catalogue order"],
  ["year-desc", "Year — newest first"],
  ["year-asc", "Year — oldest first"],
  ["price-asc", "Price — low to high"],
  ["price-desc", "Price — high to low"],
  ["title", "Title — A to Z"],
];

/** The knobs a carried value must look like to ride an href (plp.mjs
 *  CARRY_RE) — `run` and `profile` are opaque pass-throughs, bounded. */
const CARRY_RE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * THE ONE HREF RULE, re-typed from the master (plp.mjs `conditionHref`):
 * knobs in canonical order, each omitted at its default, the bare condition
 * spelled `?page=1`, `URLSearchParams` encoding. Pagination, facets, both
 * forms' hidden inputs and the boosted swaps all spell a condition this way.
 *
 * It carries `cache`, `run` and `profile` — the defect the first PLP build
 * reported and could not fix alone: a page-flip from this arm's own preset
 * (`/htmx/plp/?cache=cold`) used to land on the WARM tier while the injected
 * chrome, rendered against the original search outside the swapped subtree,
 * still read `cache: cold`. A query-only relative reference REPLACES the
 * whole query (RFC 3986 §5.3), so every knob rides explicitly.
 */
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

/** A GET form's hidden inputs (plp.mjs `hiddenKnobs`): every non-default
 *  knob except `page` (a new filter starts at page 1) and the form's own
 *  control, in canonical order so DOM-order serialization spells the URL the
 *  way `conditionHref` does. */
function hiddenKnobs(condition, own) {
  // Two halves (plp.mjs): a browser serializes a GET form in TREE order, so
  // the knobs that canonically FOLLOW the form's own control — the sort
  // form's `q` — are emitted after it, and a JS-off submit spells the
  // condition the way `plpConditionHref` does (verify-slice, 2026-09-18).
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

/**
 * THE PARADIGM'S MECHANISM, and the reason this build registers `^hx-`
 * under `behaviorAttrPatterns` (tools/drift-gate/src/normalize.ts).
 *
 * `hx-target` and `hx-swap` ride the `.pm-plp` ROOT and are inherited by
 * every boosted element inside it; `hx-boost="true"` rides the FOUR
 * navigation containers — the facet rail, the search form, the sort form,
 * the pagination — and NOT the root. That placement is load-bearing, and
 * the design critique caught the alternative before it shipped: `hx-boost`
 * on the root would boost every descendant same-origin anchor
 * (htmx.js `boostElement`), including the 24 card links to
 * `/vanilla/pdp/<slug>/` — so a click on a record title would GET the whole
 * PDP document and swap it INTO the grid, masthead and second chrome slot
 * included. Cards stay plain navigation; the four containers that navigate
 * WITHIN this surface are enhanced. A boosted GET form is htmx's documented
 * "real forms, enhanced" (the same `hx-boost` covers forms and anchors), so a
 * search and a sort become partial swaps exactly as a page-flip does.
 *
 * Six attributes on five elements, all under the one registered prefix. The
 * anchors and forms keep their own `href`/`action`, byte-identical to the
 * master's, so with JavaScript off every control is ordinary navigation —
 * ADR-0005 §1's "(works JS-off)" is a property of the markup, not a claim.
 *
 * The server half is in src/index.js: a request carrying htmx's `HX-Request`
 * header is answered with this block alone instead of the whole document,
 * which is what makes the swap a PARTIAL one.
 */
const PLP_HX_ROOT = ` hx-target=".pm-plp" hx-swap="outerHTML"`;
const HX_BOOST = ` hx-boost="true"`;

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
 * The `.pm-plp` block — the whole surface, and the unit a swap replaces.
 *
 * Takes the edge Worker's `/api/plp` payload verbatim (`{ items, page,
 * perPage, total, totalPages, facets, applied }`): the tray already carries
 * the paginated slice, the facet buckets RECOUNTED over the filtered set, and
 * the query the data plane APPLIED. Everything the block shows — the grid,
 * the count, the selected facet, the chosen sort, the search box's value —
 * comes from the payload; `carry` contributes only the three knobs the tray
 * cannot know (`cache`, `run`, `profile`), read off the request URL. That is
 * the arm: "where the data layer lives" is the server, and the server asks
 * the edge, and re-derives nothing the data plane already decided.
 */
function plpBlock({ items, page, perPage, total, totalPages, facets, applied }, carry = {}) {
  const n = perPage;
  const condition = { n, page, cache: carry.cache, run: carry.run, profile: carry.profile, ...applied };
  const start = (page - 1) * n;
  // An out-of-range page answers 200 with an empty `items` array (the edge
  // floors `page` at 1 and applies its ceiling on the way out — a page past
  // the end is served, never stored), and the arithmetic range would read
  // BACKWARDS — "Showing 241–240 of 240"; `src/plp.js` would announce that
  // sentence to a screen reader verbatim. An empty page shows "0", which is
  // true.
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

  // A five-wide window that CONTAINS the current page, clamped to the ends
  // (plp.mjs): from page 6 on the naive `1..5` window carried NO
  // `aria-current="page"` at all — measured on both snapshots before the
  // reference grew its `page` option.
  const first = Math.min(Math.max(page - 2, 1), Math.max(totalPages - 4, 1));
  const pages = Array.from(
    { length: Math.min(5, Math.max(totalPages - first + 1, 1)) },
    (_, i) => first + i,
  );
  const pageLink = (p) =>
    p === page
      ? `<span class="pm-pagination__link pm-pagination__link--current" aria-current="page">${p}</span>`
      : `<a class="pm-pagination__link" href="${esc(conditionHref({ ...condition, page: p }))}">${p}</a>`;
  // Gated on a real next page, as the master gates it. An EMPTY result has
  // no pagination landmark at all (plp.mjs): no page 1 of 0.
  const hasNext = page < totalPages;

  const searchHidden = hiddenKnobs(condition, "q");
  const sortHidden = hiddenKnobs(condition, "sort");
  const qValue = applied.q ? ` value="${esc(applied.q)}"` : "";
  const options = SORT_OPTIONS.map(
    ([value, label]) =>
      `<option value="${value}"${(applied.sort ?? "") === value ? " selected" : ""}>${esc(label)}</option>`,
  );

  return `      <div class="pm-plp"${PLP_HX_ROOT}>
        <header class="pm-plp__head">
          <h1 class="pm-page__title">Records</h1>
          <div class="pm-toolbar">
            <p class="pm-toolbar__count">Showing <span class="pm-toolbar__n">${range}</span> of <span class="pm-toolbar__n">${total}</span> releases</p>
            <form class="pm-toolbar__search" method="get" action=""${HX_BOOST}>${searchHidden.before.map((f) => `\n              ${f}`).join("")}
              <div>
                <label class="pm-toolbar__label" for="plp-q">Search the crate</label>
                <input class="pm-toolbar__input" id="plp-q" name="q" type="search" autocomplete="off"${qValue}>
              </div>${searchHidden.after.map((f) => `\n              ${f}`).join("")}
              <button class="pm-button pm-button--secondary" type="submit">Search</button>
            </form>
            <form class="pm-toolbar__sort" method="get" action=""${HX_BOOST}>${sortHidden.before.map((f) => `\n              ${f}`).join("")}
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
          <nav class="pm-facets" aria-label="Filters"${HX_BOOST}>
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
            <nav class="pm-pagination" aria-label="Pages"${HX_BOOST}>
              ${pages.map(pageLink).join("\n              ")}${
                hasNext
                  ? `\n              <a class="pm-pagination__link" href="${esc(conditionHref({ ...condition, page: page + 1 }))}" rel="next">Next</a>`
                  : ""
              }
            </nav>`
                : ""
            }
          </div>
        </div>
      </div>`;
}

/** The full document. `data` is the edge's `/api/plp` payload; `carry` the
 *  three URL knobs the tray cannot know (see plpBlock). */
export function renderPlpPage(data, carry = {}) {
  return pageFrame({
    title: `Records — Long Decay Records`,
    content: plpBlock(data, carry),
    css: PLP_CSS,
    current: "plp",
    scripts: PLP_SCRIPTS,
  });
}

/** The partial: the `.pm-plp` block ALONE — exactly the swap target, so a
 *  boosted request replaces the surface and nothing else. */
export function renderPlpFragment(data, carry = {}) {
  return `${plpBlock(data, carry).trimStart()}\n`;
}

/** The canonical spelling of the condition a tray ANSWERS — the served
 *  page/n/applied query plus the carried knobs — for the Worker's
 *  `HX-Push-Url`. htmx pushes the REQUEST URL by default, which for a boosted
 *  form is whatever the visitor typed (`?q=++Golden++`, encodeURIComponent
 *  spelling); the data plane normalizes `q` and the address bar should name
 *  the condition it now shows, spelled the way every link spells it. */
export function plpConditionHref(data, carry = {}) {
  return conditionHref({
    n: data.perPage,
    page: data.page,
    cache: carry.cache,
    run: carry.run,
    profile: carry.profile,
    ...data.applied,
  });
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
export function renderUnavailablePage({ current = "editorial", reason = "unavailable" } = {}) {
  // `reason: "no-such-filter"` is the PLP's answer to a tray 400 — a facet or
  // sort value the snapshot does not hold. It is a 404 and says so; the
  // generic branch below is the data plane NOT ANSWERING, and reporting a
  // near-miss filter as an outage was the served falsehood the design
  // critique caught (the plane answered — with a 400).
  const content =
    reason === "no-such-filter"
      ? `      <div class="pm-editorial">
        <p class="pm-page__kicker">Records</p>
        <h1>No such filter</h1>
        <p>Nothing in the crate is filed under that value. The filters on the <a href="/htmx/plp/">catalogue</a> list what there is.</p>
      </div>`
      : `      <div class="pm-editorial">
        <p class="pm-page__kicker">Staff pick</p>
        <h1>This page couldn&#39;t load</h1>
        <p>The store&#39;s data plane didn&#39;t answer. This is a simulated demo storefront — nothing was ordered, nothing was lost.</p>
      </div>`;
  return pageFrame({
    title:
      reason === "no-such-filter"
        ? "No such filter — Long Decay Records"
        : "This page couldn't load — Long Decay Records",
    content,
    css: EDITORIAL_CSS,
    current,
    scripts: EDITORIAL_SCRIPTS,
  });
}
