/**
 * The publication gate's refusals, each proven by a committed malformed
 * fixture (workers-hardening, 2026-09-25; 2026-08-29 audit priority 5, task
 * 2). Until this file the gate was enforced only by the one-time sabotage
 * proofs the decision map records — fourteen of them, none re-run — and
 * the repo had already met the failure class once: a guard was REMOVED
 * because "an unfireable guard advertises coverage it lacks". A refactor
 * that inverts one condition used to ship silently; now its fixture fails.
 *
 * The fixtures are GENERATED from one valid receipt by a table with one row
 * per refusal class (fixtures/publish/generate.mjs) — the row is the
 * mutation AND the message it must produce — and the committed files are
 * held byte-identical to that table's output, so a fixture cannot be edited
 * by hand into something the table does not describe.
 *
 * NON-VACUITY, three ways, because a refusal suite that passes over an
 * empty fixture list is the exact anti-pattern it exists to kill:
 *  - the table is not empty, and every file on disk is one of its rows
 *    (a row deleted from the table with its file left behind, or the
 *    reverse, is a failure — the set equality is asserted both ways);
 *  - every `throw new Error(` in lab/publish.mjs carries a `// refusal:
 *    <site>` marker and the marker set equals the rows' `site` set in BOTH
 *    directions (read from the module's source, never typed here) — a map,
 *    not a count: a new throw without its row, a row without its throw, or
 *    a label reused for a throw it does not sit on all go red (verify-slice,
 *    skeptic lens: the first draft counted labels, and 19 of 29
 *    condition-level mutants passed it);
 *  - CONTROL rows that must PASS: the valid fixtures admit and publish a
 *    sentence with bands, and the three receipts the plane actually
 *    publishes admit through the same call build.mjs makes.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROFILES, getProfile } from "@pm/measurement";
import { SURFACE_CONTROLS, chromeFragmentOf, fencedPathOf, renderChrome } from "@pm/switcher";
import { FIT } from "../lab/fit.mjs";
import {
  admitChromeConstant,
  admitReceipt,
  assertBatchIntegrity,
  bundleFromReceipt,
  labSurfacesOf,
} from "../lab/publish.mjs";
import { CASES, CC_CONTEXT, SURFACE, fixtureFragment, fixtures } from "./fixtures/publish/generate.mjs";

const here = import.meta.dirname;
const fixtureDir = join(here, "fixtures", "publish");
const read = (rel) => JSON.parse(readFileSync(join(fixtureDir, rel), "utf8"));
const sha256Hex = (text) => createHash("sha256").update(text).digest("hex");

/** The real gate configuration — the same objects build.mjs hands in. */
const LAB_SURFACES = labSurfacesOf(SURFACE_CONTROLS);
const realDeps = { labSurfaces: LAB_SURFACES, surfaceControls: SURFACE_CONTROLS, fit: FIT, fencedPathOf };
const VALID_FILE = `${SURFACE}-avg-broadband-desktop.json`;

/** The chrome-constant gate's runtime services, stood in by the fixture's
 *  own fragment function (the identity gate is proven against a KNOWN
 *  fragment, so a mismatch is a real mismatch). */
const ccDeps = {
  labBundles: { [SURFACE]: { "avg-broadband-desktop": { columns: {} } } },
  renderChrome: fixtureFragment,
  chromeFragmentOf: (html) => html,
  getProfile,
  defaultProfile: PROFILES["avg-broadband-desktop"],
  sha256Hex,
  byteLength: (text) => Buffer.byteLength(text, "utf8"),
};

describe("non-vacuity: the table, the files and the module agree", () => {
  it("the table is not empty and names every kind of refusal the gate has", () => {
    expect(CASES.length).toBeGreaterThan(0);
    expect(new Set(CASES.map((c) => c.kind))).toEqual(
      new Set(["receipt", "batch", "chrome-constant", "fit", "registry"]),
    );
    expect(new Set(CASES.map((c) => c.id)).size, "duplicate row ids").toBe(CASES.length);
  });

  it("every fixture on disk is a row (or a control), and every row that needs a file has one", () => {
    const onDisk = new Set(
      ["receipts", "chrome-constants"].flatMap((dir) =>
        readdirSync(join(fixtureDir, dir)).map((f) => `${dir}/${f}`),
      ),
    );
    const expected = new Set(fixtures().keys());
    expect([...onDisk].sort()).toEqual([...expected].sort());
    for (const c of CASES) {
      if (c.kind === "receipt" || c.kind === "batch") expect(onDisk.has(`receipts/${c.id}.json`), c.id).toBe(true);
      if (c.kind === "chrome-constant") expect(onDisk.has(`chrome-constants/${c.id}.json`), c.id).toBe(true);
    }
  });

  it("the committed fixtures are byte-identical to what generate.mjs produces (re-run: node workers/front/test/fixtures/publish/generate.mjs)", () => {
    for (const [rel, body] of fixtures()) {
      expect(readFileSync(join(fixtureDir, rel), "utf8"), rel).toBe(body);
    }
  });

  it("every throw site in lab/publish.mjs carries a `// refusal: <site>` marker, and the marker set IS the rows' site set — a map, not a count", () => {
    const source = readFileSync(join(here, "..", "lab", "publish.mjs"), "utf8");
    const throwSites = (source.match(/throw new Error\(/g) ?? []).length;
    const markers = [...source.matchAll(/\/\/ refusal: ([\w-]+)\n\s*throw new Error\(/g)].map((m) => m[1]);
    expect(throwSites).toBeGreaterThan(0);
    expect(markers.length, "a throw with no `// refusal:` marker on the line above it").toBe(throwSites);
    expect(new Set(markers).size, "two throws share one marker").toBe(markers.length);
    const sites = [...new Set(CASES.map((c) => c.site).filter((s) => s !== null))].sort();
    expect(sites, "rows name a site no throw carries, or a throw's site has no row").toEqual([...markers].sort());
  });
});

describe("CONTROL — what must pass", () => {
  it("the valid fixture admits under the real registry and publishes a sentence with bands", () => {
    const { surface, bundle } = admitReceipt(VALID_FILE, read("receipts/valid.json"), realDeps);
    expect(surface).toBe(SURFACE);
    expect(bundle.bandsOverlap).toBeUndefined();
    expect(bundle.fit?.sentence).toMatch(/switching the gallery image costs every paradigm the same 24\.6 KB/);
    expect(bundle.interactionFetch).toEqual({ bytes: 25194, toleranceBytes: 64 });
    expect(bundle.interactionTiming).toEqual({ published: false, reason: FIT.pdp.interactionTiming.reason });
    expect(Object.keys(bundle.columns).sort()).toEqual([...SURFACE_CONTROLS.pdp.variants].sort());
    // Bands are derived from the three runs, and the withheld INP row is
    // absent from the artifact, not hidden.
    expect(bundle.columns.vanilla["initial JS"]).toMatchObject({ value: 1.96, unit: "KB", band: { min: 1.95, max: 1.97 } });
    expect(bundle.columns.vanilla["INP (scripted)"]).toBeUndefined();
  });

  it("the second-profile control admits, and the pair passes batch integrity", () => {
    const second = read("receipts/valid-second-profile.json");
    expect(() => admitReceipt(`${SURFACE}-slow-4g-mid-phone.json`, second, realDeps)).not.toThrow();
    expect(() => assertBatchIntegrity(SURFACE, [read("receipts/valid.json"), second])).not.toThrow();
  });

  it("the valid chrome constant admits against the fixture fragment", () => {
    expect(() => admitChromeConstant(read("chrome-constants/valid.json"), ccDeps)).not.toThrow();
  });

  /** The plane's committed receipts, admitted — and their bundles in the
   *  shape build.mjs writes and the Worker serves ({surface, profile, ...}). */
  const realPublication = () => {
    const receiptsDir = join(here, "..", "lab", "receipts");
    const files = readdirSync(receiptsDir).filter((f) => f.endsWith(".json"));
    const bySurface = {};
    const labBundles = {};
    for (const file of files) {
      const receipt = JSON.parse(readFileSync(join(receiptsDir, file), "utf8"));
      const { surface, bundle } = admitReceipt(file, receipt, realDeps);
      (bySurface[surface] ??= []).push(receipt);
      (labBundles[surface] ??= {})[receipt.profile.id] = { surface, profile: receipt.profile.id, ...bundle };
    }
    return { files, bySurface, labBundles };
  };

  it("the plane's own committed receipts admit through the same call build.mjs makes", () => {
    const { files, bySurface, labBundles } = realPublication();
    expect(files.length).toBeGreaterThan(0);
    for (const surface of Object.keys(bySurface)) {
      for (const bundle of Object.values(labBundles[surface])) expect(bundle.fit?.sentence, surface).toBeTruthy();
      expect(() => assertBatchIntegrity(surface, bySurface[surface])).not.toThrow();
    }
  });

  it("CONTROL: a chrome constant minted from the REAL renderer over the plane's own bundles admits with build.mjs's deps — and a fragment the build does not ship is refused", () => {
    // No lab/chrome-constant.json is committed today (removed by #35 on
    // 2026-08-28), so nothing else runs admitChromeConstant against the real
    // renderChrome/chromeFragmentOf; the fixture rows use a stand-in
    // (verify-slice, skeptic lens). This is the identity gate on the real
    // thing: the same deps shape build.mjs wires, the bundles the receipts
    // above produced, a constant hashed from what that renderer ships.
    const { labBundles } = realPublication();
    const deps = {
      labBundles,
      renderChrome,
      chromeFragmentOf,
      getProfile,
      defaultProfile: PROFILES["avg-broadband-desktop"],
      sha256Hex,
      byteLength: (text) => Buffer.byteLength(text, "utf8"),
    };
    const rc = { variant: "vanilla", surface: "editorial", pathname: "/vanilla/editorial/", search: "", location: "local" };
    const lab = labBundles.editorial?.["avg-broadband-desktop"];
    expect(lab, "the editorial publication is what the plane serves today").toBeDefined();
    const fragment = chromeFragmentOf(renderChrome({ ...rc, lab }));
    const constant = (renderContext) => ({
      kind: "pm-chrome-constant",
      commit: { sha: "c".repeat(40), dirty: false },
      originCommit: { sha: "c".repeat(40), dirty: false },
      deltaMedians: { FCP: 76, LCP: 76, CLS: 0, longTaskMs: 0 },
      measuredChrome: { populated: true, sha256: sha256Hex(fragment), bytes: Buffer.byteLength(fragment, "utf8"), renderContext },
    });
    expect(() => admitChromeConstant(constant(rc), deps)).not.toThrow();
    // The populated fragment is larger than the empty one, and a constant
    // hashed from the populated one is refused for a context with no bundle.
    const empty = chromeFragmentOf(renderChrome({ ...rc, surface: "pdp", pathname: "/vanilla/pdp/x/", lab: undefined }));
    expect(fragment.length).toBeGreaterThan(empty.length);
    expect(() => admitChromeConstant(constant({ ...rc, surface: "pdp", pathname: "/vanilla/pdp/x/" }), deps)).toThrow(/describes a fragment this build does not ship/);
  });

  it("CONTROL: an upper-case content-coding token is the same wire (RFC 9110 §8.4.1) — a legitimate \"ZSTD\" admits", () => {
    const receipt = read("receipts/valid.json");
    receipt.targets[1].columns.warm.runs[0].kb.docAttribution.contentEncoding = "ZSTD";
    expect(() => admitReceipt(VALID_FILE, receipt, realDeps)).not.toThrow();
  });

  it("build.mjs still calls every gate function — the composer cannot bypass the gate", () => {
    // The fixtures prove the GATE; nothing above proves the BUILD still
    // runs it. A composer that dropped one call would publish everything and
    // pass every row (sabotage row A11, 2026-09-25). Lexical, like the
    // pdp-controls-wired state leg, and stated as such: it asks whether
    // build.mjs names each function as a call, not whether the call is on
    // the path — the dist byte-identity check at refactor time was the
    // one-time proof of the path, and this holds the names.
    const build = readFileSync(join(here, "..", "build.mjs"), "utf8");
    for (const fn of ["labSurfacesOf", "admitReceipt", "assertBatchIntegrity", "admitChromeConstant"]) {
      expect(build, `build.mjs no longer calls ${fn}(`).toMatch(new RegExp(`\\b${fn}\\(`));
    }
    expect(build).not.toMatch(/function bundleFromReceipt/);
  });

  it("the real registry passes labSurfacesOf and the real renderer is what the chrome-constant gate would run", () => {
    expect(LAB_SURFACES).toContain(SURFACE);
    // The stand-in renderer above is the FIXTURE's; the real one is wired by
    // build.mjs. Prove the real one at least renders the context the
    // fixture records, so the gate is not proven against a renderer that
    // could never run.
    const html = renderChrome({ ...CC_CONTEXT, lab: undefined });
    expect(chromeFragmentOf(html).length).toBeGreaterThan(0);
  });
});

describe("every refusal class throws with its own message", () => {
  for (const c of CASES) {
    if (c.outcome) continue;
    it(`${c.kind}: ${c.id}`, () => {
      const run = () => {
        if (c.kind === "receipt") {
          return admitReceipt(c.admitAs ?? VALID_FILE, read(`receipts/${c.id}.json`), realDeps);
        }
        if (c.kind === "fit") {
          const fit = { ...FIT };
          const spec = c.fit(FIT.pdp);
          if (spec === undefined) delete fit.pdp;
          else fit.pdp = spec;
          return admitReceipt(VALID_FILE, read("receipts/valid.json"), { ...realDeps, fit });
        }
        if (c.kind === "batch") {
          return assertBatchIntegrity(SURFACE, [read("receipts/valid.json"), read(`receipts/${c.id}.json`)]);
        }
        if (c.kind === "chrome-constant") {
          return admitChromeConstant(read(`chrome-constants/${c.id}.json`), ccDeps);
        }
        if (c.kind === "registry") return labSurfacesOf(c.registry);
        throw new Error(`unknown case kind ${c.kind}`);
      };
      expect(run).toThrow(c.expect);
    });
  }

  const overlapRows = CASES.filter((x) => x.outcome === "bandsOverlap");
  it("there are band-rule outcome rows (overlapping AND touching bands)", () => {
    expect(overlapRows.map((c) => c.id).sort()).toEqual(["band-overlap", "band-touching"]);
  });
  for (const c of overlapRows) {
    it(`the band rule refuses the SENTENCE, not the bundle (${c.id}): bandsOverlap rides the artifact and no fit is published`, () => {
      const { bundle } = admitReceipt(VALID_FILE, read(`receipts/${c.id}.json`), realDeps);
      expect(bundle.bandsOverlap).toBe(true);
      expect(bundle.fit).toBeUndefined();
      // The interaction figure still travels on the bundle (the addendum-R
      // fix): the overlap rule is about a RANKING, and a constant is not one.
      expect(bundle.interactionFetch).toEqual({ bytes: 25194, toleranceBytes: 64 });
    });
  }

  it("bundleFromReceipt is reachable on its own with the registry's variant list (the composer's call shape)", () => {
    const bundle = bundleFromReceipt(read("receipts/valid.json"), FIT.pdp, "/_pm/lab/receipts/x.json", SURFACE_CONTROLS.pdp.variants);
    expect(bundle.fit?.receipt.url).toBe("/_pm/lab/receipts/x.json");
  });
});
