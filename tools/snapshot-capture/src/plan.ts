/**
 * Phase 2 — the crate plan: the deterministic curation rule (issue #9) applied
 * to the frozen search checkpoints. Pure disk → disk; no API traffic.
 *
 * Rule of record:
 *  - candidate = search item with type=release, a Vinyl format, year inside
 *    the spec window, a non-placeholder image hint, and a label-name match
 *    (whole-word: fuzzy search may return "Kitchen Label" for "Ki");
 *  - dedupe by release id, labels walked in spec order;
 *  - per-label quota = ceil(target / labels-with-candidates), each label's
 *    candidates ranked by community popularity (have + want — a store stocks
 *    what people want), ties broken by lower id;
 *  - overshoot trimmed globally from the least popular chosen; shortfall
 *    backfilled from the globally-ranked remainder;
 *  - everything unchosen becomes the ordered reserve, from which detail/image
 *    failures are substituted deterministically.
 *
 * The plan is WRITE-ONCE: once plan.json exists it is frozen — code tweaks or
 * upstream drift between resumed runs cannot silently re-curate the crate.
 * Deleting the file is the explicit re-plan action.
 */
import { RawSearchPage, type RawSearchItem } from "./raw";
import type { CrateSpec } from "./spec";
import { listDir, paths, readJson, readJsonIf, writeJsonAtomic, type Dirs } from "./store";
import { slugify } from "./util";
import type { SearchComplete } from "./search";
import { join } from "node:path";

export interface Candidate {
  id: number;
  /** The spec label whose sweep first surfaced it. */
  label: string;
  popularity: number;
  year: number;
}

export interface LabelStats {
  pagesFetched: number;
  capped: boolean;
  rawItems: number;
  matched: number;
  uniqueNew: number;
  chosen: number;
  rejected: { type: number; format: number; year: number; image: number; labelMismatch: number };
}

export interface Plan {
  generatedAt: string;
  spec: CrateSpec;
  perLabel: Record<string, LabelStats>;
  chosen: Candidate[];
  reserve: Candidate[];
}

/**
 * Case-insensitive, START-ANCHORED label match against a label-name array:
 * the spec label must open the entity name, with a word boundary after it
 * (hyphens word-internal). Suffix variance is legitimate entity naming
 * ("Erased Tapes" → "Erased Tapes Records Ltd.", "Thesis" → "Thesis +
 * Instinct records"); PREFIX matches are impostors — both classes probed
 * live: "Par-ki-lee Publishing" matched "Ki" under plain boundaries, and
 * "Surfin' Ki Records" (garage punk) matched a mid-string "Ki Records" and
 * put three Giuda pressings in an ambient crate.
 */
export function labelMatches(specLabel: string, itemLabels: readonly string[]): boolean {
  const escaped = specLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}(?:[^\\p{L}\\p{N}-]|$)`, "iu");
  return itemLabels.some((l) => re.test(l.trim()));
}

function candidateYear(item: RawSearchItem): number | null {
  const year = Number.parseInt(String(item.year ?? ""), 10);
  return Number.isFinite(year) && year > 0 ? year : null;
}

const byPopularity = (a: Candidate, b: Candidate) => b.popularity - a.popularity || a.id - b.id;

export function planPhase(spec: CrateSpec, dirs: Dirs, log: (line: string) => void): Plan {
  const existing = readJsonIf<Plan>(paths.plan(dirs));
  if (existing) {
    log(`[plan] frozen plan exists (${existing.chosen.length} chosen) — delete plan.json to re-plan`);
    return existing;
  }

  const seen = new Set<number>();
  const perLabel: Record<string, LabelStats> = {};
  const byLabel = new Map<string, Candidate[]>();

  for (const label of spec.labels) {
    const slug = slugify(label);
    const complete = readJsonIf<SearchComplete>(paths.searchComplete(dirs, slug));
    if (!complete) throw new Error(`[plan] search incomplete for label "${label}" — run search first`);

    const stats: LabelStats = {
      pagesFetched: complete.pagesFetched,
      capped: complete.capped,
      rawItems: 0,
      matched: 0,
      uniqueNew: 0,
      chosen: 0,
      rejected: { type: 0, format: 0, year: 0, image: 0, labelMismatch: 0 },
    };
    const candidates: Candidate[] = [];

    for (const file of listDir(paths.searchDir(dirs, slug))) {
      if (!/^page-\d{3}\.json$/.test(file)) continue;
      const page = RawSearchPage.parse(readJson(join(paths.searchDir(dirs, slug), file)));
      for (const item of page.results) {
        stats.rawItems += 1;
        if (item.type !== undefined && item.type !== "release") {
          stats.rejected.type += 1;
          continue;
        }
        if (!item.format?.some((f) => f.toLowerCase() === spec.format.toLowerCase())) {
          stats.rejected.format += 1;
          continue;
        }
        const year = candidateYear(item);
        if (year === null || year < spec.yearMin || year > spec.yearMax) {
          stats.rejected.year += 1;
          continue;
        }
        const imageHint = item.cover_image ?? item.thumb ?? "";
        if (imageHint === "" || imageHint.includes("spacer")) {
          stats.rejected.image += 1;
          continue;
        }
        if (!labelMatches(label, item.label ?? [])) {
          stats.rejected.labelMismatch += 1;
          continue;
        }
        stats.matched += 1;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        stats.uniqueNew += 1;
        candidates.push({
          id: item.id,
          label,
          popularity: (item.community?.want ?? 0) + (item.community?.have ?? 0),
          year,
        });
      }
    }

    candidates.sort(byPopularity);
    byLabel.set(label, candidates);
    perLabel[label] = stats;
  }

  const labelsWithCandidates = [...byLabel.entries()].filter(([, c]) => c.length > 0);
  if (labelsWithCandidates.length === 0) throw new Error("[plan] zero candidates across all labels");
  const quota = Math.ceil(spec.targetReleases / labelsWithCandidates.length);

  let chosen: Candidate[] = [];
  const remainder: Candidate[] = [];
  for (const [, candidates] of labelsWithCandidates) {
    chosen.push(...candidates.slice(0, quota));
    remainder.push(...candidates.slice(quota));
  }
  remainder.sort(byPopularity);

  if (chosen.length > spec.targetReleases) {
    // Trim the global least-popular of the chosen (ties: higher id goes
    // first); the trimmed re-enter the reserve in popularity rank, keeping
    // the reserve's documented ordering.
    chosen.sort(byPopularity);
    remainder.unshift(...chosen.splice(spec.targetReleases));
    remainder.sort(byPopularity);
  } else {
    while (chosen.length < spec.targetReleases && remainder.length > 0) {
      chosen.push(remainder.shift() as Candidate);
    }
  }
  chosen = [...chosen].sort((a, b) => a.id - b.id);
  for (const c of chosen) {
    const stats = perLabel[c.label];
    if (stats) stats.chosen += 1;
  }

  const plan: Plan = {
    generatedAt: new Date().toISOString(),
    spec,
    perLabel,
    chosen,
    reserve: remainder,
  };
  writeJsonAtomic(paths.plan(dirs), plan);

  for (const [label, stats] of Object.entries(perLabel)) {
    log(
      `[plan] ${label}: ${stats.chosen} chosen of ${stats.uniqueNew} unique (${stats.matched} matched, ` +
        `rejected: year ${stats.rejected.year}, format ${stats.rejected.format}, ` +
        `label-mismatch ${stats.rejected.labelMismatch}, image ${stats.rejected.image})${stats.capped ? " [CAPPED]" : ""}`,
    );
    if (stats.uniqueNew === 0) {
      log(`[plan] WARNING: label "${label}" contributed nothing — name mismatch or no vinyl in window?`);
    }
  }
  log(`[plan] chosen ${plan.chosen.length} / target ${spec.targetReleases}, reserve ${plan.reserve.length}`);
  return plan;
}
