// The per-snapshot essays — committed CONTENT, re-typed verbatim from the
// contract of record (packages/reference/render/editorial.mjs), the recorded
// slice-A call: essay copy is variant-owned content, never a runtime import.
// Where the template-literal variants interpolate through esc(), these
// transcribe the same text as JSX — every prose segment is an explicit
// string expression so the JSX whitespace rules can never reshape the
// contract text, and every tray value rides the serializer's own escaping.
// The drift gate polices textual identity in CI against the fixture master
// and on the deployed plane against the master re-rendered from the resolved
// snapshot (ADR-0008 §9).
import type { RemixNode } from "remix/ui";

import { formatPrice, type Detail } from "./format.ts";

export interface Essay {
  kicker: string;
  title: string;
  dek: string;
  /** Prose blocks in order; the page splices the one figure after block 0. */
  body: (d: Detail) => RemixNode[];
  featureNote: (d: Detail) => string;
}

export const CRATE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "The price of stillness",
  dek: "A drone record from 2007 has become the most expensive thing in our crate — without a single loud moment on it.",
  body: (d) => [
    <p>
      {"There are records you put on and records you put up — and "}
      {d.artist}
      {"'s "}
      <em>{d.title}</em>
      {" has spent nearly two decades being both. Two hours of tape-saturated strings and horns that barely move, released on "}
      {d.labels[0]?.name ?? "Kranky"}
      {" in "}
      {String(d.year)}
      {", it is the kind of album whose fans describe it in architectural terms: a room, a horizon, a place they go."}
    </p>,
    <p>
      {"It is also, as of this crate's freeze, the most expensive record we stock. The original pressing sits north of five hundred dollars with a single copy on offer — "}
      {/* String(): the contract template interpolates the raw value, so a
          null price prints "null" there — Remix skips null children, which
          would silently diverge. Mirror the contract, warts and all. */}
      {String(formatPrice(d.priceFrom))}
      {" at the freeze, to be exact — and the story of how it got there is the story of what vinyl does when music refuses to be background for the people who love it."}
    </p>,
    <blockquote>
      <p>
        {"Stillness scales badly. You can stream it anywhere, but the people who want this record want the object — the gatefold, the etched runout, the side you have to stand up and flip. Scarcity does the rest."}
      </p>
    </blockquote>,
    <p>
      {"The economics are unsentimental. A triple LP of very quiet music is expensive to press and risky to repress, so supply arrives in slow, deliberate waves; a reissue surfaces, sells through, and the originals resume their climb. Meanwhile the music itself does the one thing collectible records must do: it keeps being recommended, year after year, by people who sound slightly embarrassed at how much they mean it."}
    </p>,
    <p>
      {"We are not in the appreciation business — this is a record store, and our copy count is what it is. But if you have ever wondered what people hear in a record that seems to do nothing, this is the one to start with. Put it on in the late afternoon. Let it be the room."}
    </p>,
  ],
  featureNote: () =>
    "The pressing described above, as captured in the frozen snapshot — price and availability are the real aggregate at the freeze.",
};

export const FIXTURE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "A quiet variation, on repeat",
  dek: "The fixture's stand-in essay: synthetic prose over synthetic data, exercising every structure the real one uses.",
  body: (d) => [
    <p>
      <em>{d.title}</em>
      {" by "}
      {d.artist}
      {" is not a real record — it is release "}
      {String(d.id)}
      {" of the synthesized fixture crate, pressed on "}
      {d.labels[0]?.name ?? "a placeholder label"}
      {" in "}
      {String(d.year)}
      {" by a deterministic generator. This essay exists so the editorial surface renders honestly in CI, where the real crate never travels."}
    </p>,
    <p>
      {"It carries everything the real staff pick carries: a priced feature card rendered from the tray ("}
      {formatPrice(d.priceFrom) ?? "unpriced"}
      {" at the fixture's pinned capture date), a figure with data-sized dimensions, one blockquote, and exactly one interaction below."}
    </p>,
    <blockquote>
      <p>
        {"If you can read this in a published benchmark screenshot, the wrong snapshot is being served — the fixture never leaves CI."}
      </p>
    </blockquote>,
    <p>
      {"Structure is the point: the drift gate compares this page's rendered DOM against every paradigm's re-implementation, so even placeholder prose is part of the contract. The words are synthetic; the markup is law."}
    </p>,
    <p>
      {"The real essay ships wherever the real crate is served, with the same shape and the same rules — numbers from trays, dates from the manifest, verdicts from nowhere."}
    </p>,
  ],
  featureNote: () =>
    "The fixture's featured release, rendered from its tray — same contract as the real crate's.",
};
