/**
 * Every deep link the how-it-was-built master renders names a file that
 * exists, every fragment on it names a heading in that file, and every
 * in-page anchor has its id (how-it-was-built build, 2026-09-02; PRD D4/D5).
 *
 * The surface is an INDEX whose whole value is that its links dereference —
 * "a citation that cannot be re-fetched at the state cited is not a
 * citation" (PRD Decision 1). Three ways a link can rot without any other
 * guard noticing: the file is renamed (`docs/adr/0009-blog-plane.md` →
 * something else), a heading is reworded so GitHub's anchor changes (Phase
 * 14's open-ended date is scheduled to), or a TOC `href="#x"` outlives its
 * `id="x"`. The regeneration test pins the INDEX (which ADRs, which phases)
 * but not the links' targets; this does.
 *
 * Offline by construction: a `blob/{ref}/{path}` link is checked by stripping
 * the prefix and testing the path on THIS disk; a `#fragment` is checked by
 * re-deriving GitHub's heading anchors from the named file's own headings —
 * with the ONE anchor rule the renderer exports (a second copy here would
 * only prove that two copies agree; design review, 2026-09-02). Whether that
 * rule matches GitHub is pinned separately, by GitHub-observed golden vectors
 * in packages/reference/test/reference.test.ts.
 *
 * Non-vacuity is asserted before every loop: an empty link list passes every
 * existence check, so the counts are floors, not decoration.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const master = readFileSync(
  join(repoRoot, "packages", "reference", "surfaces", "how-it-was-built", "index.html"),
  "utf8",
);
// ref · path · optional ?query · optional #fragment · the anchor's text.
const BLOB =
  /href="https:\/\/github\.com\/Robert-Lark\/project-matrix\/blob\/([^/"]+)\/([^"#?]+)(\?[^"#]*)?(?:#([^"]*))?"[^>]*>([^<]*)<\/a>/g;
const unescape = (t: string) =>
  t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// Dynamic import by file URL: the renderer is plain-JS build tooling with no
// type surface (the plp-arms-agree pattern for lib.mjs).
const howBuilt = (await import(
  pathToFileURL(
    join(repoRoot, "packages", "reference", "render", "how-built.mjs"),
  ).href
)) as { githubAnchors: (markdown: string) => { level: number; text: string; slug: string }[] };
const githubHeadingAnchors = (markdown: string): string[] =>
  howBuilt.githubAnchors(markdown).map((a) => a.slug);

describe("the how-it-was-built master's links resolve (PRD D4/D5)", () => {
  const links = [...master.matchAll(BLOB)].map((m) => ({
    ref: m[1]!,
    path: m[2]!,
    query: m[3],
    fragment: m[4],
    text: unescape(m[5]!),
  }));

  it("renders a real number of deep links, all pinned to main (the master is the spec artifact)", () => {
    // 9 ADRs + their addenda + 16 phases + the reviews today; the floor is
    // well under that so a docs edit never trips it, and well above zero.
    expect(links.length).toBeGreaterThan(20);
    expect([...new Set(links.map((l) => l.ref))]).toEqual(["main"]);
  });

  it("D4: every blob/{ref}/{path} names a file that exists in this checkout", () => {
    const missing = links.filter((l) => !existsSync(join(repoRoot, l.path))).map((l) => l.path);
    expect(missing, "deep links to files that do not exist — re-run: node render/build.mjs").toEqual([]);
  });

  it("D4: every heading fragment names a heading GitHub renders in that file", () => {
    const withSlug = links.filter((l) => l.fragment !== undefined && !/^L\d+$/.test(l.fragment));
    // The addenda carry heading fragments; the list is long.
    expect(withSlug.length).toBeGreaterThan(10);
    const anchorsByPath = new Map<string, string[]>();
    const bad: string[] = [];
    for (const { path, fragment } of withSlug) {
      // A missing file is the existence leg's finding; do not throw here too.
      if (!existsSync(join(repoRoot, path))) continue;
      if (!anchorsByPath.has(path)) {
        anchorsByPath.set(path, githubHeadingAnchors(readFileSync(join(repoRoot, path), "utf8")));
      }
      if (!anchorsByPath.get(path)!.includes(fragment!)) bad.push(`${path}#${fragment}`);
    }
    expect(bad, "fragments naming no heading in their file — the heading was reworded, or the anchor rule drifted").toEqual([]);
  });

  it("D4: every line anchor names the line that carries exactly the heading the link shows", () => {
    // GitHub's blob view does not render the build log (too large), so phase
    // links open the code view at a line: `?plain=1#L<n>`. Independent of the
    // slug rule entirely — the check reads line n of the file and compares
    // it to the link's own text.
    const withLine = links.filter((l) => l.fragment !== undefined && /^L\d+$/.test(l.fragment));
    expect(withLine.length, "no line-anchored deep links (the phase list)").toBeGreaterThan(10);
    const bad: string[] = [];
    for (const { path, query, fragment, text } of withLine) {
      if (!existsSync(join(repoRoot, path))) continue; // the existence leg's finding
      if (query !== "?plain=1") bad.push(`${path}${query ?? ""}#${fragment}: a line anchor needs ?plain=1 to survive a rendered view`);
      const n = Number(fragment!.slice(1));
      const line = readFileSync(join(repoRoot, path), "utf8").split("\n")[n - 1];
      if (line !== `## ${text}`) bad.push(`${path}?plain=1#L${n} is "${line ?? "<past end of file>"}", link says "## ${text}"`);
    }
    expect(bad, "line anchors that no longer point at their heading — re-run: node render/build.mjs").toEqual([]);
  });

  it("the build log stays inside the size at which GitHub's code view was OBSERVED to honour line anchors", () => {
    // Line anchors were chosen because GitHub's blob view does not render
    // docs/build-log.md as markdown (its page payload carried
    // richText:null, richTextTruncated:true at 403 KB on 2026-09-02). That
    // the CODE view honours `?plain=1#L<n>` at this size was then OBSERVED,
    // not assumed (verify-slice, skeptic lens): a real Chromium opened
    // https://github.com/Robert-Lark/project-matrix/blob/main/docs/build-log.md?plain=1#L886
    // on 2026-09-02 — 6,501 lines available, line 886 present reading
    // "## Phase 3 — Store data", highlighted, no "too large" notice — with
    // the file at 412,355 B. GitHub's code view has its own size behaviour
    // for large files, and this file only grows, so the observation is
    // pinned to a ceiling: when the build log crosses it, re-open one phase
    // link, record the observation beside the one above, and raise the
    // ceiling — or change the anchor form. A guess is not a receipt.
    const OBSERVED_CEILING_BYTES = 512 * 1024;
    const size = statSync(join(repoRoot, "docs", "build-log.md")).size;
    expect(
      size,
      `docs/build-log.md is ${size} B, past the ${OBSERVED_CEILING_BYTES} B at which GitHub's code view was last observed to honour ?plain=1#L<n> — re-observe (open a phase link on the served page) and raise the ceiling with the new date and size, or change the anchor form`,
    ).toBeLessThanOrEqual(OBSERVED_CEILING_BYTES);
  });

  it("D5: every in-page anchor has exactly one matching id", () => {
    const hrefs = [...master.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!);
    const ids = [...master.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length, "the TOC renders no anchors").toBeGreaterThan(10);
    expect(ids.length, "the body renders no ids").toBeGreaterThan(10);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates, "duplicate ids").toEqual([]);
    const orphans = hrefs.filter((h) => !ids.includes(h));
    expect(orphans, "TOC anchors with no matching id").toEqual([]);
  });

  it("every /methodology/#section link names an <h2 id> the methodology page carries", () => {
    const targets = [...master.matchAll(/href="\/methodology\/#([^"]+)"/g)].map((m) => m[1]!);
    expect(targets.length).toBeGreaterThan(5);
    // Attribute-order tolerant, comments stripped — the renderer's own reading
    // (how-built.mjs methodologyHeadings), so a `<h2 class="x" id="y">` counts.
    const page = readFileSync(join(repoRoot, "workers", "front", "methodology", "index.html"), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "");
    const ids = [...page.matchAll(/<h2\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(targets.filter((t) => !ids.includes(t)), "methodology anchors with no <h2 id>").toEqual([]);
  });

  it("the fragment check is live: a reworded heading fails it", () => {
    // The check must not pass because the master's fragments happen to be
    // derived by the same function — feed it a document whose heading has
    // moved and assert the fragment no longer resolves.
    const anchors = githubHeadingAnchors("# Title\n\n## Phase 3 — Store data\n");
    expect(anchors).toContain("phase-3--store-data");
    expect(githubHeadingAnchors("# Title\n\n## Phase 3 — Store data, renamed\n")).not.toContain(
      "phase-3--store-data",
    );
  });
});
