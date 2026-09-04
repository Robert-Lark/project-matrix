// The vanilla editorial page — this variant's OWN re-implementation of the
// canonical markup (ADR-0003 §1: a component is a spec, re-implemented per
// paradigm; ADR-0008: packages/reference/surfaces/editorial/ is the contract
// of record). Nothing here imports the reference renderer FOR A BENCHMARKED
// SURFACE: essay copy is re-typed as variant-owned content and the formatting
// rules are re-implemented to the canonical spec (packages/reference/render/
// lib.mjs is the rules of record) — the drift gate polices textual identity
// both ways, in CI against the fixture master and on the deployed plane
// against the master re-rendered from the resolved snapshot (ADR-0008 §9).
// That call — re-type, not build-time import — is recorded in
// DIFF-TO-STARTER.md (decision 1).
//
// The ONE exception is the a11y section at the bottom of this file, a
// SINGLETON off the benchmarked matrix: it is rendered by the reference
// renderer itself under this variant's head, slot and script (DIFF-TO-STARTER
// decision 6; the how-it-was-built precedent, ADR-0004 §2 addendum). Re-typing
// buys the store nothing where no paradigm is being compared, and two
// renderers over one spec is this repo's recorded recurring failure.
import {
  renderA11yElementDemos,
  renderA11yIndex,
  renderA11yModeDemos,
} from "@pm/reference/render/a11y.mjs";

/** HTML-escape interpolated tray values (frozen data is still external). */
function esc(value) {
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
function metaLine(summary) {
  return summary.year == null ? summary.format : `${summary.format} · ${summary.year}`;
}

/** Canonical format composition (lib.mjs rules of record): every component of
 *  the release in tray order, "N × " where the tray records more than one of
 *  a medium, components joined with "; ". A Discogs `formats` array is what
 *  is IN the package, not a menu — which is why the PDP renders it as data
 *  and carries no format control (ADR-0008 addendum A). */
function formatComposition(formats) {
  return formats
    .map((f) => {
      const body =
        f.descriptions.length > 0 ? `${f.name}, ${f.descriptions.join(", ")}` : f.name;
      return f.qty > 1 ? `${f.qty} × ${body}` : body;
    })
    .join("; ");
}

/** Canonical stand-in for absent data (lib.mjs rules of record): a lone "—"
 *  announces as "em dash" or as nothing, making absent data and a rendering
 *  fault sound alike — so the glyph is hidden and a real phrase rides beside
 *  it. Both arguments are authored literals, never tray data. */
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

const CSS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/release-card.css",
  "components/prose.css",
  "surfaces/editorial.css",
];

/** The PDP's surface sheets (packages/reference/render/pdp.mjs `css`). */
const PDP_CSS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/gallery.css",
  "components/qty.css",
  "components/tracklist.css",
  "components/prose.css",
  "components/plaque.css",
  "surfaces/pdp.css",
];

/**
 * The asset base for a page `depth` directories below the variant root.
 *
 * Every asset URL this variant emits is RELATIVE, and until the PDP every
 * page sat at exactly one level (`/vanilla/editorial/`), so the base was the
 * literal "../". A PDP sits one deeper (`/vanilla/pdp/{slug}/`) and every
 * stylesheet, font and script would 404 unchanged. Deriving the base from
 * depth — the shape `packages/reference/render/shell.mjs` already uses for
 * its masters (`"../".repeat(depth)`) — is deliberately preferred to adding a
 * second literal: two literals is how the first one silently goes wrong when
 * a third surface lands.
 */
const assetBase = (depth) => "../".repeat(depth) + "assets/";

/** The canonical font-loading markup (@pm/tokens/fonts/loading-markup.html)
 *  verbatim modulo the base path — ADR-0003 §8: fonts are a controlled
 *  constant, only the asset base may differ per consumer. */
function fontMarkup(depth) {
  const a = assetBase(depth);
  return [
    `<link rel="preload" href="${a}pm/fonts/FamiljenGrotesk.var.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="preload" href="${a}pm/fonts/PMCrateSymbols.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="${a}pm/css/fonts.css">`,
  ];
}

function head(title, { depth = 1, css = CSS, noindex = false } = {}) {
  const a = assetBase(depth);
  return [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    // The master's own <meta name="robots"> line, byte for byte (shell.mjs
    // head()); the element-demos page is noindex by contract (strategy-review
    // finding 21) and the head callback below carries the flag through.
    ...(noindex ? [`<meta name="robots" content="noindex">`] : []),
    ...fontMarkup(depth),
    ...css.map((f) => `<link rel="stylesheet" href="${a}pm/css/${f}">`),
  ].join("\n  ");
}

function releaseCard(summary) {
  const price = formatPrice(summary.priceFrom);
  const c = summary.cover;
  return `<li class="pm-release-card">
  <img class="pm-release-card__media" width="${c.width}" height="${c.height}"
       alt="${esc(c.alt)}" src="${esc(c.src)}">
  <div class="pm-release-card__body">
    <h3 class="pm-release-card__title"><a class="pm-release-card__link" href="${esc(`/vanilla/pdp/${summary.slug}/`)}">${esc(summary.title)}</a></h3>
    <p class="pm-release-card__artist">${esc(summary.artist)}</p>
    <p class="pm-release-card__meta">${esc(metaLine(summary))}</p>
    <div class="pm-release-card__foot">
      <span class="pm-release-card__price">${price ?? namedGlyph("—", "No price listed")}</span>
      <span class="pm-release-card__stock">${esc(stockLine(summary.numForSale))}</span>
    </div>
  </div>
</li>`;
}

/**
 * Render the editorial page for one loaded snapshot. `snapshot` is the
 * build's own tray load: { name, manifest, summaries, details }; `featuredId`
 * selects the essay's subject.
 */
export function renderEditorialPage(snapshot, featuredId) {
  const featured = snapshot.details.find((d) => d.id === featuredId);
  if (!featured) throw new Error(`${snapshot.name}: no detail tray for id ${featuredId}`);
  const summary = snapshot.summaries.find((s) => s.id === featured.id);
  if (!summary) throw new Error(`${snapshot.name}: no summary tray for id ${featuredId}`);
  const essay = snapshot.name === "crate" ? CRATE_ESSAY : FIXTURE_ESSAY;

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
  // attribute and vanilla stays the NO_NOISE control. `<` is escaped so a
  // tray string can never close the script element early.
  const cartItem = JSON.stringify({ id: featured.id, title: featured.title }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  ${head(`${essay.title} — Long Decay Records`)}
</head>
<body>
  <a class="pm-skip pm-button" href="#main">Skip to content</a>
  <div id="pm-chrome-slot"></div>
  <div class="pm-page">
    <header class="pm-masthead">
      <a class="pm-masthead__brand" href="/">Long Decay<span> Records</span></a>
      <nav class="pm-masthead__nav" aria-label="Store">
        <a class="pm-masthead__link" href="/react-next/plp/plain/">Records</a>
        <a class="pm-masthead__link" href="/vanilla/editorial/" aria-current="page">Editorial</a>
      </nav>
      <a class="pm-masthead__cart" href="/vanilla/checkout/">Cart<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span></a>
    </header>
    <main id="main">
      <article class="pm-editorial">
        <header class="pm-editorial__head">
          <p class="pm-page__kicker">${esc(essay.kicker)}</p>
          <h1 class="pm-editorial__title">${esc(essay.title)}</h1>
          <p class="pm-editorial__dek">${esc(essay.dek)}</p>
          <p class="pm-editorial__dateline">From the crate · frozen <time datetime="${esc(snapshot.manifest.capturedAt)}">${esc(snapshot.manifest.capturedAt)}</time></p>
        </header>
        <div class="pm-prose">
          ${blocks.join("\n          ")}
        </div>
        <aside class="pm-editorial__feature" aria-label="Featured release">
          <ul class="pm-grid" role="list">
${releaseCard(summary)}
          </ul>
          <div class="pm-editorial__feature-body">
            <p class="pm-editorial__feature-note">${esc(essay.featureNote(featured))}</p>
            <div><button class="pm-button" type="button"${summary.numForSale === 0 ? " disabled" : ""}>Add to cart</button></div>
            <p class="pm-editorial__feature-note">The only interactive element on this page — that's the experiment.</p>
          </div>
        </aside>
      </article>
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
  <script type="application/json" id="pm-cart-item">${cartItem}</script>
  <script src="${assetBase(1)}cart.js" defer></script>
</body>
</html>
`;
}

/* ── The PDP (pdp-build) ───────────────────────────────────────────────────
   This variant's OWN re-implementation of the canonical PDP markup
   (packages/reference/render/pdp.mjs is the contract of record; the drift
   gate polices textual identity against the master re-rendered from the
   RESOLVED snapshot, both in CI against the fixture and on the deployed
   plane against the crate — ADR-0008 §9).

   Formatting is NOT re-invented: formatPrice/stockLine above are the
   canonical rules re-implemented to spec, and formatDuration joins them
   below. `Intl.NumberFormat` is deliberately not used — the gate compares
   rendered TEXT, and Intl would drift on the first non-USD or four-digit
   price (ADR-0008's normative formatting note).
   ───────────────────────────────────────────────────────────────────────── */

/** Canonical track duration: m:ss, h:mm:ss past an hour, "" when null. */
function formatDuration(durationSeconds) {
  if (durationSeconds == null) return "";
  const s = Math.round(durationSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** The 160 px thumb derivative, by the URL convention over the frozen tray
 *  src (ADR-0008 §11 — the trays themselves are untouched). */
function thumbSrc(src) {
  return src.replace(/\.avif$/, ".thumb.avif");
}

function galleryBlock(d) {
  const main = d.images[0];
  // A 1-image release (90/500 in the crate) omits the whole thumb list.
  const thumbs =
    d.images.length > 1
      ? `
        <ul class="pm-gallery__thumbs" role="list">
          ${d.images
            .map(
              (img, i) => `<li><button class="pm-gallery__thumb" type="button"${i === 0 ? ` aria-current="true"` : ""}>
            <img src="${esc(thumbSrc(img.src))}" width="160" height="160" alt="" loading="lazy" fetchpriority="low" decoding="async">
            <span class="pm-sr-only">View image ${i + 1} of ${d.images.length}: ${esc(img.alt)}</span>
          </button></li>`,
            )
            .join("\n          ")}
        </ul>`
      : "";
  return `<div class="pm-gallery">
        <figure class="pm-gallery__stage">
          <img class="pm-gallery__main" src="${esc(main.src)}" width="${main.width}" height="${main.height}" alt="${esc(main.alt)}" fetchpriority="high">
          <button class="pm-gallery__zoom" type="button" aria-pressed="false">Zoom</button>
        </figure>${thumbs}
      </div>`;
}

function notesBlock(d) {
  if (!d.notes) return "";
  const paragraphs = d.notes
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replaceAll("\n", "<br>")}</p>`)
    .join("\n            ");
  return `
      <section class="pm-pdp__section">
        <h2 class="pm-pdp__section-title">Notes</h2>
        <div class="pm-prose">
            ${paragraphs}
        </div>
      </section>`;
}

function tracklistBlock(d) {
  if (!d.tracklist.length) return "";
  return `
      <section class="pm-pdp__section">
        <div class="pm-pdp__scroll" role="region" aria-label="Tracklist" tabindex="0">
        <table class="pm-tracklist">
          <caption class="pm-tracklist__caption">Tracklist</caption>
          <thead><tr><th scope="col"><span aria-hidden="true">#</span><span class="pm-sr-only">Position</span></th><th scope="col">Title</th><th scope="col" class="pm-tracklist__dur">Length</th></tr></thead>
          <tbody>
            ${d.tracklist
              .map(
                (t) =>
                  `<tr><td>${esc(t.position)}</td><td>${esc(t.title)}</td><td class="pm-tracklist__dur">${t.durationSeconds == null ? `<span class="pm-sr-only">No duration listed</span>` : formatDuration(t.durationSeconds)}</td></tr>`,
              )
              .join("\n            ")}
          </tbody>
        </table>
        </div>
      </section>`;
}

/**
 * Render one PDP for one detail tray. `depth` is how many directories below
 * the variant root the page will be written (2 for /vanilla/pdp/{slug}/).
 *
 * The masthead marks `plp` current, not a PDP link: there is no PDP entry in
 * the store nav, and the master pins that deliberately (ADR-0008 §6's
 * designated-host link map).
 */
export function renderPdpPage(snapshot, detail, { depth = 2 } = {}) {
  const d = detail;
  const price = formatPrice(d.priceFrom);
  const sold = d.numForSale === 0;
  // The cart enhancement's data hook — delivery, not contract, so the
  // canonical DOM carries no extra attribute and vanilla stays the NO_NOISE
  // control. `<` escaped so a tray string cannot close the element early.
  const cartItem = JSON.stringify({ id: d.id, title: d.title }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  ${head(`${d.title} — ${d.artist} — Long Decay Records`, { depth, css: PDP_CSS })}
</head>
<body>
  <a class="pm-skip pm-button" href="#main">Skip to content</a>
  <div id="pm-chrome-slot"></div>
  <div class="pm-page">
    <header class="pm-masthead">
      <a class="pm-masthead__brand" href="/">Long Decay<span> Records</span></a>
      <nav class="pm-masthead__nav" aria-label="Store">
        <a class="pm-masthead__link" href="/react-next/plp/plain/" aria-current="page">Records</a>
        <a class="pm-masthead__link" href="/vanilla/editorial/">Editorial</a>
      </nav>
      <a class="pm-masthead__cart" href="/vanilla/checkout/">Cart<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span></a>
    </header>
    <main id="main">
      <article class="pm-pdp">
        <p class="pm-pdp__back"><a href="/react-next/plp/plain/">Back to all records</a></p>
        <div class="pm-pdp__top">
          ${galleryBlock(d)}
          <div class="pm-pdp__buy">
            <h1 class="pm-pdp__title">${esc(d.title)}</h1>
            <p class="pm-pdp__artist">${esc(d.artist)}</p>
            <p class="pm-pdp__price"><span class="pm-pdp__amount">${price ?? namedGlyph("—", "No price listed")}</span> <span class="pm-pdp__stock">${esc(stockLine(d.numForSale))}</span></p>
            <div class="pm-qty">
              <label class="pm-qty__label" for="qty">Quantity</label>
              <div class="pm-qty__group">
                <button class="pm-qty__step" type="button"><span aria-hidden="true">−</span><span class="pm-sr-only">Decrease quantity</span></button>
                <input class="pm-qty__input" id="qty" name="qty" type="number" inputmode="numeric" min="1" max="99" value="1">
                <button class="pm-qty__step" type="button"><span aria-hidden="true">+</span><span class="pm-sr-only">Increase quantity</span></button>
              </div>
            </div>
            <div><button class="pm-button" type="button"${sold ? " disabled" : ""}>${sold ? "None for sale" : "Add to cart"}</button></div>
            <dl class="pm-pdp__meta">
              <dt>Label</dt><dd>${esc(d.labels.map((l) => `${l.name}${l.catno ? ` · ${l.catno}` : ""}`).join("; "))}</dd>
              <dt>Format</dt><dd>${esc(formatComposition(d.formats))}</dd>
              <dt>Year</dt><dd>${d.year ?? namedGlyph("—", "No year listed")}</dd>
              <dt>Genre</dt><dd>${esc([...d.genres, ...d.styles].join(", "))}</dd>
            </dl>
          </div>
        </div>${tracklistBlock(d)}${notesBlock(d)}
      <section class="pm-pdp__section">
        <aside class="pm-plaque pm-plaque--fenced" data-pm-fenced="true">
          <p class="pm-plaque__kicker">Fenced demonstration</p>
          <p class="pm-plaque__name"><strong>The live-origin demonstration</strong></p>
          <p class="pm-plaque__claim">The price above is real captured data, served the way production serves catalog data. This button asks the live Discogs API for today's price instead — the real cost of a dynamic origin, on demand. A live call can't be reproduced run-to-run, so what it returns is never fed into a benchmark number.</p>
          <p class="pm-plaque__claim"><button class="pm-button pm-button--secondary" type="button">Fetch today's price live</button> <output data-pm-live-origin></output></p>
          <p class="pm-plaque__rule">measured with the same harness · excluded from every benchmark number</p>
        </aside>
      </section>
      </article>
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
  <script type="application/json" id="pm-cart-item">${cartItem}</script>
  <script src="${assetBase(depth)}pdp.js" defer></script>
</body>
</html>
`;
}

/* ── The checkout (checkout-vanilla) ───────────────────────────────────────
   This variant's OWN re-implementation of the canonical checkout markup
   (packages/reference/render/checkout.mjs is the contract of record). Unlike
   editorial and the PDP this surface is DATA-FREE — `renderCheckout` takes no
   snapshot at all (`build.mjs:78` discards it), so there is no fixture/crate
   flavor to diverge and the whole page is authored constants.

   The canonical SERVED state is the EMPTY cart (ADR-0008 §7: cart is
   localStorage, so no paradigm can serve cart contents) with reserved
   geometry — `cart-summary.css` holds `min-block-size: 12rem` so population
   cannot shift the form beside it. Everything the enhancement writes into the
   summary is therefore invisible to the JS-off drift gate, which is exactly
   the blind spot `pdp-controls` paid for; the guards this unit adds are the
   pre-merge half of the close.

   No `novalidate` in the served markup, deliberately (checkout.mjs:9-12):
   JS-off, native constraint validation IS the behavior the page claims. The
   enhancement sets it at wire-up, when its own validation takes over. */

/** The checkout's sheet list (packages/reference/render/checkout.mjs `css`,
 *  prefixed by the six `head()` ships on every master). Order is cascade
 *  order — a rendering property, not a freedom. */
const CHECKOUT_CSS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/field.css",
  "components/format-switch.css",
  "components/cart-summary.css",
  "components/error-summary.css",
  "components/plaque.css",
  "surfaces/checkout.css",
];

/** One labelled field row — the DS default the contract fixes: label-for,
 *  autocomplete, inputmode, and an aria-describedby hint when there is one.
 *
 *  NO `name`, and that is the contract, not an oversight: the form is a real
 *  `method="post"` form, so JS off it submits natively, and an input with no
 *  `name` is not a successful control — nothing it holds is serialized. That
 *  is what makes the plaque's "what you type never leaves your browser" true
 *  on the JS-off path. `required`/`pattern` mirror checkout.js's RULES, and
 *  they still apply to unnamed controls (constraint validation ignores
 *  `name`). The master carries the full rationale — checkout.mjs:14-42. */
function field({
  id,
  label,
  type = "text",
  autocomplete,
  inputmode,
  hint,
  required = false,
  pattern,
  title,
}) {
  const hintId = hint ? `${id}-hint` : null;
  return `<div class="pm-field">
              <label class="pm-field__label" for="${id}">${label}</label>
              <input class="pm-field__control" id="${id}" type="${type}"${
                autocomplete ? ` autocomplete="${autocomplete}"` : ""
              }${inputmode ? ` inputmode="${inputmode}"` : ""}${required ? " required" : ""}${
                pattern ? ` pattern="${pattern}"` : ""
              }${title ? ` title="${title}"` : ""}${hintId ? ` aria-describedby="${hintId}"` : ""}>${
                hint ? `\n              <span class="pm-field__hint" id="${hintId}">${hint}</span>` : ""
              }
            </div>`;
}

/**
 * Render the checkout page. `depth` is how many directories below the variant
 * root the page is written (1 for /vanilla/checkout/).
 *
 * The masthead marks NOTHING current: checkout is not in the store nav, and
 * the master pins that (`renderCheckout` passes `current: null`).
 */
export function renderCheckoutPage({ depth = 1 } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  ${head("Checkout — Long Decay Records", { depth, css: CHECKOUT_CSS })}
</head>
<body>
  <a class="pm-skip pm-button" href="#main">Skip to content</a>
  <div id="pm-chrome-slot"></div>
  <div class="pm-page">
    <header class="pm-masthead">
      <a class="pm-masthead__brand" href="/">Long Decay<span> Records</span></a>
      <nav class="pm-masthead__nav" aria-label="Store">
        <a class="pm-masthead__link" href="/react-next/plp/plain/">Records</a>
        <a class="pm-masthead__link" href="/vanilla/editorial/">Editorial</a>
      </nav>
      <a class="pm-masthead__cart" href="/vanilla/checkout/">Cart<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span></a>
    </header>
    <main id="main">
      <div class="pm-checkout">
        <h1 class="pm-page__title">Checkout</h1>
        <aside class="pm-plaque">
          <p class="pm-plaque__kicker">Simulated commerce</p>
          <p class="pm-plaque__name"><strong>This checkout is a demonstration.</strong></p>
          <p class="pm-plaque__claim">No payment is processed, nothing ships, and what you type never leaves your browser — this page sends only the same anonymous timing beacons every page here sends. The form is real so the measurement is real.</p>
        </aside>
        <div class="pm-checkout__body">
          <form class="pm-checkout__form" method="post" action="">
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Contact</legend>
              ${field({ id: "email", label: "Email address", type: "email", autocomplete: "email", required: true, hint: "Used only to render the demo confirmation in this page — nothing is ever sent." })}
            </fieldset>
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Shipping address</legend>
              ${field({ id: "name", label: "Full name", autocomplete: "name", required: true })}
              ${field({ id: "address1", label: "Address", autocomplete: "address-line1", required: true })}
              ${field({ id: "address2", label: "Apartment, suite, etc. (optional)", autocomplete: "address-line2" })}
              <div class="pm-checkout__row">
                ${field({ id: "city", label: "City", autocomplete: "address-level2", required: true })}
                ${field({ id: "postal", label: "Postal code", autocomplete: "postal-code", inputmode: "numeric", required: true })}
              </div>
              <div class="pm-checkout__row">
                ${field({ id: "region", label: "State / region", autocomplete: "address-level1", required: true })}
                <div class="pm-field">
                  <label class="pm-field__label" for="country">Country</label>
                  <select class="pm-field__control" id="country" autocomplete="country-name">
                    <option selected>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Germany</option>
                    <option>Japan</option>
                  </select>
                </div>
              </div>
            </fieldset>
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Shipping method</legend>
              <label class="pm-format__option">
                <input class="pm-format__input" type="radio" name="shipping" value="standard" checked>
                <span class="pm-format__label">Standard — free, 5–8 days</span>
              </label>
              <label class="pm-format__option">
                <input class="pm-format__input" type="radio" name="shipping" value="express">
                <span class="pm-format__label">Express — $12.00, 2 days</span>
              </label>
            </fieldset>
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Payment</legend>
              <p class="pm-checkout__jsoff">Demo card fields — type anything; nothing you enter is stored or sent.</p>
              ${field({ id: "card", label: "Card number", autocomplete: "off", inputmode: "numeric", required: true, pattern: "\\d{13,19}", title: "13 to 19 digits", hint: "Formats as you type — that formatting is part of what this page measures." })}
              ${field({ id: "cardname", label: "Name on card", autocomplete: "off", required: true })}
              <div class="pm-checkout__row">
                ${field({ id: "expiry", label: "Expiry (MM/YY)", autocomplete: "off", inputmode: "numeric", required: true, pattern: "(0[1-9]|1[0-2])/\\d{2}", title: "Two digits for the month, then two for the year, as MM/YY" })}
                ${field({ id: "cvc", label: "Security code", autocomplete: "off", inputmode: "numeric", required: true, pattern: "\\d{3,4}", title: "3 or 4 digits" })}
              </div>
            </fieldset>
            <div><button class="pm-button" type="submit">Place order</button></div>
            <p class="pm-checkout__jsoff">With JavaScript off, every field here still works — labels, hints, and native validation that gates the submit. Live card formatting and the error summary are what JavaScript adds; placing the order is the page's JavaScript moment, and that cost is the comparison.</p>
          </form>
          <section class="pm-cart" aria-label="Order summary">
            <h2 class="pm-cart__title">Order summary</h2>
            <p class="pm-cart__empty">Your cart is empty — items appear here as you add them from the store.</p>
            <ul class="pm-cart__lines" role="list"></ul>
            <p class="pm-cart__total"><span>Total</span> <span class="pm-cart__price" data-pm-cart-total>${namedGlyph("—", "No total yet")}</span></p>
          </section>
        </div>
      </div>
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
  <script src="${assetBase(depth)}checkout.js" defer></script>
</body>
</html>
`;
}

/* ── The a11y section (a11y-section build, 2026-09-03) ─────────────────────
   Three pages, a SINGLETON off the benchmarked matrix (ADR-0008 §8; decision
   map `a11y-section`): /vanilla/a11y/ · /vanilla/a11y/element-demos/ ·
   /vanilla/a11y/mode-demos/. Data-free, like the checkout — no snapshot
   flavour, byte-identical under fixture and crate.

   ONE renderer, two heads — the how-it-was-built precedent (ADR-0008 addendum
   B; ADR-0004 §2 addendum: build-time spec consumption is the @pm/tokens
   class, never a component runtime). The body is `renderA11y*` from
   @pm/reference — the very functions that render the committed masters — so
   the served page and the spec cannot drift; what is this variant's is the
   <head> (its own asset base, the master's own sheet list handed back through
   the callback), the chrome slot, and the one script. The pre-merge identity
   guard (test/a11y-master-identity.test.mjs) holds each page to its master
   after the delivery strip, so the composition can add exactly those three
   things and nothing else. Why not re-type, like every surface above: the
   re-implementation rule exists so paradigms are compared on identical
   markup (ADR-0003 §1), and this section compares no paradigms — it is
   served in one variant, measured by nothing. DIFF-TO-STARTER decision 6. */

/** The three pages: dist path → how deep it sits below /vanilla/ (the asset
 *  base derives from depth, never a second literal) and the master renderer
 *  that IS its body. Exported so the build and the guards write and check
 *  the same table. */
export const A11Y_PAGES = {
  a11y: { depth: 1, render: renderA11yIndex },
  "a11y/element-demos": { depth: 2, render: renderA11yElementDemos },
  "a11y/mode-demos": { depth: 2, render: renderA11yModeDemos },
};

/**
 * Render one a11y page for this variant's delivery. `rel` is a key of
 * A11Y_PAGES. The head callback receives the master's OWN title, complete
 * ordered sheet list and noindex flag (shell.mjs `page()`), so no sheet
 * list is re-typed here and the element-demos page's `noindex` is the
 * master's, not this file's memory of it.
 */
export function renderA11yPage(rel) {
  const entry = A11Y_PAGES[rel];
  if (!entry) throw new Error(`renderA11yPage: ${rel} is not an a11y page`);
  const { depth, render } = entry;
  return render({
    head: ({ title, css, noindex }) => head(title, { depth, css, noindex }),
    slot: true,
    scripts: [`<script src="${assetBase(depth)}a11y.js" defer></script>`],
  });
}
