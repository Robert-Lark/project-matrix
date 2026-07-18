/**
 * Phase 5 — image derivatives. The serving assets, generated locally from the
 * retained originals (no API traffic).
 *
 * Derivative spec (issue #9): the reference render's release-card media is the
 * dimension anchor — 600×600 — so derivatives fit inside 600×600 preserving
 * aspect ratio (never upscaled), encoded AVIF (the fixture's format; the edge
 * Worker serves content-type from seed metadata). True output dimensions ride
 * as data in the trays (honest CLS). A follow-up may refine sizing once
 * aesthetic-direction / the PDP build fix final component dimensions —
 * re-derivation starts here, never at Discogs.
 */
import sharp from "sharp";
import { activeIds, readTombstones } from "./details";
import { originalsByKey } from "./images";
import type { Plan } from "./plan";
import { exists, paths, writeFileAtomic, type Dirs } from "./store";
import { join } from "node:path";

export function derivativeName(id: number, k: number): string {
  return k === 1 ? `${id}-primary.avif` : `${id}-${k}.avif`;
}

/**
 * The 160px thumb tier (surface-design DRAFT §6): PDP gallery thumbs 2–5
 * render into ~72px slots — serving the 600px derivative there costs ~100 KB
 * of oversized fetches per PDP (kill-condition-1 surface). Thumbs are minted
 * from the retained originals, exactly like the 600px tier ("re-derivation
 * starts here, never at Discogs").
 *
 * The trays are NOT touched: the frozen snapshot stays frozen. A render
 * derives the thumb src by convention — `src.replace(/\.avif$/, ".thumb.avif")`
 * — so `123-primary.avif` pairs with `123-primary.thumb.avif`.
 */
export function thumbName(id: number, k: number): string {
  return derivativeName(id, k).replace(/\.avif$/, ".thumb.avif");
}

export async function derivePhase(
  dirs: Dirs,
  plan: Plan,
  log: (line: string) => void,
): Promise<void> {
  const ids = activeIds(plan, readTombstones(dirs));
  const originals = originalsByKey(dirs);
  let made = 0;

  for (const id of ids) {
    for (let k = 1; k <= plan.spec.maxImagesPerRelease; k++) {
      const original = originals.get(`${id}-${k}`);
      if (!original) {
        if (k === 1) throw new Error(`[derive] no primary original for ${id} — run images first`);
        continue;
      }
      const out = paths.derivative(dirs, derivativeName(id, k));
      if (!exists(out)) {
        const bytes = await sharp(join(paths.originalDir(dirs), original))
          .rotate() // honor EXIF orientation before it becomes data
          .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
          .avif({ quality: 55, effort: 4 })
          .toBuffer();
        writeFileAtomic(out, bytes);
        made += 1;
        if (made % 50 === 0) log(`[derive] ${made} derivatives generated`);
      }
      const thumbOut = paths.derivative(dirs, thumbName(id, k));
      if (!exists(thumbOut)) {
        const bytes = await sharp(join(paths.originalDir(dirs), original))
          .rotate() // same EXIF handling as the 600px tier
          .resize({ width: 160, height: 160, fit: "inside", withoutEnlargement: true })
          .avif({ quality: 50, effort: 4 })
          .toBuffer();
        writeFileAtomic(thumbOut, bytes);
        made += 1;
        if (made % 50 === 0) log(`[derive] ${made} derivatives generated`);
      }
    }
  }
  log(`[derive] complete (${made} new)`);
}
