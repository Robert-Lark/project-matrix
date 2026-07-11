/**
 * Phase 4 — image originals. Downloads each active release's signed image
 * URLs verbatim (primary first, capped at spec.maxImagesPerRelease), landing
 * raw bytes on disk before the next request. Originals are RETAINED so the
 * derivative spec can be refined later (issue #9 follow-up note) without ever
 * re-pulling from Discogs.
 *
 * Failure semantics: a dead PRIMARY image tombstones the release (the
 * contract requires a cover) — the caller re-runs the details phase so the
 * deterministic substitute gets fetched. A dead secondary is recorded as a
 * skip marker and the gallery simply has one fewer photo.
 */
import type { DiscogsClient } from "./discogs";
import { HttpStatusError } from "./discogs";
import { activeIds, readTombstones, writeTombstone } from "./details";
import type { Plan } from "./plan";
import { RawRelease, type RawImage } from "./raw";
import {
  exists,
  listDir,
  paths,
  readJson,
  writeFileAtomic,
  writeJsonAtomic,
  type Dirs,
} from "./store";

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Ordered download jobs for one release: primary first, then secondaries. */
export function imageJobs(release: RawRelease, cap: number): { k: number; uri: string }[] {
  const images = release.images ?? [];
  const primary = images.find((i) => i.type === "primary") ?? images[0];
  if (!primary?.uri) return [];
  const secondaries = images.filter((i): i is RawImage => i !== primary && !!i.uri);
  return [primary, ...secondaries.slice(0, cap - 1)].map((img, idx) => ({
    k: idx + 1,
    uri: img.uri as string,
  }));
}

function extFor(uri: string, contentType: string | null): string {
  const fromPath = /\.(jpe?g|png|gif|webp|avif)$/i.exec(new URL(uri).pathname)?.[1];
  if (fromPath) return fromPath.toLowerCase().replace("jpeg", "jpg");
  return EXT_BY_CONTENT_TYPE[contentType?.split(";")[0]?.trim() ?? ""] ?? "img";
}

/** Map of `${id}-${k}` → filename for everything already downloaded. */
export function originalsByKey(dirs: Dirs): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of listDir(paths.originalDir(dirs))) {
    const m = /^(\d+-\d+)\./.exec(file);
    if (m?.[1]) map.set(m[1], file);
  }
  return map;
}

export async function imagesPhase(
  dirs: Dirs,
  client: DiscogsClient,
  plan: Plan,
  log: (line: string) => void,
): Promise<{ newTombstones: number }> {
  const tombstones = readTombstones(dirs);
  const ids = activeIds(plan, tombstones);
  const have = originalsByKey(dirs);
  let newTombstones = 0;
  let downloaded = 0;

  for (const id of ids) {
    if (!exists(paths.detail(dirs, id))) {
      throw new Error(`[images] detail checkpoint missing for ${id} — run details first`);
    }
    const release = RawRelease.parse(readJson(paths.detail(dirs, id)));
    for (const { k, uri } of imageJobs(release, plan.spec.maxImagesPerRelease)) {
      if (have.has(`${id}-${k}`) || exists(paths.imageSkip(dirs, id, k))) continue;
      try {
        const { bytes, contentType } = await client.getBinary(uri);
        const file = paths.original(dirs, id, k, extFor(uri, contentType));
        writeFileAtomic(file, bytes);
        have.set(`${id}-${k}`, file);
        downloaded += 1;
        if (downloaded % 25 === 0) log(`[images] ${downloaded} downloaded this pass`);
      } catch (err) {
        // Only DEAD-image statuses become durable state (details.ts
        // semantics): a retry-exhausted 429/5xx is transient upstream
        // trouble and must fail the run loudly — permanently rewriting
        // crate membership over an incident window would be silent and
        // wrong. A resume retries after the incident.
        if (!(err instanceof HttpStatusError) || ![403, 404, 410].includes(err.status)) {
          throw err;
        }
        if (k === 1) {
          log(`[images] ${id}: primary image ${err.status} — release tombstoned`);
          writeTombstone(dirs, id, `primary-image-${err.status}`);
          newTombstones += 1;
          break;
        }
        log(`[images] ${id}: secondary image ${k} ${err.status} — skipped`);
        writeJsonAtomic(paths.imageSkip(dirs, id, k), {
          id,
          k,
          status: err.status,
          at: new Date().toISOString(),
        });
      }
    }
  }
  log(`[images] pass complete: ${downloaded} new originals, ${newTombstones} new tombstones`);
  return { newTombstones };
}
