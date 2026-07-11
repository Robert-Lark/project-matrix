/**
 * Phase 1 — label searches. One paginated `GET /database/search` sweep per
 * spec label (type=release, format=Vinyl), every page landed raw on disk
 * before the next request. The year window is applied at PLAN time, client
 * side: the docs document `year` only as a single-value filter.
 *
 * Checkpoints: page-NNN.json per fetched page; complete.json per finished
 * label. Resume: a label with complete.json is skipped; otherwise the sweep
 * continues after the highest landed page (re-requesting past the last page
 * is safe — Discogs returns an empty results array).
 */
import type { DiscogsClient } from "./discogs";
import { RawSearchPage } from "./raw";
import type { CrateSpec } from "./spec";
import { exists, listDir, paths, writeJsonAtomic, type Dirs } from "./store";
import { slugify } from "./util";

export interface SearchComplete {
  label: string;
  pagesFetched: number;
  /** true when maxSearchPagesPerLabel stopped the sweep before the last page. */
  capped: boolean;
  totalPagesReported: number;
  itemsReported: number | null;
}

function highestFetchedPage(d: Dirs, labelSlug: string): number {
  const pages = listDir(paths.searchDir(d, labelSlug))
    .map((f) => /^page-(\d{3})\.json$/.exec(f)?.[1])
    .filter((m): m is string => m !== undefined)
    .map(Number);
  return pages.length > 0 ? Math.max(...pages) : 0;
}

export async function searchPhase(
  spec: CrateSpec,
  dirs: Dirs,
  client: DiscogsClient,
  log: (line: string) => void,
): Promise<void> {
  for (const label of spec.labels) {
    const slug = slugify(label);
    if (exists(paths.searchComplete(dirs, slug))) {
      log(`[search] ${label}: complete (checkpoint)`);
      continue;
    }

    let page = highestFetchedPage(dirs, slug) + 1;
    if (page > 1) log(`[search] ${label}: resuming at page ${page}`);

    for (;;) {
      const q = new URLSearchParams({
        type: "release",
        format: spec.format,
        label,
        per_page: String(spec.searchPerPage),
        page: String(page),
      });
      const raw = await client.getJson(`/database/search?${q}`);
      const parsed = RawSearchPage.parse(raw); // trust boundary: fail loudly BEFORE checkpointing
      writeJsonAtomic(paths.searchPage(dirs, slug, page), raw, false);

      const { pages, items } = parsed.pagination;
      log(`[search] ${label}: page ${page}/${pages} (${parsed.results.length} rows)`);

      const done = page >= pages || parsed.results.length === 0;
      const capped = !done && page >= spec.maxSearchPagesPerLabel;
      if (capped) {
        // No silent caps: the checkpoint records exactly what was left behind.
        log(
          `[search] ${label}: CAPPED at ${page} of ${pages} reported pages — remainder not fetched`,
        );
      }
      if (done || capped) {
        const complete: SearchComplete = {
          label,
          pagesFetched: page,
          capped,
          totalPagesReported: pages,
          itemsReported: items ?? null,
        };
        writeJsonAtomic(paths.searchComplete(dirs, slug), complete);
        break;
      }
      page += 1;
    }
  }
}
