/**
 * Checkpoint store: the capture directory layout + atomic writes.
 *
 * The checkpoint discipline (issue #9): every fetched page/release/image lands
 * on disk before the next request, a file's EXISTENCE is its checkpoint, and
 * every write is atomic (temp file + rename) so a killed run can never leave a
 * half-written checkpoint that a resume would trust.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export interface Dirs {
  /** Working state — gitignored (raw responses, originals, tombstones). */
  capture: string;
  /** The frozen output in the fixture snapshot layout; img/ is gitignored. */
  crate: string;
}

export const paths = {
  searchDir: (d: Dirs, labelSlug: string) => join(d.capture, "search", labelSlug),
  searchPage: (d: Dirs, labelSlug: string, page: number) =>
    join(d.capture, "search", labelSlug, `page-${String(page).padStart(3, "0")}.json`),
  searchComplete: (d: Dirs, labelSlug: string) =>
    join(d.capture, "search", labelSlug, "complete.json"),
  plan: (d: Dirs) => join(d.capture, "plan.json"),
  detail: (d: Dirs, id: number) => join(d.capture, "details", `${id}.json`),
  tombstoneDir: (d: Dirs) => join(d.capture, "tombstones"),
  tombstone: (d: Dirs, id: number) => join(d.capture, "tombstones", `${id}.json`),
  originalDir: (d: Dirs) => join(d.capture, "img-original"),
  original: (d: Dirs, id: number, k: number, ext: string) =>
    join(d.capture, "img-original", `${id}-${k}.${ext}`),
  imageSkip: (d: Dirs, id: number, k: number) =>
    join(d.capture, "img-skip", `${id}-${k}.json`),
  crateImgDir: (d: Dirs) => join(d.crate, "img"),
  derivative: (d: Dirs, file: string) => join(d.crate, "img", file),
  manifest: (d: Dirs) => join(d.crate, "manifest.json"),
  summaries: (d: Dirs) => join(d.crate, "summaries.json"),
  details: (d: Dirs) => join(d.crate, "details.json"),
  imagesIndex: (d: Dirs) => join(d.crate, "images-index.json"),
};

export function exists(path: string): boolean {
  return existsSync(path);
}

export function writeFileAtomic(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

export function writeJsonAtomic(path: string, value: unknown, pretty = true): void {
  writeFileAtomic(path, JSON.stringify(value, null, pretty ? 2 : undefined) + "\n");
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function readJsonIf<T>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null;
}

/** Sorted listing; [] when the directory does not exist yet. */
export function listDir(path: string): string[] {
  return existsSync(path) ? readdirSync(path).filter((f) => !f.endsWith(".tmp")).sort() : [];
}
