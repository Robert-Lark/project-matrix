// The react-next PDP article — this variant's re-implementation of the
// canonical PDP markup (packages/reference/render/pdp.mjs is the contract of
// record; the four masters under packages/reference/surfaces/pdp/ are what
// the drift gate holds it to).
//
// A SEPARATE server module from render.tsx, deliberately: client components
// referenced from one server module are grouped into shared client chunks,
// so when PdpArticle and its islands lived in render.tsx the EDITORIAL page's
// served chunks grew by 7,984 raw bytes of PDP-only code (measured against
// the deployed plane, chunk by chunk) — on the variant whose editorial
// initial-JS cell is published and pinned. Splitting the server entry keeps
// editorial's chunk set byte-identical to production; the pre-merge guard
// and the origin suite both consume this module the way the route does.
//
// Framework-neutral like render.tsx (no Next imports, relative imports) so
// tools/repo-checks can render it with react-dom/server directly.
import type { ReleaseDetail } from "@pm/data-contract";
import { formatPrice, stockLine } from "./format";
import { formatComposition, formatDuration } from "./pdp-format";
import { HOSTS } from "./render";
import { LiveOriginButton } from "../components/LiveOriginButton";
import { PdpGallery } from "../components/PdpGallery";
import { PdpPurchase } from "../components/PdpPurchase";

/** A glyph standing in for absent data, with the name it needs to be heard
 *  (lib.mjs namedGlyph, ported): the glyph is aria-hidden and a real phrase
 *  rides beside it — a lone "—" announces as "em dash" or as nothing. Both
 *  props are AUTHORED literals, never tray data. */
function NamedGlyph({ glyph, name }: { glyph: string; name: string }) {
  return (
    <>
      <span aria-hidden="true">{glyph}</span>
      <span className="pm-sr-only">{name}</span>
    </>
  );
}

/** One notes paragraph: the master escapes then turns single newlines into
 *  <br> (renderPdp notesBlock). Interleaving real <br/> elements between the
 *  split lines reproduces that as DOM — strings never sit adjacent, so React
 *  inserts no comment markers and the text nodes match the master's shape. */
function NotesParagraph({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  return (
    <p>{lines.flatMap((line, i) => (i === 0 ? [line] : [<br key={i} />, line]))}</p>
  );
}

/**
 * The PDP article — this variant's re-implementation of the canonical PDP
 * markup (packages/reference/render/pdp.mjs is the contract of record; the
 * four masters under packages/reference/surfaces/pdp/ are what the drift
 * gate holds it to). Interactivity is genuine here (the surface's whole
 * thesis): the gallery, zoom, quantity and add-to-cart islands own their
 * behavior; everything else is server-rendered data.
 *
 * The degenerate arms are contract too, including the three no committed
 * master gates (lib.mjs pdpRenderClass's recorded gap): an absent notes
 * section, a null track duration (sr-only "No duration listed"), and a null
 * year (named em-dash) — implemented from pdp.mjs source, not from the
 * masters, precisely because no fixture master takes those arms.
 */
export function PdpArticle({ detail }: { detail: ReleaseDetail }) {
  const d = detail;
  const price = formatPrice(d.priceFrom);
  const sold = d.numForSale === 0;

  return (
    <article className="pm-pdp">
      <p className="pm-pdp__back">
        <a href={HOSTS.plp}>Back to all records</a>
      </p>
      <div className="pm-pdp__top">
        <PdpGallery images={d.images} />
        <div className="pm-pdp__buy">
          <h1 className="pm-pdp__title">{d.title}</h1>
          <p className="pm-pdp__artist">{d.artist}</p>
          <p className="pm-pdp__price">
            <span className="pm-pdp__amount">
              {price ?? <NamedGlyph glyph="—" name="No price listed" />}
            </span>{" "}
            <span className="pm-pdp__stock">{stockLine(d.numForSale)}</span>
          </p>
          <PdpPurchase id={d.id} title={d.title} sold={sold} />
          <dl className="pm-pdp__meta">
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
        <section className="pm-pdp__section">
          <div className="pm-pdp__scroll" role="region" aria-label="Tracklist" tabIndex={0}>
            <table className="pm-tracklist">
              <caption className="pm-tracklist__caption">Tracklist</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span aria-hidden="true">#</span>
                    <span className="pm-sr-only">Position</span>
                  </th>
                  <th scope="col">Title</th>
                  <th scope="col" className="pm-tracklist__dur">
                    Length
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.tracklist.map((t, i) => (
                  <tr key={i}>
                    <td>{t.position}</td>
                    <td>{t.title}</td>
                    <td className="pm-tracklist__dur">
                      {t.durationSeconds == null ? (
                        <span className="pm-sr-only">No duration listed</span>
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
        <section className="pm-pdp__section">
          <h2 className="pm-pdp__section-title">Notes</h2>
          <div className="pm-prose">
            {d.notes.split(/\n{2,}/).map((paragraph, i) => (
              <NotesParagraph key={i} text={paragraph} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="pm-pdp__section">
        <aside className="pm-plaque pm-plaque--fenced" data-pm-fenced="true">
          <p className="pm-plaque__kicker">Fenced demonstration</p>
          <p className="pm-plaque__name">
            <strong>The live-origin demonstration</strong>
          </p>
          <p className="pm-plaque__claim">
            The price above is real captured data, served the way production serves catalog
            data. This button asks the live Discogs API for today&apos;s price instead — the
            real cost of a dynamic origin, on demand. A live call can&apos;t be reproduced
            run-to-run, so what it returns is never fed into a benchmark number.
          </p>
          <p className="pm-plaque__claim">
            <LiveOriginButton id={d.id} />
          </p>
          <p className="pm-plaque__rule">
            measured with the same harness · excluded from every benchmark number
          </p>
        </aside>
      </section>
    </article>
  );
}

