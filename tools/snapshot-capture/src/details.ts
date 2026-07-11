/**
 * Phase 3 — per-release details: `GET /releases/{id}?curr_abbr=USD` (one call;
 * the commerce aggregate — lowest_price + num_for_sale — rides inline, ADR-0002
 * §5). Raw responses land verbatim; a release that cannot serve the contract
 * (gone, no images, no artists, no formats) is TOMBSTONED and a substitute is
 * drawn deterministically from the plan's ordered reserve.
 *
 * The active set is a pure function of (plan, tombstones): chosen releases
 * minus tombstoned ones, each replaced by the next non-tombstoned reserve
 * entry in rank order — so resume runs, whatever they interleave, converge on
 * the same crate.
 */
import { rmSync } from "node:fs";
import type { DiscogsClient } from "./discogs";
import { HttpStatusError } from "./discogs";
import { labelMatches, type Plan } from "./plan";
import { RawRelease } from "./raw";
import { exists, listDir, paths, readJson, writeJsonAtomic, type Dirs } from "./store";

export interface Tombstone {
  id: number;
  reason: string;
  at: string;
}

export function readTombstones(dirs: Dirs): Map<number, string> {
  const map = new Map<number, string>();
  for (const file of listDir(paths.tombstoneDir(dirs))) {
    const m = /^(\d+)\.json$/.exec(file);
    if (!m) continue;
    map.set(Number(m[1]), readJson<Tombstone>(paths.tombstone(dirs, Number(m[1]))).reason);
  }
  return map;
}

export function writeTombstone(dirs: Dirs, id: number, reason: string): void {
  writeJsonAtomic(paths.tombstone(dirs, id), {
    id,
    reason,
    at: new Date().toISOString(),
  } satisfies Tombstone);
}

/** chosen minus tombstones, substituted in reserve rank order. Deterministic. */
export function activeIds(plan: Plan, tombstones: ReadonlyMap<number, string>): number[] {
  const reserve = plan.reserve.filter((r) => !tombstones.has(r.id));
  let next = 0;
  const ids: number[] = [];
  for (const c of plan.chosen) {
    if (!tombstones.has(c.id)) {
      ids.push(c.id);
    } else if (next < reserve.length) {
      const sub = reserve[next++];
      if (sub) ids.push(sub.id);
    }
  }
  return ids;
}

/**
 * Contract-critical arrival guard: a release the trays cannot be built from is
 * dropped HERE (and substituted), so normalization failures later mean a
 * pipeline bug, not a data gap.
 *
 * The label check is the AUTHORITATIVE crate-membership test: search-result
 * label arrays mix in publishers/companies ("Par-ki-lee Publishing" surfaced
 * a Boogie Times record in the Ki sweep — probed live), but the release's own
 * labels[] lists actual label entities. Membership = the release's labels
 * match ANY spec label (co-releases between crate labels count).
 */
function arrivalDefect(release: RawRelease, specLabels: readonly string[]): string | null {
  if (!release.title.trim()) return "empty-title";
  if (!release.artists?.length) return "no-artists";
  if (!release.formats?.length) return "no-formats";
  const primary = release.images?.find((i) => i.type === "primary") ?? release.images?.[0];
  if (!primary?.uri) return "no-primary-image";
  const labelNames = (release.labels ?? []).map((l) => l.name);
  if (!specLabels.some((sl) => labelMatches(sl, labelNames))) return "label-mismatch";
  return null;
}

export async function detailsPhase(
  dirs: Dirs,
  client: DiscogsClient,
  plan: Plan,
  log: (line: string) => void,
): Promise<void> {
  for (;;) {
    const tombstones = readTombstones(dirs);
    const ids = activeIds(plan, tombstones);

    // Reconcile pass: re-run the arrival guard over details already on disk.
    // The guard can evolve between resumed runs (the label-mismatch rule was
    // added mid-capture) — checkpointed responses must not bypass it. A
    // checkpoint that is not even JSON is torn (power loss can truncate
    // despite atomic rename — no fsync): DELETED and refetched, never
    // tombstoned — a good release must not be dropped over local corruption.
    let reconciled = 0;
    for (const id of ids) {
      if (!exists(paths.detail(dirs, id))) continue;
      let raw: unknown;
      try {
        raw = readJson(paths.detail(dirs, id));
      } catch {
        log(`[details] ${id}: torn checkpoint — deleted, will refetch`);
        rmSync(paths.detail(dirs, id), { force: true });
        reconciled += 1;
        continue;
      }
      const parsed = RawRelease.safeParse(raw);
      const defect = parsed.success
        ? arrivalDefect(parsed.data, plan.spec.labels)
        : "shape";
      if (defect) {
        log(`[details] ${id}: ${defect} (reconcile) — tombstoned, substituting from reserve`);
        writeTombstone(dirs, id, defect);
        reconciled += 1;
      }
    }
    if (reconciled > 0) continue; // active set changed — recompute

    const missing = ids.filter((id) => !exists(paths.detail(dirs, id)));
    if (missing.length === 0) {
      const active = activeIds(plan, tombstones).length;
      if (active < plan.spec.targetReleases) {
        log(
          `[details] WARNING: reserve exhausted — ${active} of ${plan.spec.targetReleases} target releases`,
        );
      }
      return;
    }

    log(`[details] ${missing.length} releases to fetch`);
    for (const id of missing) {
      let raw: unknown;
      try {
        raw = await client.getJson(`/releases/${id}?curr_abbr=USD`);
      } catch (err) {
        if (err instanceof HttpStatusError && [403, 404, 410].includes(err.status)) {
          log(`[details] ${id}: ${err.status} — tombstoned, substituting from reserve`);
          writeTombstone(dirs, id, `http-${err.status}`);
          continue;
        }
        throw err;
      }

      const parsed = RawRelease.safeParse(raw);
      if (!parsed.success) {
        log(`[details] ${id}: unusable shape — tombstoned (${parsed.error.issues[0]?.message})`);
        writeTombstone(dirs, id, "shape");
        continue;
      }
      const defect = arrivalDefect(parsed.data, plan.spec.labels);
      if (defect) {
        log(`[details] ${id}: ${defect} — tombstoned, substituting from reserve`);
        writeTombstone(dirs, id, defect);
        continue;
      }
      writeJsonAtomic(paths.detail(dirs, id), raw, false);
    }
    // Tombstones may have pulled substitutes into the active set — go again.
  }
}
