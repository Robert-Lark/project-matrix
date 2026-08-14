/**
 * Reference-render core (ADR-0003 §6; surface-design session 2026-07-17).
 *
 * The golden masters are BUILT from tray data, never hand-written — the
 * ADR-0007 lesson ("copy that carries numbers must be generated from the
 * receipt, never typed") applied structurally to every store surface. This
 * module owns tray loading and the CANONICAL FORMATTING RULES: the exact
 * string every paradigm's re-implementation must produce, because the drift
 * gate compares rendered text, not intentions.
 *
 * Framework-free by construction: plain template literals, no runtime dep,
 * never shipped to a visitor (build-time only; @pm/reference exposes no JS
 * entry point — repo-checks enforces that).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

/** The two snapshot sources. CI builds from the FIXTURE only (the committed
 *  synthesized snapshot); the crate is for local design builds — CI never
 *  reads the crate's trays (ADR-0007 consequence, issue #9). */
export const SNAPSHOTS = {
  fixture: join(repoRoot, "tools", "snapshot-fixture", "snapshot"),
  crate: join(repoRoot, "tools", "snapshot-capture", "crate"),
};

export function loadSnapshot(name) {
  const dir = SNAPSHOTS[name];
  if (!dir) throw new Error(`unknown snapshot source: ${name}`);
  const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
  return {
    name,
    manifest: read("manifest.json"),
    summaries: read("summaries.json"),
    details: read("details.json"),
  };
}

/** HTML-escape every interpolated tray value — titles/artists/notes are
 *  external data (ADR-0002: never trust external input, even frozen). */
export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ── Canonical formatting rules (normative for every variant) ──────────────
 * The tray is data-not-UI (ADR-0002 §6): price is a number, duration is
 * seconds. Formatting happens in render, and every paradigm must format
 * identically or the drift gate fails it. These are the rules of record;
 * the markup-contract doc points here.
 */

/** Price: USD renders as "$" + amount, exactly two decimals, "," thousands
 *  separator. Non-USD (none in the frozen crate; guard anyway) falls back to
 *  "<amount> <CUR>". A null price is NOT a price of zero — see stockLine. */
export function formatPrice(priceFrom) {
  if (priceFrom == null) return null;
  const { amount, currency } = priceFrom;
  const fixed = amount.toFixed(2);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return currency === "USD" ? `$${grouped}.${frac}` : `${grouped}.${frac} ${currency}`;
}

/** Stock: "N for sale" with a real singular; the unpriced state (44 of the
 *  crate's 500) renders an honest em-dash price slot + "none for sale". */
export function stockLine(numForSale) {
  if (numForSale === 0) return "none for sale";
  return numForSale === 1 ? "1 for sale" : `${numForSale} for sale`;
}

/** Track duration: m:ss (no zero-padding on minutes; seconds always two
 *  digits); 3600+ renders h:mm:ss. Crate max is 3,816 s → "1:03:36"
 *  (tool-derived — an earlier hand-typed "max 1,762" in this comment was
 *  caught wrong by the design panel; jq the trays, never recall). Null
 *  durations (2,288 of the crate's tracklist rows) render "". */
export function formatDuration(durationSeconds) {
  if (durationSeconds == null) return "";
  const s = Math.round(durationSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Meta line: format string + year, " · " separated; year may be null. */
export function metaLine(summary) {
  return summary.year == null ? summary.format : `${summary.format} · ${summary.year}`;
}

/**
 * The full format COMPOSITION of a release — every component, in tray order.
 *
 * A Discogs `formats` array says what is IN the package; it is not a menu.
 * Crate release 896191 is one $30.00 product whose three entries are two
 * vinyl variants AND a CD, and 39 crate releases carry a component named
 * "All Media" — the marker for a release that spans several media. The data
 * contract carries exactly one `priceFrom` and one `numForSale` per release
 * (`ReleaseSummary`), so no component has a price, a stock count or a cart
 * identity of its own. That is why the PDP renders this as DATA and the
 * format RADIO GROUP was cut (ADR-0008 addendum A, 2026-08-15): a control
 * offering a choice the data cannot honour could only be wired by inventing
 * per-format prices, and this site publishes no number without a receipt.
 *
 * One component renders exactly as `ReleaseSummary.format` does — capture
 * builds that field from `formats[0]` by this same rule (snapshot-capture
 * `normalize.ts`) — plus an `N × ` prefix wherever the tray records more
 * than one of a medium, the single fact `format` drops (130 of the crate's
 * 439 single-format releases are 2×LP or larger and show no quantity today).
 * Components join with "; ", the separator the label list already uses.
 */
export function formatComposition(formats) {
  return formats
    .map((f) => {
      const body =
        f.descriptions.length > 0 ? `${f.name}, ${f.descriptions.join(", ")}` : f.name;
      return f.qty > 1 ? `${f.qty} × ${body}` : body;
    })
    .join("; ");
}

/**
 * A glyph that stands in for absent data, with the name it needs to be heard.
 *
 * A lone "—" is not an accessible name: a screen reader announces it as "em
 * dash" or, with punctuation verbosity low, says nothing at all — so "no
 * price" and "a rendering fault" become indistinguishable, the same reasoning
 * `tracklist.css` already applies to an empty duration cell. The glyph is
 * hidden from AT and a real phrase is supplied beside it; this is the pattern
 * `pdp.mjs`'s steppers and the tracklist's "#" header already use, made a
 * rule so the remaining instances could be found and a repo-check could keep
 * them gone (`tools/repo-checks/test/master-glyph-names.test.ts`).
 *
 * Both arguments are AUTHORED literals, never tray data — a caller with a
 * tray value has content, not an absence, and must escape it itself.
 */
export function namedGlyph(glyph, name) {
  return `<span aria-hidden="true">${glyph}</span><span class="pm-sr-only">${name}</span>`;
}

/** Image srcs stay EXACTLY as the tray carries them (/assets/img/…): the
 *  variants serve those paths, and the drift gate compares attribute values
 *  verbatim — the gate's static server aliases /assets/img/* onto the
 *  resolved snapshot's img dir. Local BOARD builds (screenshot critique) may
 *  pass an origin to point crate images at the deployed plane, since the
 *  crate's image bytes are deliberately git-excluded (issue #9). */
export function imageSrc(src, origin = "") {
  return `${origin}${src}`;
}

/** The 160px thumb derivative rides a URL convention over the frozen tray
 *  src — the trays themselves are untouched (issue #9 follow-up, settled
 *  2026-07-17). Every paradigm derives it exactly this way. */
export function thumbSrc(src) {
  return src.replace(/\.avif$/, ".thumb.avif");
}

/** The featured release (editorial's subject + the rich-path PDP master).
 *  The fixture's curation.json carries `featured`; the crate's is frozen and
 *  predates the field, so the crate picks are constants of the DESIGN (a
 *  curated editorial choice, like the crate itself — not a receipt):
 *  editorial 953800 (Stars Of The Lid — the crate's price outlier),
 *  pdp 896191 (Explosions In The Sky — 3 formats, priced, 5 images). */
export const CRATE_FEATURED = { editorial: 953800, pdp: 896191 };

export function featuredIds(snapshot) {
  if (snapshot.name === "crate") return CRATE_FEATURED;
  let curated;
  try {
    curated = JSON.parse(
      readFileSync(join(SNAPSHOTS[snapshot.name], "curation.json"), "utf8"),
    ).featured;
  } catch {
    curated = undefined;
  }
  if (curated == null) throw new Error(`${snapshot.name}: no featured release id`);
  return { editorial: curated, pdp: curated };
}

export function detailById(snapshot, id) {
  const detail = snapshot.details.find((d) => d.id === id);
  if (!detail) throw new Error(`${snapshot.name}: no detail tray for id ${id}`);
  return detail;
}

/**
 * The PDP's RENDERING CLASS for one detail tray — the three STRUCTURAL
 * branches the master set gates (whole elements appear or disappear):
 *  - `formats`  : since ADR-0008 addendum A cut the format control this axis
 *                 is a CONTENT difference, not a structural one — every master
 *                 renders the same <dt>Format</dt> pair, and single-format
 *                 (439/500 crate, 239/240 fixture) carries ONE component
 *                 where multi-format lists several, "; " separated. The axis
 *                 is still modelled because that is still the branch 439 of
 *                 500 releases take, and the master set still isolates it;
 *  - `priced`   : unpriced renders an em-dash amount + "none for sale" + the
 *                 disabled CTA (44/500 crate, 24/240 fixture). `priceFrom ==
 *                 null ⟺ numForSale === 0` holds with ZERO exceptions in both
 *                 committed snapshots — asserted, not assumed
 *                 (`test/reference.test.ts`);
 *  - `gallery`  : a 1-image release omits the whole thumb <ul> (90/500 crate,
 *                 1/240 fixture).
 *
 * NOT the branches `render/pdp.mjs` takes — it takes three more, and this
 * class does not model them, so no master gates them (verify-slice 2026-08-14,
 * three lenses). They are KNOWINGLY UNGATED, recorded rather than implied:
 *  - `:61`  omits the whole notes <section> when `!d.notes`
 *           (fixture 1/240, crate 61/500 — no fixture master takes this arm);
 *  - `:87`  renders an sr-only "No duration listed" for a null track duration
 *           (fixture 68/240, crate 259/500);
 *  - `:121` renders a NAMED em-dash for a null year (fixture 19/240, crate
 *           0/500) — a bare "—" until 2026-08-15, see `namedGlyph`.
 * (Those three citations were `:65`/`:91`/`:125` and each moved by four lines
 * when `formatBlock` was deleted. Re-derived, not adjusted by arithmetic.)
 * The committed masters render from the FIXTURE, and 0 of the 4 take ANY of
 * those three arms. Closing the gap means widening this class AND the master
 * set; until then the coverage guard proves per-axis coverage of the three
 * structural branches, which is what its test name now says.
 */
export function pdpRenderClass(detail) {
  return {
    formats: detail.formats.length > 1 ? "multi" : "single",
    priced: detail.priceFrom == null ? "unpriced" : "priced",
    gallery: detail.images.length > 1 ? "gallery" : "one-image",
  };
}

/** The class as one stable string — the key the coverage guard groups on. */
export function pdpRenderClassKey(detail) {
  const c = pdpRenderClass(detail);
  return `${c.formats}/${c.priced}/${c.gallery}`;
}

/**
 * The PDP master set: which release each committed master renders, for ANY
 * snapshot. ONE derivation, shared by the reference build, every variant's
 * build, and the drift gate's re-render — the `resolvedPathSegments` lesson
 * (a second derivation is a second opinion about which page was measured).
 *
 * The rich path is the FEATURED release: a curated design constant, not a
 * receipt (ADR-0008 §9). The three degenerate masters are the LOWEST-ID
 * release exhibiting each branch, because the gate needs a pick that is
 * stable across re-renders and derivable without a second curated constant —
 * id order is the only total order the trays carry that is not itself a
 * rendering property.
 *
 * Why masters at all, rather than hand-written per-branch suite assertions:
 * the drift gate only ever compares a variant against a MASTER, and
 * `build.mjs` rendered exactly one PDP — so the three degenerate branches,
 * which are the COMMON path, were ungated by construction. Hand-written
 * assertions would be a second statement of the contract that can drift from
 * it (the record-not-code class this repo keeps paying for).
 */
export function pdpMasterIds(snapshot) {
  const lowestWith = (predicate) => {
    const match = snapshot.details
      .filter(predicate)
      .sort((a, b) => a.id - b.id)[0];
    return match?.id;
  };
  // The set is a STAR centred on `single-format`, not a set in which every
  // pair differs by one branch. Each degenerate pick holds the other two axes
  // at the SINGLE-FORMAT master's value, so each differs from that centre by
  // exactly ONE branch — ADR-0001 §4's one-variable-at-a-time rule applied to
  // the gate. It is NOT true of every pair: `rich` differs from `unpriced` and
  // from `one-image` by two axes, and those two differ from each other by two
  // (verify-slice 2026-08-14 — the comment previously named `rich` as the
  // anchor, which is false: `rich` is multi-format and every degenerate pick
  // is single).
  //
  // Without the isolation the first draft picked the same release for
  // `single-format` and `unpriced` (both resolve to fixture 9000001, the
  // lowest id, which is single AND unpriced), gating the two branches only
  // together and never apart.
  //
  // The `formats.length <= 1` clause on `unpriced`/`one-image` is what makes
  // the star STRUCTURAL rather than accidental. Both snapshots resolve the
  // same ids with or without it (fixture 9000001/9000017, crate 707725/815241
  // — the committed masters are byte-unchanged), because 439/500 crate and
  // 239/240 fixture releases are single-format; that is a property of the
  // data, not of the derivation, and the derivation must not depend on it.
  const ids = {
    "": featuredIds(snapshot).pdp,
    "single-format": lowestWith(
      (d) => d.formats.length <= 1 && d.priceFrom != null && d.images.length > 1,
    ),
    unpriced: lowestWith(
      (d) => d.formats.length <= 1 && d.priceFrom == null && d.images.length > 1,
    ),
    "one-image": lowestWith(
      (d) => d.formats.length <= 1 && d.images.length === 1 && d.priceFrom != null,
    ),
  };
  for (const [slot, id] of Object.entries(ids)) {
    if (id == null) {
      throw new Error(
        `${snapshot.name}: no release isolates the "${slot || "rich"}" PDP branch — the master set cannot be rendered from this snapshot`,
      );
    }
  }
  // Two masters rendering the same release gate one branch twice and another
  // never — the exact failure the isolation above exists to prevent, so it is
  // asserted rather than trusted.
  const seen = new Set(Object.values(ids));
  if (seen.size !== Object.keys(ids).length) {
    throw new Error(
      `${snapshot.name}: the PDP master set resolves duplicate release ids (${Object.entries(ids)
        .map(([slot, id]) => `${slot || "rich"}=${id}`)
        .join(", ")}) — each master must render a distinct branch`,
    );
  }
  // The STAR property, enforced where it is derived rather than only asserted
  // downstream: each degenerate master must differ from the `single-format`
  // centre on exactly ONE axis. The duplicate guard above cannot catch a set
  // that is distinct but not one-variable — two masters differing on two axes
  // gate both branches together and neither apart, which is the failure the
  // whole derivation exists to prevent.
  const centre = pdpRenderClass(detailById(snapshot, ids["single-format"]));
  for (const slot of ["unpriced", "one-image"]) {
    const cls = pdpRenderClass(detailById(snapshot, ids[slot]));
    const differing = Object.keys(centre).filter((axis) => cls[axis] !== centre[axis]);
    if (differing.length !== 1) {
      throw new Error(
        `${snapshot.name}: PDP master "${slot}" (id ${ids[slot]}, ${pdpRenderClassKey(detailById(snapshot, ids[slot]))}) differs from the single-format centre (${pdpRenderClassKey(detailById(snapshot, ids["single-format"]))}) on ${differing.length} axes [${differing.join(", ")}] — each degenerate master must isolate exactly one branch`,
      );
    }
  }
  return ids;
}
