/**
 * The per-snapshot essays — variant-owned CONTENT, re-typed rather than
 * imported from @pm/reference at build time (the slice-A precedent: no shared
 * component runtime crosses variants, ADR-0003 §1; the drift gate polices
 * textual identity either way, and the pre-merge master-identity guard in
 * test/ proves it for BOTH snapshots before merge, since CI's browser legs
 * only ever serve the fixture).
 *
 * Every precise number interpolates a tray field and the dateline is the
 * manifest's freeze date (ADR-0008 §8) — nothing here is typed.
 *
 * ── Why each text run is ONE template literal, not natural JSX prose ──
 * Not for slice B's reason. Qwik does NOT split `text {expr} text` into
 * separate DOM text nodes (measured against a scaffold: no `<!--t=…-->`
 * markers appear for non-reactive interpolation, so the served bytes carry one
 * continuous run per side, exactly like the master). The reason here is
 * narrower: a template literal is immune to source REFLOW. Natural JSX prose
 * relies on the compiler's trim-and-join rule, so a future formatter run that
 * moves a line break to either side of an expression can add or drop a space
 * mid-sentence — a divergence only the zero-tolerance pixel leg would catch,
 * and one that has already cost this build a debugging session on another
 * variant. One literal per run makes the text a constant.
 */
import type { JSXOutput } from "@builder.io/qwik";
import { formatPrice } from "./format";
import type { FeaturedRelease } from "./edge";

export interface EssayBlock {
  readonly kind: "p" | "blockquote";
  readonly content: string;
}

export interface Essay {
  readonly kicker: string;
  readonly title: string;
  readonly dek: string;
  /** The opening paragraph — the one block carrying an `<em>`. */
  readonly opening: (featured: FeaturedRelease) => JSXOutput;
  readonly body: (featured: FeaturedRelease) => readonly EssayBlock[];
  readonly featureNote: string;
}

const CRATE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "The price of stillness",
  dek: "A drone record from 2007 has become the most expensive thing in our crate — without a single loud moment on it.",
  opening: (d) => (
    <>
      {`There are records you put on and records you put up — and ${d.artist}'s `}
      <em>{d.title}</em>
      {` has spent nearly two decades being both. Two hours of tape-saturated strings and horns that barely move, released on ${d.labels[0]?.name ?? "Kranky"} in ${d.year}, it is the kind of album whose fans describe it in architectural terms: a room, a horizon, a place they go.`}
    </>
  ),
  body: (d) => [
    {
      kind: "p",
      content: `It is also, as of this crate's freeze, the most expensive record we stock. The original pressing sits north of five hundred dollars with a single copy on offer — ${formatPrice(d.priceFrom)} at the freeze, to be exact — and the story of how it got there is the story of what vinyl does when music refuses to be background for the people who love it.`,
    },
    {
      kind: "blockquote",
      content:
        "Stillness scales badly. You can stream it anywhere, but the people who want this record want the object — the gatefold, the etched runout, the side you have to stand up and flip. Scarcity does the rest.",
    },
    {
      kind: "p",
      content:
        "The economics are unsentimental. A triple LP of very quiet music is expensive to press and risky to repress, so supply arrives in slow, deliberate waves; a reissue surfaces, sells through, and the originals resume their climb. Meanwhile the music itself does the one thing collectible records must do: it keeps being recommended, year after year, by people who sound slightly embarrassed at how much they mean it.",
    },
    {
      kind: "p",
      content:
        "We are not in the appreciation business — this is a record store, and our copy count is what it is. But if you have ever wondered what people hear in a record that seems to do nothing, this is the one to start with. Put it on in the late afternoon. Let it be the room.",
    },
  ],
  featureNote:
    "The pressing described above, as captured in the frozen snapshot — price and availability are the real aggregate at the freeze.",
};

const FIXTURE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "A quiet variation, on repeat",
  dek: "The fixture's stand-in essay: synthetic prose over synthetic data, exercising every structure the real one uses.",
  opening: (d) => (
    <>
      <em>{d.title}</em>
      {` by ${d.artist} is not a real record — it is release ${d.id} of the synthesized fixture crate, pressed on ${d.labels[0]?.name ?? "a placeholder label"} in ${d.year} by a deterministic generator. This essay exists so the editorial surface renders honestly in CI, where the real crate never travels.`}
    </>
  ),
  body: (d) => [
    {
      kind: "p",
      content: `It carries everything the real staff pick carries: a priced feature card rendered from the tray (${formatPrice(d.priceFrom) ?? "unpriced"} at the fixture's pinned capture date), a figure with data-sized dimensions, one blockquote, and exactly one interaction below.`,
    },
    {
      kind: "blockquote",
      content:
        "If you can read this in a published benchmark screenshot, the wrong snapshot is being served — the fixture never leaves CI.",
    },
    {
      kind: "p",
      content:
        "Structure is the point: the drift gate compares this page's rendered DOM against every paradigm's re-implementation, so even placeholder prose is part of the contract. The words are synthetic; the markup is law.",
    },
    {
      kind: "p",
      content:
        "The real essay ships wherever the real crate is served, with the same shape and the same rules — numbers from trays, dates from the manifest, verdicts from nowhere.",
    },
  ],
  featureNote:
    "The fixture's featured release, rendered from its tray — same contract as the real crate's.",
};

/** `crateName` is the served SnapshotManifest's `crate` field. */
export function essayFor(isFixture: boolean): Essay {
  return isFixture ? FIXTURE_ESSAY : CRATE_ESSAY;
}
