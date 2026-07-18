/**
 * The drift gate at the composed-origin seam (issue #6, ADR-0003 §6): every
 * variant page — fetched exactly as a visitor gets it, chrome injection
 * active — must equal the reference render by normalized DOM and by pixels
 * across the three published profiles. A deliberate-drift fixture proves
 * both checks actually catch drift (and that chrome exclusion can't mask
 * it) before any real variant relies on the gate.
 *
 * The reference render + fixture are served by @pm/drift-gate's repo-root
 * static server (ephemeral port), NOT through the composed origin: they are
 * not variants and get no dispatch prefix. The gate's mechanics are
 * origin-agnostic; composed-origin coverage is exactly what the two real
 * placeholder checks prove. Gate policy/mechanics live in @pm/drift-gate;
 * this file is only the seam assertions.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PROFILES, PROFILE_IDS } from "@pm/measurement";
import {
  captureStablePixels,
  comparePixels,
  extractNormalizedDom,
  firstDomDivergence,
  neutralizeChrome,
  profileContextOptions,
  startRepoServer,
  NO_NOISE,
  PERMITTED_NOISE,
  type StaticServer,
} from "@pm/drift-gate";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const suiteDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(suiteDir, "..", "..", "..");
// Failure evidence lands where CI already uploads artifacts from.
const evidenceDir = join(suiteDir, "..", ".dev-logs", "drift");

const SSR_NOISE = PERMITTED_NOISE["placeholder-ssr"]!;

let browser: Browser;
let statics: StaticServer;
let REFERENCE_URL: string;
let FIXTURE_URL: string;

beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    // Dev machines where TLS interception blocks the Playwright CDN drive
    // the system Chrome instead; CI always installs bundled Chromium.
    browser = await chromium.launch({ channel: "chrome" });
  }
  statics = await startRepoServer(repoRoot);
  REFERENCE_URL = `${statics.origin}/packages/reference/surfaces/sample/`;
  FIXTURE_URL = `${statics.origin}/tools/drift-gate/fixtures/drifted-sample/`;
  mkdirSync(evidenceDir, { recursive: true });
});
afterAll(async () => {
  await browser?.close();
  await statics?.close();
});

/**
 * Open a page and record every network request it makes: rendering must be
 * fully self-hosted (ADR-0003 §8 / ADR-0001 §6) — a fetch to any host but
 * the composed origin or the gate's own static server would mean the pixels
 * depend on bytes the benchmark doesn't control.
 */
async function openTracked(
  context: BrowserContext,
  url: string,
): Promise<Page> {
  const page = await context.newPage();
  const external: string[] = [];
  page.on("request", (req) => {
    if (!req.url().startsWith(ORIGIN) && !req.url().startsWith(statics.origin)) {
      external.push(req.url());
    }
  });
  await page.goto(url, { waitUntil: "load" });
  expect(external, `non-self-hosted requests from ${url}`).toEqual([]);
  return page;
}

function assertDomEqual(label: string, reference: string, actual: string): void {
  if (reference === actual) return;
  writeFileSync(join(evidenceDir, `${label}.expected.txt`), reference);
  writeFileSync(join(evidenceDir, `${label}.actual.txt`), actual);
  throw new Error(
    `normalized DOM drift (${label}) — full extracts in .dev-logs/drift/\n` +
      firstDomDivergence(reference, actual),
  );
}

function assertPixelsEqual(
  label: string,
  reference: Buffer,
  actual: Buffer,
): void {
  const result = comparePixels(reference, actual);
  if (result.equal) return;
  writeFileSync(join(evidenceDir, `${label}.expected.png`), reference);
  writeFileSync(join(evidenceDir, `${label}.actual.png`), actual);
  if (result.diffPng) {
    writeFileSync(join(evidenceDir, `${label}.diff.png`), result.diffPng);
  }
  throw new Error(
    `pixel drift (${label}): ${result.reason}, ` +
      `${result.diffPixels} differing pixels, ` +
      `${result.a.width}×${result.a.height} vs ${result.b.width}×${result.b.height} ` +
      `— screenshots in .dev-logs/drift/`,
  );
}

describe("the gate's own dependencies resolve inside the repo", () => {
  // The airtight form of the workspace-isolation guarantee, owed to this
  // build (tools/repo-checks/test/workspace-isolation.test.ts): Node's
  // walk-up must not let gate verdicts depend on modules outside the repo.
  it("pixelmatch/pngjs/playwright resolve under the repo root", () => {
    const req = createRequire(join(repoRoot, "tools/drift-gate/package.json"));
    for (const dep of ["pixelmatch", "pngjs", "playwright"]) {
      expect(req.resolve(dep).startsWith(repoRoot + "/")).toBe(true);
    }
  });
});

describe("normalized-DOM equivalence (chrome excluded by the normalizer)", () => {
  let domContext: BrowserContext;
  let referenceDom: string;

  beforeAll(async () => {
    domContext = await browser.newContext({ javaScriptEnabled: false });
    const page = await openTracked(domContext, REFERENCE_URL);
    referenceDom = await extractNormalizedDom(page, NO_NOISE);
    await page.close();
  });
  afterAll(async () => {
    await domContext?.close();
  });

  it("reference render vs itself: an independent load extracts identically", async () => {
    const page = await openTracked(domContext, REFERENCE_URL);
    const again = await extractNormalizedDom(page, NO_NOISE);
    assertDomEqual("dom-reference-self", referenceDom, again);
    // The golden master really carries the canonical content, and the
    // extract covers the document element's own attributes (a dropped
    // `lang` is pixel-neutral a11y drift the DOM check must see).
    expect(referenceDom.split("\n")[0]).toBe('<html lang="en">');
    expect(referenceDom).toContain("pm-release-card__title");
    expect(referenceDom).toContain("Kind Of Blue");
    await page.close();
  }, 60_000);

  it("the surface golden master stays pinned to the component demo's canonical markup", async () => {
    // Two copies of the canonical card markup exist by design (the
    // per-component demo and the surface master the gate compares against).
    // This pin makes stale-copy drift impossible: edit one, this fails
    // until the other follows — so the master the gate enforces is always
    // the contract of record (ADR-0003 §6 "it IS the contract").
    const demoPage = await openTracked(
      domContext,
      `${statics.origin}/packages/reference/`,
    );
    const demoGrid = await extractNormalizedDom(demoPage, NO_NOISE, "ul.pm-grid");
    const masterPage = await openTracked(domContext, REFERENCE_URL);
    const masterGrid = await extractNormalizedDom(masterPage, NO_NOISE, "ul.pm-grid");
    expect(demoGrid).not.toBe("");
    assertDomEqual("dom-demo-vs-master-grid", demoGrid, masterGrid);
    await demoPage.close();
    await masterPage.close();
  }, 60_000);

  it("placeholder-static matches the reference through the composed origin", async () => {
    const page = await openTracked(domContext, `${ORIGIN}/placeholder-static/sample/`);
    // Non-vacuity: the chrome IS on this page (injected inside the slot) —
    // the normalizer's exclusion is being exercised, not skipped.
    expect(await page.locator("div#pm-chrome-slot #pm-chrome").count()).toBe(1);
    const dom = await extractNormalizedDom(page, NO_NOISE);
    expect(dom).not.toContain("pm-chrome");
    assertDomEqual("dom-placeholder-static", referenceDom, dom);
    await page.close();
  }, 60_000);

  it("placeholder-ssr matches once its REGISTERED paradigm noise is stripped — non-vacuously", async () => {
    const page = await openTracked(domContext, `${ORIGIN}/placeholder-ssr/sample/`);

    // The served page really carries all three permitted-noise species
    // (hydration marker, scoping hash, comment nodes) — the PRD seams audit
    // requires the stripping proof to be non-vacuous.
    const raw = await page.content();
    expect(raw).toContain('data-ph-hydrate="idle"');
    expect(raw).toContain("ph-x7f3a2");
    expect(raw).toContain("<!-- ph:ssr-boundary -->");

    // Without the variant's registered noise spec the page must NOT match:
    // the normalizer isn't ignoring attributes/classes wholesale.
    const unstripped = await extractNormalizedDom(page, NO_NOISE);
    expect(unstripped).not.toBe(referenceDom);
    expect(unstripped).toContain("data-ph-hydrate");

    const dom = await extractNormalizedDom(page, SSR_NOISE);
    expect(dom).not.toContain("pm-chrome");
    assertDomEqual("dom-placeholder-ssr", referenceDom, dom);
    await page.close();
  }, 60_000);

  it("the deliberate-drift fixture FAILS the DOM check despite chrome exclusion and noise stripping", async () => {
    const page = await openTracked(domContext, FIXTURE_URL);
    // The fixture's POPULATED fake chrome slot is excluded like any other…
    const dom = await extractNormalizedDom(page, SSR_NOISE);
    expect(dom).not.toContain("Fake chrome");
    // …and the drift still fails the check: exclusion cannot mask it.
    expect(dom).not.toBe(referenceDom);
    // The divergence is exactly the planted defect (the alt drift), so the
    // failure is attributable, not incidental.
    expect(firstDomDivergence(referenceDom, dom)).toContain("Album front cover");
    await page.close();
  }, 60_000);
});

describe("the new surface masters are healthy (surface-design session)", () => {
  // The eight fixture-rendered masters (packages/reference/render/build.mjs).
  // No variant comparisons yet — no variant serves these surfaces; each
  // follow-on build adds its own gate leg. What IS proven now:
  //  (a) the DOM normalizer runs clean against each master (self-equivalence
  //      across two independent loads — the existing reference-vs-self
  //      pattern), so the master is deterministic raw material for the gate;
  //  (b) captureStablePixels succeeds under the avg-broadband-desktop
  //      profile: fonts settle, every asset — images through the server's
  //      /assets/img/* fixture alias included — loads, and the full-page
  //      shot stays within sane bounds (an unsized-image dimension explosion
  //      would blow the height).
  const NEW_MASTERS = [
    "editorial",
    "pdp",
    "plp",
    "checkout",
    "a11y",
    "a11y/element-demos",
    "a11y/mode-demos",
    "how-it-was-built",
  ] as const;
  const profile = PROFILES["avg-broadband-desktop"];
  let context: BrowserContext;

  beforeAll(async () => {
    // profileContextOptions is JS-off, like every gate context — one context
    // serves both the DOM and the pixel leg.
    context = await browser.newContext(profileContextOptions(profile));
  });
  afterAll(async () => {
    await context?.close();
  });

  for (const surface of NEW_MASTERS) {
    const url = () =>
      `${statics.origin}/packages/reference/surfaces/${surface}/`;

    it(`${surface}: the normalizer extracts identically across independent loads`, async () => {
      const first = await openTracked(context, url());
      const dom = await extractNormalizedDom(first, NO_NOISE);
      await first.close();
      const second = await openTracked(context, url());
      const again = await extractNormalizedDom(second, NO_NOISE);
      await second.close();
      expect(dom).not.toBe("");
      expect(dom.split("\n")[0]).toBe('<html lang="en">');
      assertDomEqual(`dom-${surface.replaceAll("/", "-")}-self`, dom, again);
    }, 60_000);

    it(`${surface}: pixels stabilize — fonts settle, assets load through the /assets/img alias`, async () => {
      const page = await openTracked(context, url());
      // Every same-origin response must succeed: a 404 under the image
      // alias would render a broken page whose pixels still "stabilize".
      const failures: string[] = [];
      page.on("response", (res) => {
        if (res.url().startsWith(statics.origin) && res.status() >= 400) {
          failures.push(`${res.status()} ${res.url()}`);
        }
      });
      await page.reload({ waitUntil: "load" });
      expect(failures, `failed asset loads on ${surface}`).toEqual([]);

      const shot = await captureStablePixels(page);
      // PNG IHDR: width/height at byte offsets 16/20. Sized-from-data image
      // slots mean layout cannot explode — a runaway full-page height is a
      // broken master, not a long page.
      const width = shot.readUInt32BE(16);
      const height = shot.readUInt32BE(20);
      expect(width).toBe(
        profile.viewport.width * profile.viewport.deviceScaleFactor,
      );
      expect(height).toBeGreaterThan(0);
      expect(height, `${surface} rendered ${height}px tall`).toBeLessThan(
        16_000,
      );
      await page.close();
    }, 90_000);
  }
});

describe.each(PROFILE_IDS)("pixel diff — profile %s", (profileId) => {
  const profile = PROFILES[profileId];
  let context: BrowserContext;
  let referenceShot: Buffer;

  beforeAll(async () => {
    context = await browser.newContext(profileContextOptions(profile));
    const page = await openTracked(context, REFERENCE_URL);
    // The reference render has no chrome slot — part of the contract.
    expect(await neutralizeChrome(page)).toBe(0);
    referenceShot = await captureStablePixels(page);
    await page.close();
  }, 90_000);
  afterAll(async () => {
    await context?.close();
  });

  it("reference render vs itself: an independent load renders identically", async () => {
    const page = await openTracked(context, REFERENCE_URL);
    await neutralizeChrome(page);
    const shot = await captureStablePixels(page);
    assertPixelsEqual(`pixels-${profileId}-reference-self`, referenceShot, shot);
    await page.close();
  }, 90_000);

  for (const variant of ["placeholder-static", "placeholder-ssr"] as const) {
    it(`${variant} matches the reference once the injected chrome is REMOVED`, async () => {
      const page = await openTracked(context, `${ORIGIN}/${variant}/sample/`);
      // Removal (not region-masking): the chrome is in normal document
      // flow — exactly one slot removed, page reflows to reference layout.
      expect(await neutralizeChrome(page)).toBe(1);
      const shot = await captureStablePixels(page);
      assertPixelsEqual(`pixels-${profileId}-${variant}`, referenceShot, shot);
      await page.close();
    }, 90_000);
  }
});

describe("the deliberate-drift fixture fails the pixel check", () => {
  // One profile suffices: the fixture proves the CHECK catches re-valued
  // pixels; profile coverage is proven by the passing matrix above.
  const profile = PROFILES["avg-broadband-desktop"];

  it("token re-valuation drifts pixels even though its fake chrome was excluded", async () => {
    const context = await browser.newContext(profileContextOptions(profile));
    const refPage = await openTracked(context, REFERENCE_URL);
    await neutralizeChrome(refPage);
    const referenceShot = await captureStablePixels(refPage);
    await refPage.close();

    const page = await openTracked(context, FIXTURE_URL);
    // The fixture's fake chrome exists and is removed — so the failure
    // below is the planted drift, not leftover chrome bytes.
    expect(await neutralizeChrome(page)).toBe(1);
    const shot = await captureStablePixels(page);
    const result = comparePixels(referenceShot, shot);
    expect(result.equal).toBe(false);
    expect(result.diffPixels).toBeGreaterThan(0);
    await page.close();
    await context.close();
  }, 90_000);
});
