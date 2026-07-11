/** `pnpm capture status` — phase-by-phase progress, read purely from disk. */
import { SnapshotManifest } from "@pm/data-contract";
import { activeIds, readTombstones } from "./details";
import { imageJobs, originalsByKey } from "./images";
import type { Plan } from "./plan";
import { RawRelease } from "./raw";
import type { SearchComplete } from "./search";
import { exists, listDir, paths, readJson, readJsonIf, type Dirs } from "./store";
import type { CrateSpec } from "./spec";
import { slugify } from "./util";

export function statusCommand(spec: CrateSpec, dirs: Dirs, log: (line: string) => void): void {
  const done = spec.labels.filter((l) => exists(paths.searchComplete(dirs, slugify(l))));
  log(`search:     ${done.length}/${spec.labels.length} labels complete`);
  for (const label of spec.labels) {
    const complete = readJsonIf<SearchComplete>(paths.searchComplete(dirs, slugify(label)));
    const pages = listDir(paths.searchDir(dirs, slugify(label))).filter((f) =>
      f.startsWith("page-"),
    ).length;
    if (!complete && pages > 0) log(`            ${label}: in flight (${pages} pages landed)`);
    if (complete?.capped) log(`            ${label}: CAPPED at ${complete.pagesFetched} pages`);
  }

  const plan = readJsonIf<Plan>(paths.plan(dirs));
  if (!plan) {
    log("plan:       not generated");
    return;
  }
  const tombstones = readTombstones(dirs);
  const ids = activeIds(plan, tombstones);
  log(`plan:       ${plan.chosen.length} chosen, ${plan.reserve.length} reserve (frozen ${plan.generatedAt})`);
  if (tombstones.size > 0) {
    const byReason = new Map<string, number>();
    for (const reason of tombstones.values()) byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    log(
      `tombstones: ${tombstones.size} (${[...byReason.entries()].map(([r, n]) => `${r}×${n}`).join(", ")})`,
    );
  }

  const detailsFetched = ids.filter((id) => exists(paths.detail(dirs, id)));
  log(`details:    ${detailsFetched.length}/${ids.length} active releases fetched`);

  const have = originalsByKey(dirs);
  let jobs = 0;
  let doneJobs = 0;
  let unreadable = 0;
  for (const id of detailsFetched) {
    // Status must report, never crash: a torn/unparseable checkpoint is
    // counted (the run loop deletes-and-refetches it).
    let release;
    try {
      const parsed = RawRelease.safeParse(readJson(paths.detail(dirs, id)));
      if (!parsed.success) {
        unreadable += 1;
        continue;
      }
      release = parsed.data;
    } catch {
      unreadable += 1;
      continue;
    }
    for (const { k } of imageJobs(release, spec.maxImagesPerRelease)) {
      jobs += 1;
      if (have.has(`${id}-${k}`) || exists(paths.imageSkip(dirs, id, k))) doneJobs += 1;
    }
  }
  log(
    `images:     ${doneJobs}/${jobs} originals landed (of fetched details)` +
      (unreadable > 0 ? ` — ${unreadable} unreadable detail checkpoints` : ""),
  );
  log(`derive:     ${listDir(paths.crateImgDir(dirs)).length} derivatives in crate/img`);

  const manifest = readJsonIf<unknown>(paths.manifest(dirs));
  if (manifest) {
    const m = SnapshotManifest.parse(manifest);
    log(`frozen:     ${m.releaseCount} releases, captured-at ${m.capturedAt}, crate "${m.crate}"`);
  } else {
    log("frozen:     not yet normalized");
  }
}
