// Deterministic fixture-snapshot generator (issue #4). Everything here is
// CLEARLY SYNTHESIZED throwaway data — obviously-fake names, a fixed PRNG
// seed, a pinned capture date — so `?n=` and pagination have ≥240 real rows
// to serve before the real crate lands (`snapshot-capture`). Pagination and
// facet fields are COMPUTED from what is stored, never copied from samples.
//
// Deterministic by construction: same seed → byte-identical snapshot, so the
// committed output is reproducible by anyone (ADR-0001 §9). Validation lives
// in test/snapshot.test.ts (vitest imports the TS contract; this script stays
// plain node).
//
// ADVERSARIALLY BRANCH-COVERING (surface-design DRAFT §6): CI's drift gate
// exercises THIS fixture, so it must contain every rendering branch the real
// crate contains. Each branch lives on an identifiable release (SPECIAL,
// below): non-square covers, a 5-image and a 1-image gallery, a ≥1 h track
// and null durations, multi-format, unpriced, multiple genres, the crate's
// `33 ⅓ RPM` (U+2153) format string and a `℗` (U+2117) note, plus a
// curation.json whose `featured` id the editorial/PDP reference renders read.
// Every image also ships its 160px `<name>.thumb.avif` twin — the same thumb
// tier derive.ts mints for the real crate (thumb src is derived in render by
// `src.replace(/\.avif$/, ".thumb.avif")`, never stored in the trays).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "snapshot");
const RELEASE_COUNT = 240;
const IMAGE_SETS = 12; // small set of placeholder image files, rotated
const CAPTURED_AT = "2026-07-17"; // pinned — regeneration stays byte-stable

// mulberry32 — tiny deterministic PRNG, fixed seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260709);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));

// The branch-coverage releases, by loop index (id = 9000001 + index). Each
// covers a rendering branch the real crate contains (DRAFT §6); tests and
// reference renders may target them by id.
const SPECIAL = {
  landscape: 13, // 9000014 — 600×298 landscape cover
  portrait: 14, //  9000015 — 337×450 portrait cover
  featured: 15, //  9000016 — exactly 5 images + 3 formats[] + priced (curation.json `featured`)
  singleImage: 16, // 9000017 — exactly 1 image
  longTrack: 17, // 9000018 — a 3816 s track (renders 1:03:36) + a null duration
  unpriced: 18, //  9000019 — priceFrom null + numForSale 0, guaranteed (not PRNG luck)
  phonogram: 19, // 9000020 — ℗ (U+2117) in notes
  noNotes: 20, //    9000021 — notes: null (61/500 crate releases; the PDP no-notes branch)
};

const ENSEMBLES = [
  "Placeholder Trio", "Synthetic Quartet", "Fixture Quintet", "Mock Sextet",
  "Stand-In Septet", "Interim Orchestra", "Specimen Combo", "Sample Ensemble",
  "Prototype Big Band", "Dummy Duo", "Scaffold Collective", "Test-Tone Unit",
];
const MOODS = ["Blue", "Cool", "Modal", "Electric", "Quiet", "Midnight", "Analog", "Golden"];
const NOUNS = ["Sessions", "Sketches", "Studies", "Impressions", "Excursions", "Variations", "Dialogues", "Fragments"];
const STYLES = ["Modal", "Hard Bop", "Cool Jazz", "Free Jazz", "Post Bop", "Soul-Jazz", "Fusion", "Bossa Nova"];
// Second and third facet genres (DRAFT §6: facet groups need >1 entry) —
// assigned deterministically by index, with their own style pools.
const ELECTRONIC_STYLES = ["Ambient", "Downtempo", "Minimal"];
const CLASSICAL_STYLES = ["Modern Classical", "Neo-Classical"];
const DESCRIPTION_POOL = [
  ["LP", "Album"],
  ["LP", "Album", "Reissue"],
  ["LP", "Album", "Reissue", "180 Gram"],
  ["LP", "Album", "Stereo"],
  ["LP", "Album", "Mono"],
  // Space-wrapped exactly like the crate's format strings ("Vinyl, 12", 33 ⅓ RPM")
  // — exercises the U+2153 glyph path in CI.
  ["LP", "Album", "33 ⅓ RPM"],
];
const LABELS = [
  { name: "Placeholder Records", pre: "PH" },
  { name: "Fixture Sound", pre: "FX" },
  { name: "Synthetic Groove", pre: "SG" },
  { name: "Interim Audio", pre: "IA" },
];
const TRACK_WORDS = ["Fixture", "Placeholder", "Synthetic", "Interim", "Sample", "Mock", "Specimen", "Prototype"];

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const details = [];
for (let i = 0; i < RELEASE_COUNT; i++) {
  const id = 9000001 + i; // clearly outside real Discogs fixture ids
  const artist = pick(ENSEMBLES);
  const title = `${pick(MOODS)} ${pick(NOUNS)} No. ${String(i + 1).padStart(3, "0")}`;
  const imgSet = String(i % IMAGE_SETS).padStart(2, "0");
  const descriptions = pick(DESCRIPTION_POOL);
  const year = rand() < 0.08 ? null : int(1950, 1979);
  const hasPrice =
    i === SPECIAL.unpriced ? false : i === SPECIAL.featured ? true : rand() >= 0.1;
  const jazzStyles = [...new Set([pick(STYLES), pick(STYLES), ...(rand() < 0.4 ? [pick(STYLES)] : [])])];
  const label = pick(LABELS);

  // Genre spread: mostly Jazz; every 8th-mod-3 release is Electronic and
  // every 16th-mod-6 is a Jazz + Classical crossover — three genre facets,
  // multi-genre releases included.
  let genres = ["Jazz"];
  let styles = jazzStyles;
  if (i % 8 === 3) {
    genres = ["Electronic"];
    styles = [...new Set([pick(ELECTRONIC_STYLES), pick(ELECTRONIC_STYLES)])];
  } else if (i % 16 === 6) {
    genres = ["Jazz", "Classical"];
    styles = [...new Set([jazzStyles[0], pick(CLASSICAL_STYLES)])];
  }

  // Non-square covers on the identifiable releases; dimensions are DATA and
  // must match the emitted files exactly (asserted in test/snapshot.test.ts).
  let cover = {
    src: `/assets/img/ph-${imgSet}-primary.avif`,
    width: 600,
    height: 600,
    alt: `${artist} — ${title}, front cover (placeholder)`,
  };
  if (i === SPECIAL.landscape) {
    cover = { src: "/assets/img/ph-land-primary.avif", width: 600, height: 298, alt: cover.alt };
  } else if (i === SPECIAL.portrait) {
    cover = { src: "/assets/img/ph-port-primary.avif", width: 337, height: 450, alt: cover.alt };
  }

  const trackCount = int(4, 8);
  const tracklist = [];
  for (let t = 0; t < trackCount; t++) {
    const side = t < Math.ceil(trackCount / 2) ? "A" : "B";
    const pos = (t % Math.ceil(trackCount / 2)) + 1;
    tracklist.push({
      position: `${side}${pos}`,
      title: `${pick(TRACK_WORDS)} ${pick(NOUNS)} ${side}${pos}`,
      durationSeconds: rand() < 0.05 ? null : int(120, 600),
    });
  }
  if (i === SPECIAL.longTrack) {
    // ≥1 h duration branch (3816 → renders 1:03:36; the crate max is 3,816 s)
    // and one guaranteed null (the PRNG supplies more across the fixture).
    tracklist[0].durationSeconds = 3816;
    tracklist[1].durationSeconds = null;
  }

  const back = {
    src: `/assets/img/ph-${imgSet}-back.avif`,
    width: 600,
    height: 600,
    alt: `${title}, back cover (placeholder)`,
  };
  let images = [cover, back];
  if (i === SPECIAL.featured) {
    // Exactly 5 images — the rich-gallery branch the reference PDP renders.
    images = [
      cover,
      back,
      ...[1, 2, 3].map((n) => ({
        src: `/assets/img/ph-det-${n}.avif`,
        width: 600,
        height: 600,
        alt: `${title}, detail photo ${n} (placeholder)`,
      })),
    ];
  } else if (i === SPECIAL.singleImage) {
    images = [cover]; // exactly 1 image — the no-gallery branch
  }

  // Multi-format branch: the featured release carries 3 formats[] entries;
  // everything else stays single-format (the crate is 439/500 single-format).
  const formats =
    i === SPECIAL.featured
      ? [
          { name: "Vinyl", qty: 2, descriptions },
          { name: "CD", qty: 1, descriptions: ["Album"] },
          { name: "Box Set", qty: 1, descriptions: ["Limited Edition", "Numbered"] },
        ]
      : [{ name: "Vinyl", qty: 1, descriptions }];

  const notes =
    i === SPECIAL.noNotes
      ? null
      : i === SPECIAL.phonogram
        ? "Synthesized placeholder release — not a real record. ℗ 1974 Placeholder Records (fixture phonogram-mark branch)."
        : "Synthesized placeholder release — not a real record. Interim fixture until snapshot-capture lands the real crate.";

  details.push({
    id,
    slug: `${id}-${slugify(artist)}-${slugify(title)}`,
    title,
    artist,
    cover,
    format: `Vinyl, ${descriptions.join(", ")}`,
    year,
    priceFrom: hasPrice
      ? { amount: Math.round((5 + rand() * 145) * 100) / 100, currency: "USD" }
      : null,
    numForSale: hasPrice ? int(1, 80) : 0,
    genres,
    styles,
    images,
    tracklist,
    labels: [{ name: label.name, catno: `${label.pre}-${String(int(100, 999))}` }],
    formats,
    notes,
  });
}

// The small tray is DERIVED from the full tray — one source of truth.
const summaries = details.map(
  ({ id, slug, title, artist, cover, format, year, priceFrom, numForSale, genres, styles }) => ({
    id, slug, title, artist, cover, format, year, priceFrom, numForSale, genres, styles,
  }),
);

const manifest = {
  capturedAt: CAPTURED_AT,
  source: "api.discogs.com", // schema literal; the crate name marks it synthesized
  crate: "synthesized-placeholder-fixture",
  releaseCount: RELEASE_COUNT,
  commitSha: null,
};

// The curation receipt, mirroring the crate's curation.json shape (spec /
// planGeneratedAt / perLabel / reserveSize / tombstones) with honestly
// synthesized stats, plus `featured`: the release id the editorial/PDP
// reference renders resolve (multi-format, priced, 5-image — SPECIAL.featured).
// `featured` is introduced BY the fixture: the crate's frozen curation.json
// predates it, so readers must treat the field as optional.
const perLabel = {};
for (const l of LABELS) {
  const chosen = details.filter((d) => d.labels[0].name === l.name).length;
  perLabel[l.name] = {
    pagesFetched: 1,
    capped: false,
    rawItems: chosen,
    matched: chosen,
    uniqueNew: chosen,
    chosen,
    rejected: { type: 0, format: 0, year: 0, image: 0, labelMismatch: 0 },
  };
}
const curation = {
  spec: {
    slug: "synthesized-placeholder-fixture",
    description:
      "Deterministic synthesized fixture crate — obviously-fake ensembles on four placeholder labels, branch-covering every rendering path the real crate contains (surface-design DRAFT §6).",
    decidedBy: "generate.mjs — fixed PRNG seed 20260709, pinned capture date",
    labels: LABELS.map((l) => l.name),
    format: "Vinyl",
    yearMin: 1950,
    yearMax: 1979,
    targetReleases: RELEASE_COUNT,
    maxImagesPerRelease: 5,
    searchPerPage: 100,
    maxSearchPagesPerLabel: 1,
  },
  planGeneratedAt: `${CAPTURED_AT}T00:00:00.000Z`, // pinned like CAPTURED_AT
  perLabel,
  reserveSize: 0,
  tombstones: [],
  featured: 9000001 + SPECIAL.featured,
  featuredNote:
    "The editorial/PDP reference renders read `featured`: a committed release id whose detail tray is multi-format (3 formats), priced, and carries a 5-image gallery. Field introduced by the fixture; the crate's frozen curation.json predates it — treat as optional.",
};

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "img"), { recursive: true });
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(join(out, "summaries.json"), JSON.stringify(summaries) + "\n");
writeFileSync(join(out, "details.json"), JSON.stringify(details) + "\n");
writeFileSync(join(out, "curation.json"), JSON.stringify(curation, null, 2) + "\n");

// Placeholder cover art: flat tones + a vinyl-ish disc, deterministic per
// index. 12 square primary/back pairs, one landscape and one portrait cover
// (the non-square branches), and 3 square gallery-detail extras. Every image
// is emitted twice: full size and its 160px `<name>.thumb.avif` twin — the
// SAME thumb spec derive.ts uses for the real crate (160×160 inside-fit,
// withoutEnlargement, avif quality 50 effort 4).
const HUES = [210, 30, 120, 275, 0, 160, 45, 330, 90, 195, 250, 15];
function svgFor(width, height, hue, back) {
  const bg = `hsl(${hue}, ${back ? 12 : 28}%, ${back ? 88 : 82}%)`;
  const disc = `hsl(${hue}, ${back ? 8 : 22}%, ${back ? 72 : 62}%)`;
  const r = Math.round(Math.min(width, height) * 0.35);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${bg}"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="${disc}"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.round(r * 0.28)}" fill="hsl(${hue}, 15%, 45%)"/>
  </svg>`;
}
async function makeImage(name, width, height, hue, back) {
  const svg = Buffer.from(svgFor(width, height, hue, back));
  await sharp(svg).avif({ quality: 40, effort: 4 }).toFile(join(out, "img", name));
  await sharp(svg)
    .resize({ width: 160, height: 160, fit: "inside", withoutEnlargement: true })
    .avif({ quality: 50, effort: 4 })
    .toFile(join(out, "img", name.replace(/\.avif$/, ".thumb.avif")));
}

for (let s = 0; s < IMAGE_SETS; s++) {
  const nn = String(s).padStart(2, "0");
  await makeImage(`ph-${nn}-primary.avif`, 600, 600, HUES[s], false);
  await makeImage(`ph-${nn}-back.avif`, 600, 600, HUES[s], true);
}
await makeImage("ph-land-primary.avif", 600, 298, HUES[1], false);
await makeImage("ph-port-primary.avif", 337, 450, HUES[2], false);
for (const n of [1, 2, 3]) {
  await makeImage(`ph-det-${n}.avif`, 600, 600, HUES[2 + n], false);
}

const imageCount = IMAGE_SETS * 2 + 2 + 3;
console.log(
  `snapshot-fixture: ${RELEASE_COUNT} releases, ${imageCount} images (+${imageCount} thumbs), captured-at ${CAPTURED_AT}`,
);
