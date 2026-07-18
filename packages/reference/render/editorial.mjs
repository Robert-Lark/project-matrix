/**
 * Editorial — the render baseline: prose + exactly ONE interaction (the
 * featured release's Add to cart). The essay is committed CONTENT with an
 * explicit carve-out (panel-revised): prose narrates crate facts ALLUSIVELY;
 * every precise number on the page renders from tray/manifest fields through
 * this template. The dateline is the freeze date. Essays are per-snapshot —
 * the fixture's synthetic register gets a synthetic essay exercising the
 * identical structure.
 */
import { esc, formatPrice, featuredIds, detailById, imageSrc } from "./lib.mjs";
import { page, releaseCard } from "./shell.mjs";

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

export function renderEditorial(snapshot, { origin = "", extraDepth = 0 } = {}) {
  const featured = detailById(snapshot, featuredIds(snapshot).editorial);
  const essay = snapshot.name === "crate" ? CRATE_ESSAY : FIXTURE_ESSAY;
  const figureImg = featured.images[1] ?? featured.images[0];

  const blocks = essay
    .body(featured, snapshot.manifest)
    .map((b) => {
      const [kind, ...rest] = b.split(":");
      const text = rest.join(":");
      return kind === "blockquote" ? `<blockquote><p>${text}</p></blockquote>` : `<p>${text}</p>`;
    });
  // The one figure sits after the opening paragraph.
  blocks.splice(
    1,
    0,
    `<figure><img src="${esc(imageSrc(figureImg.src, origin))}" width="${figureImg.width}" height="${figureImg.height}" alt="${esc(figureImg.alt)}" loading="lazy" decoding="async"><figcaption>${esc(featured.artist)} — ${esc(featured.title)} (${esc(featured.labels[0]?.name ?? "")}${featured.labels[0]?.catno ? ` · ${esc(featured.labels[0].catno)}` : ""}), from the frozen snapshot.</figcaption></figure>`,
  );

  const summary = snapshot.summaries.find((s) => s.id === featured.id);

  const content = `      <article class="pm-editorial">
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
${releaseCard(summary, { origin })}
          </ul>
          <div class="pm-editorial__feature-body">
            <p class="pm-editorial__feature-note">${esc(essay.featureNote(featured))}</p>
            <div><button class="pm-button" type="button"${summary.numForSale === 0 ? " disabled" : ""}>Add to cart</button></div>
            <p class="pm-editorial__feature-note">The only interactive element on this page — that's the experiment.</p>
          </div>
        </aside>
      </article>`;

  return page({
    title: `${essay.title} — Long Decay Records`,
    depth: 2 + extraDepth,
    css: [
      "components/release-card.css",
      "components/prose.css",
      "surfaces/editorial.css",
    ],
    current: "editorial",
    content,
  });
}
