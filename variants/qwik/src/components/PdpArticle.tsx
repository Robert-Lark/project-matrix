import type { PdpRelease } from "../lib/edge";
import { formatPrice, stockLine } from "../lib/format";
import { formatComposition, formatDuration } from "../lib/pdp-format";
import { LiveOriginDemo } from "./LiveOriginDemo";
import { PdpGallery } from "./PdpGallery";
import { PdpPurchase } from "./PdpPurchase";

/**
 * The PDP article, as a Qwik INLINE component (the EditorialArticle
 * precedent: presentational markup is a plain function — no lazy chunk, no
 * serialized props; the three pieces with real interactivity are the
 * `component$` boundaries slotted in). `packages/reference/render/pdp.mjs`
 * is the contract of record; the four masters under
 * `packages/reference/surfaces/pdp/` are what the drift gate holds it to.
 *
 * The degenerate arms are contract too, including the three no committed
 * master gates (lib.mjs pdpRenderClass's recorded gap): an absent notes
 * section, a null track duration (sr-only "No duration listed"), and a null
 * year (named em-dash) — implemented from pdp.mjs source, precisely because
 * no fixture master takes those arms.
 */

/** A glyph standing in for absent data with the name it needs to be heard
 *  (lib.mjs namedGlyph, ported — authored literals only, never tray data). */
function NamedGlyph({ glyph, name }: { glyph: string; name: string }) {
  return (
    <>
      <span aria-hidden="true">{glyph}</span>
      <span class="pm-sr-only">{name}</span>
    </>
  );
}

/** One notes paragraph: the master escapes then turns single newlines into
 *  <br> — interleaving real <br> elements between split lines reproduces
 *  that as DOM (strings never sit adjacent). */
function NotesParagraph({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  return (
    <p>{lines.flatMap((line, i) => (i === 0 ? [line] : [<br key={i} />, line]))}</p>
  );
}

export function PdpArticle({ detail: d }: { detail: PdpRelease }) {
  const price = formatPrice(d.priceFrom);
  const sold = d.numForSale === 0;

  return (
    <article class="pm-pdp">
      <p class="pm-pdp__back">
        <a href="/react-next/plp/plain/">Back to all records</a>
      </p>
      <div class="pm-pdp__top">
        <PdpGallery images={d.images} />
        <div class="pm-pdp__buy">
          <h1 class="pm-pdp__title">{d.title}</h1>
          <p class="pm-pdp__artist">{d.artist}</p>
          <p class="pm-pdp__price">
            <span class="pm-pdp__amount">
              {price ?? <NamedGlyph glyph="—" name="No price listed" />}
            </span>{" "}
            <span class="pm-pdp__stock">{stockLine(d.numForSale)}</span>
          </p>
          <PdpPurchase id={d.id} title={d.title} sold={sold} />
          <dl class="pm-pdp__meta">
            <dt>Label</dt>
            <dd>{d.labels.map((l) => `${l.name}${l.catno ? ` · ${l.catno}` : ""}`).join("; ")}</dd>
            <dt>Format</dt>
            <dd>{formatComposition(d.formats)}</dd>
            <dt>Year</dt>
            <dd>{d.year ?? <NamedGlyph glyph="—" name="No year listed" />}</dd>
            <dt>Genre</dt>
            <dd>{[...d.genres, ...d.styles].join(", ")}</dd>
          </dl>
        </div>
      </div>
      {d.tracklist.length > 0 ? (
        <section class="pm-pdp__section">
          <div class="pm-pdp__scroll" role="region" aria-label="Tracklist" {...{ tabindex: "0" }}>
            <table class="pm-tracklist">
              <caption class="pm-tracklist__caption">Tracklist</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span aria-hidden="true">#</span>
                    <span class="pm-sr-only">Position</span>
                  </th>
                  <th scope="col">Title</th>
                  <th scope="col" class="pm-tracklist__dur">
                    Length
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.tracklist.map((t, i) => (
                  <tr key={i}>
                    <td>{t.position}</td>
                    <td>{t.title}</td>
                    <td class="pm-tracklist__dur">
                      {t.durationSeconds == null ? (
                        <span class="pm-sr-only">No duration listed</span>
                      ) : (
                        formatDuration(t.durationSeconds)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {d.notes ? (
        <section class="pm-pdp__section">
          <h2 class="pm-pdp__section-title">Notes</h2>
          <div class="pm-prose">
            {d.notes.split(/\n{2,}/).map((paragraph, i) => (
              <NotesParagraph key={i} text={paragraph} />
            ))}
          </div>
        </section>
      ) : null}
      <section class="pm-pdp__section">
        <aside class="pm-plaque pm-plaque--fenced" data-pm-fenced="true">
          <p class="pm-plaque__kicker">Fenced demonstration</p>
          <p class="pm-plaque__name">
            <strong>The live-origin demonstration</strong>
          </p>
          <p class="pm-plaque__claim">
            {"The price above is real captured data, served the way production serves catalog data. This button asks the live Discogs API for today's price instead — the real cost of a dynamic origin, on demand. A live call can't be reproduced run-to-run, so what it returns is never fed into a benchmark number."}
          </p>
          <p class="pm-plaque__claim">
            <LiveOriginDemo id={d.id} />
          </p>
          <p class="pm-plaque__rule">measured with the same harness · excluded from every benchmark number</p>
        </aside>
      </section>
    </article>
  );
}
