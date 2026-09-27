/**
 * No em dashes in anything a reader can see (2026-09-26).
 *
 * The site's copy and the docs it links to on GitHub are read by people who
 * treat the em dash as a sign that a machine wrote the text, and stop
 * reading. The 2026-09-26 sweep removed every one from the tracked tree
 * (11,911 of them, in 597 files); this guard keeps them out, because a
 * convention that survives only as prose regresses on the next PR.
 *
 * What is EXEMPT, and why each one is a fact rather than a preference:
 *  - the frozen crate (`tools/snapshot-capture/crate/`): Discogs' own
 *    release text, hashed by the manifest (ADR-0002), not ours to edit;
 *  - the three minted receipts (`workers/front/lab/receipts/`): measurement
 *    records whose text fields are not rendered anywhere, and whose
 *    provenance rules bar editing after the fact;
 *  - the GitHub-anchor evidence (`packages/reference/test/fixtures/
 *    github-heading-anchors.json` and `packages/reference/test/
 *    reference.test.ts`): they pin how GitHub slugs an em-dash heading,
 *    which the how-it-was-built index still has to get right for old links;
 *  - the lockfile and binary files.
 *
 * Non-vacuity: the exempt list is checked to be LIVE (the crate and the
 * anchor fixture must still contain the glyph, otherwise the exemptions
 * are dead entries), and the predicate is proved on a planted string.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const EM_DASH = "\u2014";

const EXEMPT: readonly RegExp[] = [
  /^pnpm-lock\.yaml$/,
  /^tools\/snapshot-capture\/crate\//,
  /^workers\/front\/lab\/receipts\/[^/]+\.json$/,
  /^packages\/reference\/test\/fixtures\/github-heading-anchors\.json$/,
  /^packages\/reference\/test\/reference\.test\.ts$/,
];

/** True when the buffer is text the rule applies to: valid UTF-8 with no NUL. */
export function isText(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  return Buffer.from(buf.toString("utf8"), "utf8").equals(buf);
}

export function offendingLines(text: string): number[] {
  const out: number[] = [];
  text.split("\n").forEach((line, i) => {
    if (line.includes(EM_DASH)) out.push(i + 1);
  });
  return out;
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

describe("no em dashes in reader-facing text (2026-09-26 sweep)", () => {
  it("the predicate is live: a planted glyph is reported at its line", () => {
    expect(offendingLines("one\ntwo \u2014 three\nfour")).toEqual([2]);
    expect(offendingLines("one\ntwo - three\nfour – five")).toEqual([]);
    expect(isText(Buffer.from("plain"))).toBe(true);
    expect(isText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]))).toBe(false);
  });

  it("every tracked text file outside the stated exemptions is free of the glyph", () => {
    const files = trackedFiles();
    // Non-vacuity: this is the repo, not an empty checkout.
    expect(files.length).toBeGreaterThan(500);
    const bad: string[] = [];
    let scanned = 0;
    for (const f of files) {
      if (EXEMPT.some((re) => re.test(f))) continue;
      let buf: Buffer;
      try {
        buf = readFileSync(join(repoRoot, f));
      } catch {
        continue; // a symlink to a directory, or a file removed mid-run
      }
      if (!isText(buf)) continue;
      scanned++;
      const lines = offendingLines(buf.toString("utf8"));
      if (lines.length) bad.push(`${f}:${lines.slice(0, 5).join(",")}${lines.length > 5 ? ",…" : ""}`);
    }
    expect(scanned).toBeGreaterThan(500);
    expect(bad, "em dashes in reader-facing files; use a comma, colon, full stop or parentheses").toEqual([]);
  });

  it("the exemptions are live: the crate and the anchor evidence still carry the glyph", () => {
    const crate = readFileSync(join(repoRoot, "tools/snapshot-capture/crate/details.json"), "utf8");
    const anchors = readFileSync(join(repoRoot, "packages/reference/test/fixtures/github-heading-anchors.json"), "utf8");
    expect(crate.includes(EM_DASH), "the crate no longer needs its exemption; drop it").toBe(true);
    expect(anchors.includes(EM_DASH), "the anchor fixture no longer needs its exemption; drop it").toBe(true);
  });
});
