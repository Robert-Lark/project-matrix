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
 * The PDP's RENDERING CLASS for one detail tray — the three independent
 * branches `render/pdp.mjs` actually takes, and nothing else:
 *  - `formats`  : multi-format renders a <fieldset> radio group; single-format
 *                 renders no fieldset and adds a <dt>Format</dt> pair to the
 *                 meta list instead (439/500 in the crate, 239/240 fixture);
 *  - `priced`   : unpriced renders an em-dash amount + "none for sale" + the
 *                 disabled CTA (44/500 crate, 24/240 fixture). `priceFrom ==
 *                 null ⟺ numForSale === 0` holds with ZERO exceptions in both
 *                 committed snapshots — asserted, not assumed (pdp.test.ts);
 *  - `gallery`  : a 1-image release omits the whole thumb <ul> (90/500 crate,
 *                 1/240 fixture).
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
  // Each degenerate pick ISOLATES its branch: it holds the other two at the
  // rich master's value, so a master differs from its neighbour by exactly
  // ONE branch. That is ADR-0001 §4's one-variable-at-a-time rule applied to
  // the gate — without it the first draft picked the same release for
  // `single-format` and `unpriced` (both resolve to fixture 9000001, the
  // lowest id, which is single AND unpriced), gating the two branches only
  // together and never apart.
  const ids = {
    "": featuredIds(snapshot).pdp,
    "single-format": lowestWith(
      (d) => d.formats.length <= 1 && d.priceFrom != null && d.images.length > 1,
    ),
    unpriced: lowestWith((d) => d.priceFrom == null && d.images.length > 1),
    "one-image": lowestWith((d) => d.images.length === 1 && d.priceFrom != null),
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
  return ids;
}
