/**
 * The per-snapshot essays — committed CONTENT, re-typed verbatim from the
 * contract of record (`packages/reference/render/editorial.mjs`). Variant-owned
 * by design: no shared component runtime crosses variants (ADR-0003 §1), and
 * the drift gate plus the pre-merge identity guard police textual identity.
 *
 * Prose narrates allusively; every precise number interpolates a tray or
 * manifest field; the dateline is the manifest's freeze date (ADR-0008 §8).
 *
 * Each block's `html` is the element's INNER content, already escaped, because
 * the prose carries inline `<em>` markup. `EditorialArticle.astro` renders it
 * through `set:html` — Astro's documented mechanism for content HTML, and the
 * same shape its own content-collection pipeline uses. The alternative
 * (authoring the prose as Astro markup with `{expr}` holes) renders identical
 * bytes, but it puts every paragraph on one ~400-character line where a
 * single reflowed line break silently inserts a space MID-SENTENCE — the same
 * class of text-run hazard that cost slice B a pixel-level debugging session.
 */
import type { ReleaseDetail } from "@pm/data-contract";
import { esc, formatPrice } from "./format";

export interface ProseBlock {
  readonly kind: "p" | "blockquote";
  /** Already-escaped inner HTML (may contain `<em>`). */
  readonly html: string;
}

export interface Essay {
  readonly kicker: string;
  readonly title: string;
  readonly dek: string;
  readonly body: (d: ReleaseDetail) => readonly ProseBlock[];
  readonly featureNote: string;
}

const CRATE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "The price of stillness",
  dek: "A drone record from 2007 has become the most expensive thing in our crate — without a single loud moment on it.",
  body: (d) => [
    {
      kind: "p",
      html: `There are records you put on and records you put up — and ${esc(d.artist)}'s <em>${esc(d.title)}</em> has spent nearly two decades being both. Two hours of tape-saturated strings and horns that barely move, released on ${esc(d.labels[0]?.name ?? "Kranky")} in ${d.year}, it is the kind of album whose fans describe it in architectural terms: a room, a horizon, a place they go.`,
    },
    {
      kind: "p",
      html: `It is also, as of this crate's freeze, the most expensive record we stock. The original pressing sits north of five hundred dollars with a single copy on offer — ${formatPrice(d.priceFrom)} at the freeze, to be exact — and the story of how it got there is the story of what vinyl does when music refuses to be background for the people who love it.`,
    },
    {
      kind: "blockquote",
      html: `Stillness scales badly. You can stream it anywhere, but the people who want this record want the object — the gatefold, the etched runout, the side you have to stand up and flip. Scarcity does the rest.`,
    },
    {
      kind: "p",
      html: `The economics are unsentimental. A triple LP of very quiet music is expensive to press and risky to repress, so supply arrives in slow, deliberate waves; a reissue surfaces, sells through, and the originals resume their climb. Meanwhile the music itself does the one thing collectible records must do: it keeps being recommended, year after year, by people who sound slightly embarrassed at how much they mean it.`,
    },
    {
      kind: "p",
      html: `We are not in the appreciation business — this is a record store, and our copy count is what it is. But if you have ever wondered what people hear in a record that seems to do nothing, this is the one to start with. Put it on in the late afternoon. Let it be the room.`,
    },
  ],
  featureNote:
    "The pressing described above, as captured in the frozen snapshot — price and availability are the real aggregate at the freeze.",
};

const FIXTURE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "A quiet variation, on repeat",
  dek: "The fixture's stand-in essay: synthetic prose over synthetic data, exercising every structure the real one uses.",
  body: (d) => [
    {
      kind: "p",
      html: `<em>${esc(d.title)}</em> by ${esc(d.artist)} is not a real record — it is release ${d.id} of the synthesized fixture crate, pressed on ${esc(d.labels[0]?.name ?? "a placeholder label")} in ${d.year} by a deterministic generator. This essay exists so the editorial surface renders honestly in CI, where the real crate never travels.`,
    },
    {
      kind: "p",
      html: `It carries everything the real staff pick carries: a priced feature card rendered from the tray (${formatPrice(d.priceFrom) ?? "unpriced"} at the fixture's pinned capture date), a figure with data-sized dimensions, one blockquote, and exactly one interaction below.`,
    },
    {
      kind: "blockquote",
      html: `If you can read this in a published benchmark screenshot, the wrong snapshot is being served — the fixture never leaves CI.`,
    },
    {
      kind: "p",
      html: `Structure is the point: the drift gate compares this page's rendered DOM against every paradigm's re-implementation, so even placeholder prose is part of the contract. The words are synthetic; the markup is law.`,
    },
    {
      kind: "p",
      html: `The real essay ships wherever the real crate is served, with the same shape and the same rules — numbers from trays, dates from the manifest, verdicts from nowhere.`,
    },
  ],
  featureNote:
    "The fixture's featured release, rendered from its tray — same contract as the real crate's.",
};

/** Essays are per-snapshot: the fixture's synthetic register gets a synthetic
 *  essay exercising the identical structure (ADR-0008 §9). */
export function essayFor(snapshotName: string): Essay {
  return snapshotName === "crate" ? CRATE_ESSAY : FIXTURE_ESSAY;
}
