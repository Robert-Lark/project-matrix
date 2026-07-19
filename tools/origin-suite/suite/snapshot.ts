/**
 * Snapshot resolution for the composed-origin suite (issue #11): determine
 * WHICH frozen snapshot the origin under test is serving — the dated
 * SnapshotManifest is the provenance signal (ADR-0002 §1) — and load THAT
 * snapshot's committed artifacts, so every data-plane assertion is
 * parameterized by committed truth instead of fixture literals. The smoke
 * then holds whether the bucket serves the synthesized fixture or the real
 * crate.
 *
 * Fail-closed by design (ADR-0001 §9 — no vacuous assertions): an
 * unreadable /api/snapshot, an unknown crate name, a served manifest that
 * doesn't exactly match the committed one, or internally inconsistent
 * committed artifacts all THROW. The suite fails; it never skips.
 *
 * CI independence (issue #9): candidate roots are tried lazily, fixture
 * first — when the origin serves the fixture (CI, always), the crate's
 * files are never read, so CI keeps zero dependency on the crate artifact.
 *
 * Image byte-identity travels as sha256: the crate's image bytes are
 * deliberately not in git (its committed images-index.json carries a sha256
 * per derivative), so a fresh checkout — CI running the post-deploy smoke
 * against a crate-seeded bucket — can still prove the wire bytes are the
 * frozen ones. When a snapshot's bytes ARE committed (the fixture), they
 * ride along for a direct byte comparison on top of the same sha256 floor.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotManifest } from "@pm/data-contract";
import type { ReleaseDetail, ReleaseSummary } from "@pm/data-contract";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * The committed snapshots this suite knows how to verify, in probe order.
 * Order matters for CI independence: the fixture is checked first, so a
 * fixture-serving origin never causes a crate read.
 */
const SNAPSHOT_ROOTS = [
  "tools/snapshot-fixture/snapshot",
  "tools/snapshot-capture/crate",
];

interface ImageIndexEntry {
  file: string;
  sha256: string;
}

export interface ServedSnapshot {
  /** The manifest, served and committed-verified-identical. */
  manifest: SnapshotManifest;
  /** The committed manifest EXACTLY as committed (raw JSON, no Zod strip) —
   *  the deep-equality reference for what the origin must serve. */
  manifestRaw: unknown;
  /** Repo-relative root of the matched committed snapshot. */
  root: string;
  /** The committed trays, raw-parsed (deep-equality reference values). */
  summaries: ReleaseSummary[];
  details: ReleaseDetail[];
  /** A committed release with a gallery + tracklist — the full-tray probe. */
  pdpDetail: ReleaseDetail;
  /** A second, distinct committed id for the cache-state leg. */
  cachePdpId: number;
  /** An id provably absent from the snapshot (max committed id + 1). */
  missingId: number;
  /** One committed image: served path + its frozen byte identity. */
  image: { path: string; sha256: string; bytes?: Buffer };
  /** A deterministic five-position spread over ALL committed derivatives —
   *  so image byte-identity coverage is not a single predictable probe. */
  imageSample: { path: string; sha256: string }[];
}

function fail(message: string): never {
  throw new Error(`[snapshot-resolution] ${message} — the suite fails closed, it never skips (issue #11)`);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Key-order-insensitive JSON equality — plain JSON values only. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function resolve(): Promise<ServedSnapshot> {
  // 1. Ask the origin under test which snapshot it serves. The raw wire
  // JSON is what equality runs on (Zod strips unknown keys, so parsing is
  // shape validation only — comparing parsed values would silently bless a
  // served manifest that differs from the committed one in non-contract
  // fields, and vice versa).
  let served: SnapshotManifest;
  let servedRaw: unknown;
  try {
    const res = await fetch(`${ORIGIN}/api/snapshot`);
    if (res.status !== 200) fail(`GET ${ORIGIN}/api/snapshot returned ${res.status} — cannot tell which snapshot the origin serves`);
    servedRaw = await res.json();
    served = SnapshotManifest.parse(servedRaw);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[snapshot-resolution]")) throw err;
    fail(`GET ${ORIGIN}/api/snapshot did not yield a contract-valid SnapshotManifest (${err instanceof Error ? err.message : String(err)})`);
  }

  // 2. Match it against a known committed snapshot — lazily, fixture first.
  let root: string | undefined;
  let committed: SnapshotManifest | undefined;
  let committedRaw: unknown;
  for (const candidate of SNAPSHOT_ROOTS) {
    const manifestPath = join(repoRoot, candidate, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const raw = readJson(manifestPath);
    const manifest = SnapshotManifest.parse(raw);
    if (manifest.crate !== served.crate) continue;
    // Same crate name must mean the same frozen snapshot, exactly: a stale
    // or partial re-seed (right name, wrong date/count, extra or missing
    // fields) must not pass. Raw-vs-raw, key-order-insensitive.
    if (stableStringify(servedRaw) !== stableStringify(raw)) {
      fail(
        `the origin's manifest names committed crate "${served.crate}" but is not identical to the ` +
          `committed manifest (served ${JSON.stringify(servedRaw)}, committed ${JSON.stringify(raw)})`,
      );
    }
    root = candidate;
    committed = manifest;
    committedRaw = raw;
    break;
  }
  if (!root || !committed) {
    fail(`the origin serves crate "${served.crate}", which matches no committed snapshot (known roots: ${SNAPSHOT_ROOTS.join(", ")})`);
  }
  // Name the resolution in the run log: which snapshot a green run actually
  // asserted must be readable evidence, not something inferred from exit 0.
  console.log(`[snapshot-resolution] origin serves crate "${served.crate}" — asserting the committed artifacts under ${root}`);

  // 3. Load that snapshot's committed trays and cross-check consistency.
  const summaries = readJson(join(repoRoot, root, "summaries.json")) as ReleaseSummary[];
  const details = readJson(join(repoRoot, root, "details.json")) as ReleaseDetail[];
  if (summaries.length !== committed.releaseCount || details.length !== committed.releaseCount) {
    fail(
      `committed artifacts under ${root} are inconsistent with their manifest ` +
        `(releaseCount ${committed.releaseCount}, summaries ${summaries.length}, details ${details.length})`,
    );
  }

  // 4. Derive the probe values from the committed artifacts — never literals.
  const pdpDetail = details.find((d) => d.images.length >= 2 && d.tracklist.length >= 1);
  if (!pdpDetail) fail(`no committed release under ${root} has a gallery (≥2 images) and a tracklist to probe the full tray with`);
  const cachePdpId = details.find((d) => d.id !== pdpDetail.id)?.id;
  if (cachePdpId === undefined) fail(`snapshot under ${root} has fewer than two releases — cannot isolate the cache-state leg`);
  const missingId = Math.max(...details.map((d) => d.id)) + 1;

  const firstImage = pdpDetail.images[0];
  if (!firstImage) fail(`release ${pdpDetail.id} under ${root} lost its images between the find predicate and here`);
  const imageSrc = firstImage.src;
  const imageFile = basename(imageSrc);
  const indexPath = join(repoRoot, root, "images-index.json");
  const bytesPath = join(repoRoot, root, "img", imageFile);
  let sha256: string;
  let bytes: Buffer | undefined;
  if (existsSync(bytesPath)) {
    bytes = readFileSync(bytesPath);
    sha256 = createHash("sha256").update(bytes).digest("hex");
  } else if (existsSync(indexPath)) {
    const entry = (readJson(indexPath) as ImageIndexEntry[]).find((e) => e.file === imageFile);
    if (!entry) fail(`${root}/images-index.json has no entry for ${imageFile}, which the committed trays reference`);
    sha256 = entry.sha256;
  } else {
    fail(`snapshot under ${root} commits neither image bytes (img/${imageFile}) nor an images-index.json — no frozen byte identity to assert`);
  }
  // When both exist (the crate on the capture machine), the committed index
  // must agree with the committed bytes — a torn artifact fails here.
  if (bytes && existsSync(indexPath)) {
    const entry = (readJson(indexPath) as ImageIndexEntry[]).find((e) => e.file === imageFile);
    if (entry && entry.sha256 !== sha256) {
      fail(`${root}/images-index.json disagrees with the committed bytes of img/${imageFile}`);
    }
  }

  // The image sample: committed truth is the images-index when present
  // (the crate — its bytes are git-excluded), else the committed bytes
  // themselves (the fixture). Five evenly-spread positions over the whole
  // set, so doctoring any sampled derivative is caught, not just the one
  // predictable probe image above.
  let imageEntries: { file: string; sha256: string }[];
  if (existsSync(indexPath)) {
    imageEntries = (readJson(indexPath) as ImageIndexEntry[]).map(({ file, sha256: hash }) => ({
      file,
      sha256: hash,
    }));
  } else {
    imageEntries = readdirSync(join(repoRoot, root, "img"))
      .filter((f) => f.endsWith(".avif"))
      .sort()
      .map((file) => ({
        file,
        sha256: createHash("sha256")
          .update(readFileSync(join(repoRoot, root, "img", file)))
          .digest("hex"),
      }));
  }
  if (imageEntries.length === 0) {
    fail(`snapshot under ${root} has no committed image derivatives to sample`);
  }
  const samplePositions = new Set(
    [0, 1, 2, 3, 4].map((i) => Math.floor((i * (imageEntries.length - 1)) / 4)),
  );
  const imageSample = [...samplePositions].map((pos) => {
    const entry = imageEntries[pos];
    if (!entry) fail(`image sample position ${pos} out of range under ${root}`);
    return { path: `/assets/img/${entry.file}`, sha256: entry.sha256 };
  });

  return {
    manifest: committed,
    manifestRaw: committedRaw,
    root,
    summaries,
    details,
    pdpDetail,
    cachePdpId,
    missingId,
    image: { path: imageSrc, sha256, bytes },
    imageSample,
  };
}

let cached: Promise<ServedSnapshot> | undefined;

/** Resolve (once per vitest worker) which snapshot the origin serves. */
export function loadServedSnapshot(): Promise<ServedSnapshot> {
  cached ??= resolve();
  return cached;
}

/** The reference renderer's snapshot name for a resolved committed root —
 *  the two names `packages/reference/render/lib.mjs` loads by. */
export function snapshotNameFor(root: string): "fixture" | "crate" {
  return root === "tools/snapshot-fixture/snapshot" ? "fixture" : "crate";
}

/** The editorial surface's featured release id for the resolved snapshot:
 *  the fixture's curation.json names it; the crate's frozen curation
 *  predates the field, so the crate pick is the recorded design constant
 *  (ADR-0008 §9 — editorial 953800, a curated choice, not a receipt). */
export function editorialFeaturedId(snap: ServedSnapshot): number {
  if (snapshotNameFor(snap.root) === "crate") return 953800;
  const curated = (
    readJson(join(repoRoot, snap.root, "curation.json")) as { featured?: number }
  ).featured;
  if (curated == null) fail(`snapshot under ${snap.root} names no featured release id`);
  return curated;
}
