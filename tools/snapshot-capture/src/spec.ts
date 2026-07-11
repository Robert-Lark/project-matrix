/**
 * The crate spec — the operational definition of the curated slice, as data
 * (rate-card precedent: no crate knowledge in code). The committed
 * crate.spec.json records Rob's choice (issue #9) so the capture is
 * reproducible from the spec + the frozen search checkpoints.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";

export const CrateSpec = z.object({
  slug: z.string().min(1),
  description: z.string(),
  decidedBy: z.string(),
  labels: z.array(z.string().min(1)).min(1),
  format: z.literal("Vinyl"),
  yearMin: z.number().int(),
  yearMax: z.number().int(),
  targetReleases: z.number().int().positive(),
  maxImagesPerRelease: z.number().int().min(1),
  searchPerPage: z.number().int().min(1).max(100), // Discogs pagination max, per the docs
  maxSearchPagesPerLabel: z.number().int().min(1),
});
export type CrateSpec = z.infer<typeof CrateSpec>;

export function loadSpec(path: string): CrateSpec {
  return CrateSpec.parse(JSON.parse(readFileSync(path, "utf8")));
}
