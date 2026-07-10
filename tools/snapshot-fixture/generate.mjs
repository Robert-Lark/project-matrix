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
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "snapshot");
const RELEASE_COUNT = 240;
const IMAGE_SETS = 12; // small set of placeholder image files, rotated
const CAPTURED_AT = "2026-07-09"; // pinned — regeneration stays byte-stable

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

const ENSEMBLES = [
  "Placeholder Trio", "Synthetic Quartet", "Fixture Quintet", "Mock Sextet",
  "Stand-In Septet", "Interim Orchestra", "Specimen Combo", "Sample Ensemble",
  "Prototype Big Band", "Dummy Duo", "Scaffold Collective", "Test-Tone Unit",
];
const MOODS = ["Blue", "Cool", "Modal", "Electric", "Quiet", "Midnight", "Analog", "Golden"];
const NOUNS = ["Sessions", "Sketches", "Studies", "Impressions", "Excursions", "Variations", "Dialogues", "Fragments"];
const STYLES = ["Modal", "Hard Bop", "Cool Jazz", "Free Jazz", "Post Bop", "Soul-Jazz", "Fusion", "Bossa Nova"];
const DESCRIPTION_POOL = [
  ["LP", "Album"],
  ["LP", "Album", "Reissue"],
  ["LP", "Album", "Reissue", "180 Gram"],
  ["LP", "Album", "Stereo"],
  ["LP", "Album", "Mono"],
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
  const hasPrice = rand() >= 0.1;
  const styles = [...new Set([pick(STYLES), pick(STYLES), ...(rand() < 0.4 ? [pick(STYLES)] : [])])];
  const label = pick(LABELS);

  const cover = {
    src: `/assets/img/ph-${imgSet}-primary.avif`,
    width: 600,
    height: 600,
    alt: `${artist} — ${title}, front cover (placeholder)`,
  };

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
    genres: ["Jazz"],
    styles,
    images: [
      cover,
      {
        src: `/assets/img/ph-${imgSet}-back.avif`,
        width: 600,
        height: 600,
        alt: `${title}, back cover (placeholder)`,
      },
    ],
    tracklist,
    labels: [{ name: label.name, catno: `${label.pre}-${String(int(100, 999))}` }],
    formats: [{ name: "Vinyl", qty: 1, descriptions }],
    notes: "Synthesized placeholder release — not a real record. Interim fixture until snapshot-capture lands the real crate.",
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

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "img"), { recursive: true });
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(join(out, "summaries.json"), JSON.stringify(summaries) + "\n");
writeFileSync(join(out, "details.json"), JSON.stringify(details) + "\n");

// Placeholder cover art: 12 primary + 12 back tiny AVIFs (600×600, flat tones
// + a vinyl-ish disc), deterministic per index.
const HUES = [210, 30, 120, 275, 0, 160, 45, 330, 90, 195, 250, 15];
async function makeImage(file, hue, back) {
  const bg = `hsl(${hue}, ${back ? 12 : 28}%, ${back ? 88 : 82}%)`;
  const disc = `hsl(${hue}, ${back ? 8 : 22}%, ${back ? 72 : 62}%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" fill="${bg}"/>
    <circle cx="300" cy="300" r="210" fill="${disc}"/>
    <circle cx="300" cy="300" r="58" fill="hsl(${hue}, 15%, 45%)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).avif({ quality: 40, effort: 4 }).toFile(file);
}

for (let s = 0; s < IMAGE_SETS; s++) {
  const nn = String(s).padStart(2, "0");
  await makeImage(join(out, "img", `ph-${nn}-primary.avif`), HUES[s], false);
  await makeImage(join(out, "img", `ph-${nn}-back.avif`), HUES[s], true);
}

console.log(
  `snapshot-fixture: ${RELEASE_COUNT} releases, ${IMAGE_SETS * 2} images, captured-at ${CAPTURED_AT}`,
);
