/**
 * PDP — interactivity earns its JS (ADR-0002 guardrail: gallery, cart,
 * quantity, format all genuine). Degenerate states are contract (panel
 * finding): single-format releases (439/500) render a static meta line, no
 * radio group; unpriced/zero-stock renders em-dash + "none for sale" +
 * disabled CTA. The live-origin demonstration ships as a FENCED plaque with
 * ADR-0002 §3's mandatory copy.
 */
import {
  esc,
  formatPrice,
  formatDuration,
  stockLine,
  featuredIds,
  detailById,
  thumbSrc,
  imageSrc,
} from "./lib.mjs";
import { page, HOSTS } from "./shell.mjs";

function galleryBlock(d, origin) {
  const main = d.images[0];
  const thumbs =
    d.images.length > 1
      ? `
        <ul class="pm-gallery__thumbs" role="list">
          ${d.images
            .map(
              (img, i) => `<li><button class="pm-gallery__thumb" type="button"${i === 0 ? ` aria-current="true"` : ""}>
            <img src="${esc(imageSrc(thumbSrc(img.src), origin))}" width="160" height="160" alt="" loading="lazy" fetchpriority="low" decoding="async">
            <span class="pm-sr-only">View image ${i + 1} of ${d.images.length}: ${esc(img.alt)}</span>
          </button></li>`,
            )
            .join("\n          ")}
        </ul>`
      : "";
  return `<div class="pm-gallery">
        <figure class="pm-gallery__stage">
          <img class="pm-gallery__main" src="${esc(imageSrc(main.src, origin))}" width="${main.width}" height="${main.height}" alt="${esc(main.alt)}" fetchpriority="high">
          <button class="pm-gallery__zoom" type="button" aria-pressed="false">Zoom</button>
        </figure>${thumbs}
      </div>`;
}

function formatBlock(d) {
  if (d.formats.length <= 1) return "";
  return `
        <fieldset class="pm-format">
          <legend class="pm-format__legend">Format</legend>
          ${d.formats
            .map((f, i) => {
              const label = [f.name, f.qty > 1 ? `${f.qty}×` : "", ...(f.descriptions ?? [])]
                .filter(Boolean)
                .join(" · ");
              return `<label class="pm-format__option">
            <input class="pm-format__input" type="radio" name="format" value="${i}"${i === 0 ? " checked" : ""}>
            <span class="pm-format__label">${esc(label)}</span>
          </label>`;
            })
            .join("\n          ")}
        </fieldset>`;
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

export function renderPdp(snapshot, { origin = "", id, extraDepth = 0 } = {}) {
  const d = detailById(snapshot, id ?? featuredIds(snapshot).pdp);
  const price = formatPrice(d.priceFrom);
  const sold = d.numForSale === 0;
  const singleFormat = d.formats.length <= 1;

  const content = `      <article class="pm-pdp">
        <p class="pm-pdp__back"><a href="${HOSTS.plp}">Back to all records</a></p>
        <div class="pm-pdp__top">
          ${galleryBlock(d, origin)}
          <div class="pm-pdp__buy">
            <h1 class="pm-pdp__title">${esc(d.title)}</h1>
            <p class="pm-pdp__artist">${esc(d.artist)}</p>
            <p class="pm-pdp__price"><span class="pm-pdp__amount">${price ?? "—"}</span> <span class="pm-pdp__stock">${esc(stockLine(d.numForSale))}</span></p>${formatBlock(d)}
            <div class="pm-qty">
              <label class="pm-qty__label" for="qty">Quantity</label>
              <div class="pm-qty__group">
                <button class="pm-qty__step" type="button">−<span class="pm-sr-only">Decrease quantity</span></button>
                <input class="pm-qty__input" id="qty" name="qty" type="number" inputmode="numeric" min="1" max="99" value="1">
                <button class="pm-qty__step" type="button">+<span class="pm-sr-only">Increase quantity</span></button>
              </div>
            </div>
            <div><button class="pm-button" type="button"${sold ? " disabled" : ""}>${sold ? "None for sale" : "Add to cart"}</button></div>
            <dl class="pm-pdp__meta">
              <dt>Label</dt><dd>${esc(d.labels.map((l) => `${l.name}${l.catno ? ` · ${l.catno}` : ""}`).join("; "))}</dd>
              ${singleFormat ? `<dt>Format</dt><dd>${esc(d.format)}</dd>\n              ` : ""}<dt>Year</dt><dd>${d.year ?? "—"}</dd>
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
      </article>`;

  return page({
    title: `${d.title} — ${d.artist} — Long Decay Records`,
    depth: 2 + extraDepth,
    css: [
      "components/gallery.css",
      "components/format-switch.css",
      "components/qty.css",
      "components/tracklist.css",
      "components/prose.css",
      "components/plaque.css",
      "surfaces/pdp.css",
    ],
    current: "plp",
    content,
  });
}
