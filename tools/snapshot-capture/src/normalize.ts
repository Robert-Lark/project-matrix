/**
 * Phase 6 — normalize ONCE + freeze (ADR-0002 §6). Raw Discogs JSON becomes
 * the two trays here and only here; no variant ever parses a raw response.
 * Every row is Zod-validated against @pm/data-contract before anything is
 * written, and the output mirrors the fixture snapshot layout so the edge
 * Worker and seeder consume it unchanged.
 *
 * Data-not-UI guardrails applied: durations to integer seconds, price as a
 * number, image dimensions as data read from the actual derivative files,
 * Discogs markup stripped from notes — and nothing pre-sorted, pre-formatted,
 * or pre-computed for render. Row order is id-ascending: the one neutral,
 * deterministic order that is not a presentation choice.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  ReleaseDetail,
  ReleaseSummary,
  SnapshotManifest,
  type Image,
} from "@pm/data-contract";
import { PLP_N } from "@pm/measurement";
import { activeIds, readTombstones, type Tombstone } from "./details";
import { derivativeName } from "./derive";
import { originalsByKey } from "./images";
import type { Plan } from "./plan";
import { RawRelease } from "./raw";
import { exists, listDir, paths, readJson, writeFileAtomic, writeJsonAtomic, type Dirs } from "./store";
import {
  parseDurationSeconds,
  slugify,
  stripDiscogsMarkup,
  stripNameDisambiguation,
} from "./util";

/**
 * Join the artist credits into one display string. `anv` (alternate name
 * variation) wins over `name` when present; the numeric "(2)" disambiguation
 * suffix is database bookkeeping, stripped; `join` is the connector to the
 * NEXT credit ("And", "&", ",") with comma spacing normalized.
 */
export function artistDisplay(artists: { name: string; anv?: string; join?: string }[]): string {
  const parts: string[] = [];
  artists.forEach((a, i) => {
    parts.push(stripNameDisambiguation((a.anv?.trim() || a.name).trim()));
    if (i < artists.length - 1) {
      const join = (a.join ?? "").trim();
      parts.push(join === "" || join === "," ? ", " : ` ${join} `);
    }
  });
  return parts.join("").replace(/\s+/g, " ").trim();
}

async function imageData(dirs: Dirs, file: string, alt: string): Promise<Image> {
  const meta = await sharp(paths.derivative(dirs, file)).metadata();
  if (!meta.width || !meta.height) throw new Error(`[normalize] no dimensions in ${file}`);
  return { src: `/assets/img/${file}`, width: meta.width, height: meta.height, alt };
}

/**
 * The manifest's SHA must attest a tree that actually produced the trays —
 * a dirty working tree demonstrably did not (the capture code itself may be
 * uncommitted, as it was for this crate's first freeze). Dirty tree → null;
 * the commit that lands the trays is then the provenance of record — and MUST
 * be backfilled into the committed manifest (and re-put to any remote bucket
 * serving the crate) in the immediately-following commit. A published
 * `"commitSha": null` is a broken provenance chain in public: the strategy
 * review (2026-07-12, finding 5) found exactly that on the live plane.
 * Backfilled for this crate with the tray-landing commit f60385f.
 */
function gitHead(): string | null {
  try {
    const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
    if (dirty !== "") return null;
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function normalizePhase(
  dirs: Dirs,
  plan: Plan,
  log: (line: string) => void,
): Promise<void> {
  const ids = activeIds(plan, readTombstones(dirs)).sort((a, b) => a - b);
  const details: ReleaseDetail[] = [];
  const failures: { id: number; error: string }[] = [];
  const referenced = new Set<string>();

  for (const id of ids) {
    const raw = RawRelease.parse(readJson(paths.detail(dirs, id)));
    const artist = artistDisplay(raw.artists ?? []);
    const title = raw.title.trim();

    const files: string[] = [];
    for (let k = 1; k <= plan.spec.maxImagesPerRelease; k++) {
      const file = derivativeName(id, k);
      if (exists(paths.derivative(dirs, file))) files.push(file);
      else if (k === 1) throw new Error(`[normalize] missing primary derivative for ${id}`);
    }
    const images = await Promise.all(
      files.map((file, idx) =>
        imageData(
          dirs,
          file,
          idx === 0
            ? `${artist} — ${title}, front cover`
            : `${artist} — ${title}, release photo ${idx + 1}`,
        ),
      ),
    );
    files.forEach((f) => referenced.add(f));
    const cover = images[0];
    if (!cover) throw new Error(`[normalize] no cover image for ${id}`);

    // formats[].text is free descriptive text ("Digipak", vinyl color) —
    // folded into descriptions so it survives normalization as data.
    const formats = (raw.formats ?? []).map((f) => ({
      name: f.name,
      qty: Math.max(Number.parseInt(String(f.qty ?? "1"), 10) || 1, 1),
      descriptions: [...(f.descriptions ?? []), ...(f.text?.trim() ? [f.text.trim()] : [])],
    }));
    const primaryFormat = formats[0];
    if (!primaryFormat) throw new Error(`[normalize] no formats for ${id} (arrival guard hole)`);

    const seenLabels = new Set<string>();
    const labels = (raw.labels ?? [])
      .map((l) => ({ name: stripNameDisambiguation(l.name), catno: l.catno ?? "" }))
      .filter((l) => {
        const key = `${l.name}|${l.catno}`;
        if (seenLabels.has(key)) return false;
        seenLabels.add(key);
        return true;
      });

    const notes = raw.notes ? stripDiscogsMarkup(raw.notes) : "";

    const detail = {
      id,
      slug: `${id}-${slugify(artist)}-${slugify(title)}`,
      title,
      artist,
      cover,
      format:
        primaryFormat.descriptions.length > 0
          ? `${primaryFormat.name}, ${primaryFormat.descriptions.join(", ")}`
          : primaryFormat.name,
      year: raw.year && raw.year > 0 ? raw.year : null,
      priceFrom:
        typeof raw.lowest_price === "number"
          ? { amount: raw.lowest_price, currency: "USD" as const }
          : null,
      numForSale: raw.num_for_sale ?? 0,
      genres: [...new Set(raw.genres ?? [])],
      styles: [...new Set(raw.styles ?? [])],
      images,
      tracklist: (raw.tracklist ?? [])
        .filter((t) => (t.type_ ?? "track") === "track")
        .map((t) => ({
          position: t.position ?? "",
          title: t.title ?? "",
          durationSeconds: parseDurationSeconds(t.duration),
        })),
      labels,
      formats,
      notes: notes === "" ? null : notes,
    };

    const parsed = ReleaseDetail.safeParse(detail);
    if (!parsed.success) {
      failures.push({ id, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    details.push(parsed.data);
  }

  if (failures.length > 0) {
    for (const f of failures) log(`[normalize] INVALID ${f.id}: ${f.error}`);
    throw new Error(`[normalize] ${failures.length} releases failed contract validation`);
  }

  // The small tray is DERIVED from the full tray — one source of truth
  // (fixture precedent).
  const summaries = details.map((d) =>
    ReleaseSummary.parse({
      id: d.id,
      slug: d.slug,
      title: d.title,
      artist: d.artist,
      cover: d.cover,
      format: d.format,
      year: d.year,
      priceFrom: d.priceFrom,
      numForSale: d.numForSale,
      genres: d.genres,
      styles: d.styles,
    }),
  );

  // The environment "data volume" knob serves n up to PLP_N.max from the one
  // crate (ADR-0002 §5) — a real crate below that is not a warning, it is a
  // broken premise (reserve exhaustion, upstream incident). Freeze refuses.
  // Deliberately small specs (probe/dev runs) bind to their own target.
  const floor = Math.min(plan.spec.targetReleases, PLP_N.max);
  if (details.length < floor) {
    throw new Error(
      `[normalize] crate holds ${details.length} releases — below the floor of ${floor} ` +
        `(min of spec target ${plan.spec.targetReleases} and the ?n= knob's ` +
        `${PLP_N.max}, ADR-0002 §5). Refusing to freeze.`,
    );
  }
  if (details.length < plan.spec.targetReleases) {
    log(
      `[normalize] WARNING: crate holds ${details.length} releases (target ${plan.spec.targetReleases})`,
    );
  }

  // Orphaned derivatives (from releases tombstoned after an earlier derive
  // pass) must not ride into the frozen artifact — remove, loudly. Raw
  // listing on purpose: stale atomic-write leftovers (*.tmp) are orphans too.
  const orphans = readdirSync(paths.crateImgDir(dirs)).filter((f) => !referenced.has(f));
  for (const f of orphans) unlinkSync(paths.derivative(dirs, f));
  if (orphans.length > 0) log(`[normalize] removed ${orphans.length} orphaned derivatives`);

  // Committed integrity index: anyone can verify the (uncommitted) image
  // bytes against the public repo without the repo redistributing them.
  // originalSha256 chains each derivative to the retained Discogs original;
  // the chain necessarily ends there — the live URLs are signed, auth-gated,
  // and not byte-stable, so no public hash of Discogs's own bytes can exist.
  const originals = originalsByKey(dirs);
  const imagesIndex = [...referenced].sort().map((file) => {
    const bytes = readFileSync(paths.derivative(dirs, file));
    const detail = details.find((d) => d.images.some((i) => i.src === `/assets/img/${file}`));
    const image = detail?.images.find((i) => i.src === `/assets/img/${file}`);
    const m = /^(\d+)-(primary|\d+)\.avif$/.exec(file);
    const originalFile = m ? originals.get(`${m[1]}-${m[2] === "primary" ? 1 : m[2]}`) : undefined;
    return {
      file,
      releaseId: detail?.id ?? null,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      originalSha256: originalFile
        ? createHash("sha256")
            .update(readFileSync(join(paths.originalDir(dirs), originalFile)))
            .digest("hex")
        : null,
      width: image?.width ?? null,
      height: image?.height ?? null,
    };
  });

  // The committed curation receipt (ADR-0001 §9): the spec, per-label stats,
  // and every tombstone with its reason — enough to audit how the crate was
  // cut without the gitignored working state.
  const tombstoneList = listDir(paths.tombstoneDir(dirs))
    .map((f) => readJson<Tombstone>(join(paths.tombstoneDir(dirs), f)))
    .sort((a, b) => a.id - b.id)
    .map(({ id, reason }) => ({ id, reason }));
  const curation = {
    spec: plan.spec,
    planGeneratedAt: plan.generatedAt,
    perLabel: plan.perLabel,
    reserveSize: plan.reserve.length,
    tombstones: tombstoneList,
  };

  const newSummaries = JSON.stringify(summaries) + "\n";
  const newDetails = JSON.stringify(details) + "\n";

  // Content-aware freeze: when the trays are byte-identical to the existing
  // frozen artifact, the dated manifest is PRESERVED — a no-op re-run must
  // not drift capturedAt/commitSha on a committed snapshot (ADR-0001 §9).
  const existingSummaries = exists(paths.summaries(dirs))
    ? readFileSync(paths.summaries(dirs), "utf8")
    : null;
  const existingDetails = exists(paths.details(dirs))
    ? readFileSync(paths.details(dirs), "utf8")
    : null;
  const unchanged =
    existingSummaries === newSummaries &&
    existingDetails === newDetails &&
    exists(paths.manifest(dirs));

  const manifest = unchanged
    ? SnapshotManifest.parse(readJson(paths.manifest(dirs)))
    : SnapshotManifest.parse({
        capturedAt: new Date().toISOString().slice(0, 10),
        source: "api.discogs.com",
        crate: plan.spec.slug,
        releaseCount: details.length,
        commitSha: gitHead(),
      });

  if (!unchanged) {
    writeFileAtomic(paths.summaries(dirs), newSummaries);
    writeFileAtomic(paths.details(dirs), newDetails);
    writeJsonAtomic(paths.manifest(dirs), manifest);
  }
  writeJsonAtomic(paths.imagesIndex(dirs), imagesIndex);
  writeJsonAtomic(join(dirs.crate, "curation.json"), curation);

  log(
    `[normalize] ${unchanged ? "unchanged — manifest preserved" : "frozen"}: ` +
      `${details.length} releases, ${referenced.size} images, ` +
      `captured-at ${manifest.capturedAt}, sha ${manifest.commitSha ?? "null"}`,
  );
}
