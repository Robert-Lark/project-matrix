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
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PROFILES, PROFILE_IDS } from "@pm/measurement";
import { loadServedSnapshot, snapshotNameFor } from "./snapshot";
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
const REACT_NEXT_NOISE = PERMITTED_NOISE["react-next"]!;
const QWIK_NOISE = PERMITTED_NOISE["qwik"]!;

let browser: Browser;
let statics: StaticServer;
let REFERENCE_URL: string;
let FIXTURE_URL: string;
// The editorial master re-rendered from the RESOLVED snapshot (ADR-0008 §9)
// — shared by every variant's editorial comparison below (vanilla,
// react-next, ...): the re-render is a pure function of the snapshot, not
// of which variant is under test.
let masterDomUrl: string;
let masterPixelUrl: string;

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

beforeAll(async () => {
  // The gate's first REAL variant comparison (editorial-build slice A) and
  // the deployed-smoke re-render leg are one snapshot-aware mechanism: the
  // editorial master is re-rendered IN-PROCESS from whatever snapshot
  // /api/snapshot says the origin serves — the fixture in CI (proving
  // fixture-equivalence, exactly what the committed master pins) and the
  // crate on the deployed plane (proving the plane serves the crate
  // correctly, which the committed fixture-rendered master cannot). Two
  // flavors of the re-render:
  //  - DOM leg: image srcs stay tray-verbatim (/assets/img/* — attribute
  //    values are contract, and the served variant page carries the same);
  //  - pixel leg: image srcs point at the origin under test, because the
  //    crate's image bytes are deliberately not in git — the plane serves
  //    them (the fixture case exercises the same path through local R2).
  const rerenderRoot = join(
    repoRoot,
    "packages",
    "reference",
    ".local",
    "origin-suite-rerender",
  );
  const snap = await loadServedSnapshot();
  const name = snapshotNameFor(snap.root);
  // Dynamic import by file URL: the renderer is plain-JS build tooling
  // with a main-module-guarded CLI — importing renders and writes nothing
  // (the @pm/reference regeneration test's own pattern).
  const lib = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
  );
  const editorial = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
  );
  const snapshot = lib.loadSnapshot(name);
  // extraDepth 2: these files sit four directories below packages/reference
  // (.local/origin-suite-rerender/{flavor}/editorial/), so the head's
  // relative @pm/tokens links resolve through the package's node_modules
  // symlink on the gate's repo-root static server.
  for (const [flavor, origin] of [
    ["dom", ""],
    ["pixels", ORIGIN],
  ] as const) {
    const html = editorial.renderEditorial(snapshot, { origin, extraDepth: 2 });
    const dir = join(rerenderRoot, flavor, "editorial");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
  }
  const base = `${statics.origin}/packages/reference/.local/origin-suite-rerender`;
  masterDomUrl = `${base}/dom/editorial/`;
  masterPixelUrl = `${base}/pixels/editorial/`;
});

/**
 * Settle every image before a pixel shot. In the gate's JS-off contexts
 * the editorial figure's `loading="lazy"` never actually defers — the
 * HTML spec runs lazy loading only when scripting is enabled — so the
 * scroll is defensive (a JS-on reuse of this helper would need it), and
 * the real work is the settle + the broken-load check: every `<img>`
 * complete with `naturalWidth > 0`. A master-side 404 must read as a
 * harness failure, never as pixel "drift".
 *
 * `complete` is NOT sufficient on its own, and that gap cost a red deploy on
 * main (slice D's merge). It means "the bytes arrived"; the editorial figure
 * carries `decoding="async"`, which explicitly permits the browser to paint the
 * element BEFORE the frame is decoded. Nothing else in the pre-shot pipeline
 * closes that window either — `captureStablePixels` waits for FONTS and then
 * screenshots. So on a busy runner the shot can catch a decoded-too-late image
 * as a blank box: the failure was 421,656 differing pixels at identical
 * dimensions, and the CI screenshots showed every glyph matching with exactly
 * one image — the `decoding="async"` figure — empty on the served side.
 *
 * `img.decode()` is the real signal: it resolves when the frame is decoded and
 * ready to paint, and rejects if the image cannot be decoded at all. Measured
 * against the deployed plane, decode still needed 1.3–2.3 ms per image AFTER
 * `complete` went true on a fast workstation — small here, unbounded on a
 * loaded two-core runner, and entirely inside the window a screenshot can land
 * in. Waiting for it makes the gate MORE precise rather than more forgiving,
 * which is the only acceptable direction for a zero-tolerance pixel check.
 */
async function settleImages(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const deadline = Date.now() + 15_000;
  for (;;) {
    const settled = await page.evaluate(() =>
      Array.from(document.images).every((img) => img.complete),
    );
    if (settled) break;
    if (Date.now() > deadline) {
      throw new Error("images never settled — a screenshot now could false-diff");
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src),
  );
  expect(broken, "broken image loads before the pixel shot").toEqual([]);

  // Bytes are in; now wait for every frame to be DECODED and paintable.
  const undecodable = await page.evaluate(async () => {
    const failures: string[] = [];
    await Promise.all(
      Array.from(document.images).map(async (img) => {
        try {
          await img.decode();
        } catch (err) {
          failures.push(`${img.currentSrc || img.src}: ${String(err)}`);
        }
      }),
    );
    return failures;
  });
  expect(undecodable, "images failed to decode before the pixel shot").toEqual([]);

  await page.evaluate(() => window.scrollTo(0, 0));
}

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

  it("behaviorAttrPatterns strips as its OWN declared class (the slice-A mechanism D–F register through)", async () => {
    // ADR-0008 makes behavior attributes (`hx-*`, `on:*`, `q:*`) a declared
    // registry class distinct from inert residue. Mechanics are identical to
    // attrPatterns — the class is the audit trail — so the proof reuses the
    // SSR placeholder's real marker attribute: registered under the behavior
    // class instead, the page still normalizes to reference equality, and
    // with the class empty it demonstrably does not.
    const page = await openTracked(domContext, `${ORIGIN}/placeholder-ssr/sample/`);
    const asBehavior = {
      attrPatterns: [],
      classPatterns: SSR_NOISE.classPatterns,
      behaviorAttrPatterns: SSR_NOISE.attrPatterns,
    };
    const unstripped = await extractNormalizedDom(page, {
      ...asBehavior,
      behaviorAttrPatterns: [],
    });
    expect(unstripped).toContain("data-ph-hydrate");
    const dom = await extractNormalizedDom(page, asBehavior);
    assertDomEqual("dom-behavior-attr-class", referenceDom, dom);
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

describe("editorial: vanilla vs the master re-rendered from the RESOLVED snapshot (ADR-0008 §9)", () => {
  it("the served page equals the re-rendered master by normalized DOM — under NO_NOISE (vanilla is the control)", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const masterPage = await openTracked(context, masterDomUrl);
    const masterDom = await extractNormalizedDom(masterPage, NO_NOISE);
    await masterPage.close();
    expect(masterDom).not.toBe("");
    expect(masterDom.split("\n")[0]).toBe('<html lang="en">');
    expect(masterDom).toContain("pm-editorial");

    const page = await openTracked(context, `${ORIGIN}/vanilla/editorial/`);
    // Non-vacuity: the chrome IS on this page; the normalizer excludes it.
    expect(await page.locator("div#pm-chrome-slot #pm-chrome").count()).toBe(1);
    const dom = await extractNormalizedDom(page, NO_NOISE);
    expect(dom).not.toContain("pm-chrome");
    assertDomEqual("dom-vanilla-editorial", masterDom, dom);
    await page.close();
    await context.close();
  }, 90_000);

  for (const profileId of PROFILE_IDS) {
    it(`pixels match under profile ${profileId} once the injected chrome is removed`, async () => {
      const context = await browser.newContext(
        profileContextOptions(PROFILES[profileId]),
      );
      const masterPage = await openTracked(context, masterPixelUrl);
      // The re-rendered master has no chrome slot — part of the contract.
      expect(await neutralizeChrome(masterPage)).toBe(0);
      await settleImages(masterPage);
      const referenceShot = await captureStablePixels(masterPage);
      await masterPage.close();

      const page = await openTracked(context, `${ORIGIN}/vanilla/editorial/`);
      expect(await neutralizeChrome(page)).toBe(1);
      await settleImages(page);
      const shot = await captureStablePixels(page);
      assertPixelsEqual(`pixels-${profileId}-vanilla-editorial`, referenceShot, shot);
      await page.close();
      await context.close();
    }, 120_000);
  }
});

describe("editorial: react-next vs the master re-rendered from the RESOLVED snapshot (editorial-build slice B)", () => {
  it("the served page equals the re-rendered master by normalized DOM — under react-next's registered noise", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const masterPage = await openTracked(context, masterDomUrl);
    const masterDom = await extractNormalizedDom(masterPage, NO_NOISE);
    await masterPage.close();
    expect(masterDom).not.toBe("");
    expect(masterDom.split("\n")[0]).toBe('<html lang="en">');
    expect(masterDom).toContain("pm-editorial");

    const page = await openTracked(context, `${ORIGIN}/react-next/editorial/`);
    // Non-vacuity: the chrome IS on this page; the normalizer excludes it.
    expect(await page.locator("div#pm-chrome-slot #pm-chrome").count()).toBe(1);
    // Non-vacuity for the registered noise itself: derived from the ACTUAL
    // registered selector(s) (not a hand-typed approximation, which could
    // silently drift out of sync with normalize.ts and pass even if the
    // real selector became vacuous — verify-slice finding) — each selector
    // this variant excuses must actually match something on the served
    // page, or the registration is excusing nothing real.
    for (const selector of REACT_NEXT_NOISE.dropElementSelectors ?? []) {
      expect(await page.locator(selector).count(), selector).toBeGreaterThan(0);
    }
    const dom = await extractNormalizedDom(page, REACT_NEXT_NOISE);
    expect(dom).not.toContain("pm-chrome");
    assertDomEqual("dom-react-next-editorial", masterDom, dom);
    await page.close();
    await context.close();
  }, 90_000);

  for (const profileId of PROFILE_IDS) {
    it(`pixels match under profile ${profileId} once the injected chrome is removed`, async () => {
      const context = await browser.newContext(
        profileContextOptions(PROFILES[profileId]),
      );
      const masterPage = await openTracked(context, masterPixelUrl);
      // The re-rendered master has no chrome slot — part of the contract.
      expect(await neutralizeChrome(masterPage)).toBe(0);
      await settleImages(masterPage);
      const referenceShot = await captureStablePixels(masterPage);
      await masterPage.close();

      const page = await openTracked(context, `${ORIGIN}/react-next/editorial/`);
      expect(await neutralizeChrome(page)).toBe(1);
      await settleImages(page);
      const shot = await captureStablePixels(page);
      assertPixelsEqual(`pixels-${profileId}-react-next-editorial`, referenceShot, shot);
      await page.close();
      await context.close();
    }, 120_000);
  }
});

describe("editorial: astro vs the master re-rendered from the RESOLVED snapshot (editorial-build slice C)", () => {
  it("the served page equals the re-rendered master by normalized DOM — under NO_NOISE, and its emptiness is EARNED", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const masterPage = await openTracked(context, masterDomUrl);
    const masterDom = await extractNormalizedDom(masterPage, NO_NOISE);
    await masterPage.close();
    expect(masterDom).not.toBe("");
    expect(masterDom.split("\n")[0]).toBe('<html lang="en">');
    expect(masterDom).toContain("pm-editorial");

    const page = await openTracked(context, `${ORIGIN}/astro/editorial/`);
    // Non-vacuity: the chrome IS on this page; the normalizer excludes it.
    expect(await page.locator("div#pm-chrome-slot #pm-chrome").count()).toBe(1);

    // Astro registers NO permitted noise (normalize.ts), and unlike vanilla
    // that is a MEASURED result rather than a design choice — so it is checked
    // here against the raw served bytes rather than asserted in a comment.
    // Astro's two noise species are both opt-in and this page opts into
    // neither: `data-astro-cid-*` scoping attributes exist only on components
    // carrying a `<style>` block, and `<astro-island>` wrappers exist only
    // around framework components given a `client:*` directive. If a later
    // edit adds either, this fails and the registry must be updated
    // deliberately instead of the drift comparison silently starting to lie.
    const raw = await page.content();
    expect(raw).not.toMatch(/data-astro-cid-/);
    expect(raw).not.toContain("<astro-island");
    expect(PERMITTED_NOISE["astro"]).toBeUndefined();

    const dom = await extractNormalizedDom(page, NO_NOISE);
    expect(dom).not.toContain("pm-chrome");
    assertDomEqual("dom-astro-editorial", masterDom, dom);
    await page.close();
    await context.close();
  }, 90_000);

  for (const profileId of PROFILE_IDS) {
    it(`pixels match under profile ${profileId} once the injected chrome is removed`, async () => {
      // The pixel leg is what proves Astro's `compressHTML` (on by default —
      // it strips the inter-element whitespace the master's own serialization
      // carries) is genuinely rendering-neutral on this page, rather than
      // trusting the reasoning that the two navs are flex containers whose
      // whitespace-only children never become flex items.
      const context = await browser.newContext(
        profileContextOptions(PROFILES[profileId]),
      );
      const masterPage = await openTracked(context, masterPixelUrl);
      // The re-rendered master has no chrome slot — part of the contract.
      expect(await neutralizeChrome(masterPage)).toBe(0);
      await settleImages(masterPage);
      const referenceShot = await captureStablePixels(masterPage);
      await masterPage.close();

      const page = await openTracked(context, `${ORIGIN}/astro/editorial/`);
      expect(await neutralizeChrome(page)).toBe(1);
      await settleImages(page);
      const shot = await captureStablePixels(page);
      assertPixelsEqual(`pixels-${profileId}-astro-editorial`, referenceShot, shot);
      await page.close();
      await context.close();
    }, 120_000);
  }
});

describe("editorial: qwik vs the master re-rendered from the RESOLVED snapshot (editorial-build slice D)", () => {
  it("the served page equals the re-rendered master by normalized DOM — under qwik's registered noise, non-vacuously in both directions", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const masterPage = await openTracked(context, masterDomUrl);
    const masterDom = await extractNormalizedDom(masterPage, NO_NOISE);
    await masterPage.close();
    expect(masterDom).not.toBe("");
    expect(masterDom.split("\n")[0]).toBe('<html lang="en">');
    expect(masterDom).toContain("pm-editorial");

    const page = await openTracked(context, `${ORIGIN}/qwik/editorial/`);
    // Non-vacuity: the chrome IS on this page; the normalizer excludes it.
    expect(await page.locator("div#pm-chrome-slot #pm-chrome").count()).toBe(1);

    // Non-vacuity for the registration itself, DERIVED from what is registered
    // rather than hand-typed (the slice-B lesson: a hand-typed approximation
    // can drift out of sync with normalize.ts and keep passing after the real
    // pattern goes vacuous). Every attribute NAME on the served page is
    // enumerated, and each registered behaviour-attribute pattern must match
    // at least one of them — so a pattern that stops describing this
    // paradigm's output fails here instead of quietly excusing nothing.
    // Scoped to elements the comparison KEEPS. `querySelectorAll("*")` would
    // include the `<script>` QwikCityProvider emits unconditionally, which
    // carries `on-document:qcinit` and `on-document:qinit` — so a pattern could
    // "match something on the page" while stripping nothing the gate ever sees.
    // That is exactly the vacuity this block exists to prevent (a verify-slice
    // finding: swapping `useOnDocument` for `useVisibleTask$` would have left
    // `^on-document:` excusing nothing, with all three guards still green).
    // Mirrors normalize.ts's own DROP_ELEMENTS set.
    const attrNames: string[] = await page.evaluate(() => {
      const DROPPED = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE"]);
      return [
        ...new Set(
          [...document.querySelectorAll("*")]
            .filter((el) => !DROPPED.has(el.tagName) && el.closest("template") === null)
            .flatMap((el) => [...el.attributes].map((a) => a.name)),
        ),
      ];
    });
    expect(attrNames).toContain("q:container"); // the <html> container really is here
    for (const source of QWIK_NOISE.behaviorAttrPatterns) {
      const re = new RegExp(source);
      expect(
        attrNames.some((name) => re.test(name)),
        `registered behaviorAttrPattern ${source} matches no attribute on the served page`,
      ).toBe(true);
    }
    // qwik adds no wrapper ELEMENT, so nothing structural is excused; if a
    // future edit needs one, this fails and the registration must be widened
    // deliberately rather than by accident.
    expect(QWIK_NOISE.dropElementSelectors).toBeUndefined();
    expect(QWIK_NOISE.attrPatterns).toEqual([]);

    // The other direction: with NO noise stripped the page must NOT match, or
    // the registration is decorative (the placeholder-ssr precedent above).
    const unstripped = await extractNormalizedDom(page, NO_NOISE);
    expect(unstripped).not.toBe(masterDom);

    const dom = await extractNormalizedDom(page, QWIK_NOISE);
    expect(dom).not.toContain("pm-chrome");
    assertDomEqual("dom-qwik-editorial", masterDom, dom);
    await page.close();
    await context.close();
  }, 90_000);

  for (const profileId of PROFILE_IDS) {
    it(`pixels match under profile ${profileId} once the injected chrome is removed`, async () => {
      // The pixel leg is what proves Qwik's own serialization choices are
      // rendering-neutral. Two of them, stated as measured rather than as
      // assumed: JSX drops the inter-element whitespace the master's
      // hand-authored HTML carries, and ONE text position on this page is split
      // by a comment marker — `<!--t=…-->` around CartStatus's `{cart.message}`,
      // the only interpolation that reads a store proxy. Non-reactive
      // interpolation (the whole essay, the dateline, the feature notes) is NOT
      // split, so those text runs are byte-shaped like the master's. Neither
      // should move a pixel; this leg establishes that rather than the
      // reasoning behind it.
      const context = await browser.newContext(profileContextOptions(PROFILES[profileId]));
      const masterPage = await openTracked(context, masterPixelUrl);
      // The re-rendered master has no chrome slot — part of the contract.
      expect(await neutralizeChrome(masterPage)).toBe(0);
      await settleImages(masterPage);
      const referenceShot = await captureStablePixels(masterPage);
      await masterPage.close();

      const page = await openTracked(context, `${ORIGIN}/qwik/editorial/`);
      expect(await neutralizeChrome(page)).toBe(1);
      await settleImages(page);
      const shot = await captureStablePixels(page);
      assertPixelsEqual(`pixels-${profileId}-qwik-editorial`, referenceShot, shot);
      await page.close();
      await context.close();
    }, 120_000);
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
