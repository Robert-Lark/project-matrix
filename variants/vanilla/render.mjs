// The vanilla editorial page — this variant's OWN re-implementation of the
// canonical markup (ADR-0003 §1: a component is a spec, re-implemented per
// paradigm; ADR-0008: packages/reference/surfaces/editorial/ is the contract
// of record). Nothing here imports the reference renderer: essay copy is
// re-typed as variant-owned content and the formatting rules are
// re-implemented to the canonical spec (packages/reference/render/lib.mjs is
// the rules of record) — the drift gate polices textual identity both ways,
// in CI against the fixture master and on the deployed plane against the
// master re-rendered from the resolved snapshot (ADR-0008 §9). That call —
// re-type, not build-time import — is recorded in DIFF-TO-STARTER.md.

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

/** The canonical font-loading markup (@pm/tokens/fonts/loading-markup.html)
 *  verbatim modulo the base path — ADR-0003 §8: fonts are a controlled
 *  constant, only the asset base may differ per consumer. */
const FONT_MARKUP = [
  `<link rel="preload" href="../assets/pm/fonts/FamiljenGrotesk.var.woff2" as="font" type="font/woff2" crossorigin>`,
  `<link rel="preload" href="../assets/pm/fonts/PMCrateSymbols.woff2" as="font" type="font/woff2" crossorigin>`,
  `<link rel="stylesheet" href="../assets/pm/css/fonts.css">`,
];

function head(title) {
  return [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    ...FONT_MARKUP,
    ...CSS.map((f) => `<link rel="stylesheet" href="../assets/pm/css/${f}">`),
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
      <span class="pm-release-card__price">${price ?? "—"}</span>
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
  <script src="../assets/cart.js" defer></script>
</body>
</html>
`;
}
