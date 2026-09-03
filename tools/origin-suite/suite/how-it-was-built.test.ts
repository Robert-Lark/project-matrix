/**
 * /how-it-was-built/ at the composed-origin seam (ADR-0008 §8; the PRD at
 * docs/prds/how-it-was-built-build.md, duties D2, D7, D9). Plain HTTP,
 * outside-in, no Worker internals.
 *
 *  - D7: the URL SERVES — 200, the doc root, no injected chrome, no in-page
 *    HUD, zero script. Before this build every store page's footer linked
 *    this URL and the front Worker answered `not found` (probed 2026-09-02).
 *  - D2: the served body is BYTE-IDENTICAL to a fresh `renderHowBuilt` at the
 *    attestation the plane serves — the same function renders the committed
 *    master, so this is the tie between the served page and the spec that no
 *    variant comparison could give a hostless singleton. Exact equality, not
 *    the normalizer: there is no paradigm noise to tolerate here, and a
 *    weaker compare would hide the drift it exists to catch.
 *  - D9: every deep link pins the attested SHA, or falls back to `main` with
 *    the page saying the tree was unclean — BOTH directions asserted in one
 *    leg, the published-readings pattern (`:442-473`), so neither state can
 *    pass by never being exercised: the branch the plane is in is asserted
 *    positively and the other branch's text is asserted absent.
 *  - The links resolve: every `blob/{ref}/{path}` names a file in this
 *    checkout and every `/methodology/#id` names a section the served
 *    methodology page carries; every served variant's editorial footer links
 *    the URL and the URL answers.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { firstDomDivergence } from "@pm/drift-gate";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const get = (path: string) => fetch(`${ORIGIN}${path}`);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// The remote convention the rest of the suite uses for "this is the deployed
// plane" (composed-origin.test.ts, bench.browser.test.ts).
const REMOTE = process.env.PM_EXPECT_BROTLI === "1";

type Build = { kind: string; sha: string; dirty: boolean };
const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function servedBuild(): Promise<Build> {
  const res = await get("/_pm/build.json");
  expect(res.status).toBe(200);
  const build = (await res.json()) as Build;
  expect(build.kind).toBe("pm-build");
  expect(build.sha).toMatch(/^[0-9a-f]{40}$/);
  expect(typeof build.dirty).toBe("boolean");
  return build;
}

/** The <body> inner — the part both heads share. Anchored on `</head>`: the
 *  served head inlines @pm/tokens' sheets verbatim, and shell.css's skeleton
 *  comment contains a literal `<body>` (the first sabotage run matched it —
 *  and the comment's `<div id="pm-chrome-slot">` with it). */
function bodyOf(html: string): string {
  const m = html.match(/<\/head>\s*<body>([\s\S]*)<\/body>\s*<\/html>\s*$/);
  expect(m, "no </head><body>…</body></html> in the document").not.toBeNull();
  return m![1]!;
}

// ref · path · optional ?query · optional #fragment · the anchor's text.
const DEEP_LINK =
  /href="https:\/\/github\.com\/Robert-Lark\/project-matrix\/blob\/([^/"]+)\/([^"#?]+)(\?[^"#]*)?(?:#([^"]*))?"[^>]*>([^<]*)<\/a>/g;
const unescape = (t: string) =>
  t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

describe("/how-it-was-built/ — the decision record as a served surface (ADR-0008 §8)", () => {
  it("D7: serves 200 with the doc root, chrome-free, HUD-free, script-free", async () => {
    const res = await get("/how-it-was-built/");
    // Status FIRST: a 404 body is a string too, and every `not.toContain`
    // below would pass over it.
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");
    const body = await res.text();
    expect(body).toContain('class="pm-doc"');
    expect(body).toContain('id="decision-records"');
    // Current-state pins, mirroring /methodology/'s leg: no injected chrome
    // (assets-first never reaches the Worker script) and no chrome slot for
    // it to fill; no in-page HUD either (PRD Decision 3 — this surface
    // publishes no number for a HUD to sit beside).
    expect(body).not.toContain("data-pm-chrome");
    expect(body).not.toContain('id="pm-chrome"');
    expect(body).not.toMatch(/<script/i);
    // The slot is asserted on the BODY markup: the head inlines the real
    // @pm/tokens sheets verbatim, and surfaces/shell.css's own skeleton
    // comment names `<div id="pm-chrome-slot">` as the thing variants carry
    // and masters do not — a comment, not a slot.
    const markup = bodyOf(body);
    expect(markup).not.toContain("pm-chrome-slot");
    // The head inlines CSS (the home delivery shape); the body carries none.
    expect(markup).not.toMatch(/<style[\s>]/i);
    expect(markup).not.toMatch(/\son[a-z]+="/i);
  });

  it("D2: the served body is byte-identical to a fresh render at the served attestation", async () => {
    const build = await servedBuild();
    // The expected body is rendered from THIS checkout's docs, so the leg
    // needs the checkout the plane was built from — otherwise a plane built
    // from another commit reads as composition drift, with a message that
    // blames the wrong thing (verify-slice, correctness + seams lenses). The
    // bench runner refuses a cross-tree plane the same way; refuse here too,
    // by name, rather than skip (a skip is the vacuous pass the PRD forbids).
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    expect(
      build.sha === head,
      `D2 renders its expected body from this checkout's docs, so it needs the checkout the plane was built from: the plane attests ${build.sha.slice(0, 7)}, this checkout is ${head.slice(0, 7)} — run against run-local, or check out the attested commit`,
    ).toBe(true);
    const res = await get("/how-it-was-built/");
    expect(res.status).toBe(200);
    const served = bodyOf(await res.text());

    // Dynamic import by file URL: the renderer is plain-JS build tooling with
    // no type surface (the drift gate's own pattern for re-rendering masters).
    const howBuilt = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "how-built.mjs")).href
    );
    const expected = bodyOf(
      howBuilt.renderHowBuilt({ build: { sha: build.sha, dirty: build.dirty } }) as string,
    );

    // Non-vacuity: an empty-vs-empty match is the vacuous pass here.
    expect(expected.length).toBeGreaterThan(1000);
    expect(expected).toContain('class="pm-doc"');
    expect(expected.trimStart().startsWith('<a class="pm-skip')).toBe(true);

    expect(
      served === expected,
      `${firstDomDivergence(expected, served, 2) ?? ""}\n(both sides at ${build.sha.slice(0, 7)}; a docs edit made after the plane was built also produces this — rebuild the plane and re-run)`,
    ).toBe(true);
  });

  it("D9: deep links pin the attested SHA, or fall back to main and say the tree was unclean — both directions", async () => {
    const build = await servedBuild();
    const body = await (await get("/how-it-was-built/")).text();
    const refs = [...new Set([...body.matchAll(DEEP_LINK)].map((m) => m[1]!))];
    expect([...body.matchAll(DEEP_LINK)].length, "the page renders no deep links").toBeGreaterThan(20);
    expect(refs, "every deep link on the page must pin the same ref").toHaveLength(1);

    // A DEPLOYED plane must be in the clean arm: a deploy-job step that left
    // one unignored file behind would make stampBuild record dirty:true and
    // ship every deep link on main with the unclean line, and a leg that
    // accepts either arm would pass it (verify-slice, seams + skeptic
    // lenses). Local planes legitimately run dirty; the remote never may.
    if (REMOTE) {
      expect(build.dirty, "a deployed plane must attest a clean tree — otherwise this page ships the main fallback as its receipt").toBe(false);
    }
    const PINNED = "is pinned to commit";
    const UNCLEAN = "uncommitted changes";
    // The head's description is derived from the same attestation (it is
    // exempt from D2's body compare, so it is pinned here, in both arms).
    const DESCRIBED_PINNED = "each link pinned to the commit this page was built from";
    const DESCRIBED_MAIN = "because the tree was unclean when this page was built";
    if (build.dirty) {
      expect(refs[0]).toBe("main");
      expect(body).toContain(UNCLEAN);
      expect(body).toContain(DESCRIBED_MAIN);
      expect(body).not.toContain(PINNED);
      expect(body).not.toContain(DESCRIBED_PINNED);
      expect(body).not.toContain(build.sha);
    } else {
      expect(refs[0]).toBe(build.sha);
      expect(body).toContain(PINNED);
      expect(body).toContain(DESCRIBED_PINNED);
      expect(body).toContain(`>${build.sha.slice(0, 7)}</a>`);
      expect(body).toContain(`/commit/${build.sha}"`);
      expect(body).not.toContain(UNCLEAN);
      expect(body).not.toContain(DESCRIBED_MAIN);
      expect(body).not.toContain("/blob/main/");
    }
  });

  it("every deep link names a file in this checkout, and every methodology anchor a served section", async () => {
    const body = await (await get("/how-it-was-built/")).text();
    const links = [...body.matchAll(DEEP_LINK)].map((m) => ({
      path: m[2]!,
      query: m[3],
      fragment: m[4],
      text: unescape(m[5]!),
    }));
    expect(links.length).toBeGreaterThan(20);
    const missing = links.map((l) => l.path).filter((p) => !existsSync(join(repoRoot, p)));
    expect(missing, "deep links to files this checkout does not have").toEqual([]);

    // Heading fragments (the addenda): re-derived from the named file's
    // headings with the renderer's anchor rule, which reference.test.ts pins
    // to anchors GitHub rendered. Line anchors (the phases — GitHub does not
    // render the build log): line n of the file must BE the heading shown.
    const howBuilt = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "how-built.mjs")).href
    );
    const { readFileSync } = await import("node:fs");
    const withSlug = links.filter((l) => l.fragment !== undefined && !/^L\d+$/.test(l.fragment));
    const withLine = links.filter((l) => l.fragment !== undefined && /^L\d+$/.test(l.fragment));
    expect(withSlug.length).toBeGreaterThan(10);
    expect(withLine.length).toBeGreaterThan(10);
    const badSlug = withSlug.filter(
      (l) =>
        !(howBuilt.githubAnchors(readFileSync(join(repoRoot, l.path), "utf8")) as { slug: string }[])
          .some((a) => a.slug === l.fragment),
    );
    expect(badSlug.map((l) => `${l.path}#${l.fragment}`), "fragments naming no heading").toEqual([]);
    const badLine = withLine.filter((l) => {
      const line = readFileSync(join(repoRoot, l.path), "utf8").split("\n")[Number(l.fragment!.slice(1)) - 1];
      return l.query !== "?plain=1" || line !== `## ${l.text}`;
    });
    expect(badLine.map((l) => `${l.path}${l.query ?? ""}#${l.fragment}`), "line anchors not at their heading").toEqual([]);

    const sections = [...body.matchAll(/href="\/methodology\/#([^"]+)"/g)].map((m) => m[1]!);
    expect(sections.length).toBeGreaterThan(5);
    const methodology = await get("/methodology/");
    expect(methodology.status).toBe(200);
    const served = await methodology.text();
    const orphans = sections.filter(
      (id) => !new RegExp(`<h2\\b[^>]*\\bid="${escapeRegExp(id)}"`).test(served),
    );
    expect(orphans, "methodology anchors the served page does not carry").toEqual([]);
  });

  it("the footer link on every served variant's editorial page resolves (the 2,006-page 404, closed)", async () => {
    const variants = ["vanilla", "react-next", "astro", "qwik", "htmx", "remix3"];
    for (const variant of variants) {
      const res = await get(`/${variant}/editorial/`);
      expect(res.status, `/${variant}/editorial/`).toBe(200);
      expect(await res.text(), `/${variant}/editorial/ footer`).toContain('href="/how-it-was-built/"');
    }
    const target = await get("/how-it-was-built/");
    expect(target.status).toBe(200);
  });

  it("home's PM-006 row links the served surface on THIS origin, not a GitHub document", async () => {
    // ADR-0007 §4 shipped the row "Public today, linking the build log" as
    // the day-one means of showing a live token, and says rows update as
    // surfaces land. The composed-origin leg holds every OTHER live row to a
    // same-origin href but skips the singletons, so this row was the one
    // live row nothing pinned (design review, 2026-09-02). Sabotage: point
    // the href back at the build log on GitHub; this names the row.
    const home = await (await get("/")).text();
    // Split into rows first: a lazy match from the FIRST row's opening tag
    // would run through PM-001's status before reaching this row's name.
    const rows = home.split('<li class="cat__row').slice(1);
    expect(rows.length, "home renders no catalogue rows").toBeGreaterThan(5);
    const row = rows.find((r) => r.includes(">How it was built<"));
    expect(row, "home renders no How-it-was-built catalogue row").toBeDefined();
    const status = row!.match(/<p class="cat__status">([\s\S]*?)<\/p>/)?.[1] ?? "";
    expect(status, "PM-006 status").toContain("Public today");
    expect(status, "PM-006 must link the served surface").toContain('href="/how-it-was-built/"');
    expect(status, "PM-006 must not send the visitor off-origin for a page this origin serves").not.toContain("github.com");
  });
});
