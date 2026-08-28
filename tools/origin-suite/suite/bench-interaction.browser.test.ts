/**
 * The interaction byte boundary, driven by an interaction that ACTUALLY
 * FETCHES — the leg whose absence let two ruler defects live in the published
 * instrument at once.
 *
 * **Why this file exists.** Every `interactionId` any test had ever driven was
 * `body-click` or `none`, and both fetch nothing. `bench.browser.test.ts`
 * asserts `interactionBytes === 0` for them, which a WORKING boundary and a
 * BROKEN one produce identically. So:
 *
 *  1. The post-click settle was `page.waitForLoadState("networkidle")` — a
 *     document-load-lifecycle LATCH that had already closed during load, so it
 *     returned in 24–49 ms and never observed anything. A 25,194 B interaction
 *     fetch was recorded as `interactionBytes: 0` with `interactionSettled:
 *     true`, the flag asserting that zero as verified (ADR-0001 addendum R).
 *  2. The vitals-beacon capture used `page.route`, and Playwright's typings say
 *     what that costs: "Enabling routing disables http cache"
 *     (playwright-core `types/types.d.ts:4063`). With the browser cache off,
 *     qwik's re-write of five thumb `src` attributes to the values they already
 *     held became five real downloads, and the instrument manufactured a
 *     26,838 B "paradigm difference" no visitor can experience.
 *
 * Neither defect could fail a test, because no test drove an interaction whose
 * result a broken boundary would change. Both fail these two legs.
 *
 * The slug comes from the SERVED snapshot, never a literal — the suite's
 * standing rule, and the reason this holds in fixture and crate mode alike.
 * LOCAL-ONLY, matching `bench.browser.test.ts`'s editorial targets: these are
 * heavy variant pages exercising the harness, not plane correctness, and the
 * post-deploy smoke already carries a flagged bench-timing flake (issue #16).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SURFACE_CONTROLS } from "@pm/switcher";
import {
  Receipt,
  applyProfile,
  armBeaconCapture,
  profileContextOptions,
  runBatch,
  type ReceiptT,
} from "@pm/bench-runner";
import { PROFILES } from "@pm/measurement";
import { chromium, type Browser } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServedSnapshot } from "./snapshot";
// The publication's OWN tolerance, imported rather than restated. Two guards
// on one property with two different thresholds is a trap: the build would
// publish a spread the suite goes red on, and whoever hit it would have to
// decide which comment is the policy (verify-slice, conformance lens).
import { FIT } from "../../../workers/front/lab/fit.mjs";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const REMOTE = process.env.PM_EXPECT_BROTLI === "1";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const NONCE = `suite-interaction-${Date.now().toString(36)}`;
const RUNS = 2;
/** Every LIVE PDP variant, read from the registry rather than named here. */
const PDP_VARIANTS = SURFACE_CONTROLS["pdp"]!.variants;
const pdpFetch = FIT["pdp"]!.interactionFetch;
if (pdpFetch === "none") {
  throw new Error(
    "FIT.pdp declares interactionFetch \"none\", but this file asserts a cross-variant CONSTANT — " +
      "the declaration and the leg have to describe the same claim",
  );
}
const TOLERANCE_BYTES = pdpFetch.toleranceBytes;

let receipt: ReceiptT;
let cartReceipt: ReceiptT;
let slug: string;
/** A PRICED release — a different page from `slug`, deliberately. The suite's
 *  `pdpDetail` is the first release with >= 2 images and a tracklist, and in the
 *  FIXTURE that is 9000001, which is unpriced and zero-stock, so its CTA ships
 *  `disabled` and `pdp-add-to-cart` cannot be driven on it at all. The
 *  `pdp-controls` suite already carries this exact split for the same reason;
 *  pointing the cart batch at the gallery page would test the harness's
 *  assumption rather than the page. (Found by the fail-fast this slice added to
 *  the interaction itself, which named the constraint in a minute where
 *  Playwright's actionability retry would have taken 30 s per visit to say
 *  nothing useful.) */
let buySlug: string;
let imageCount: number;

beforeAll(async () => {
  if (REMOTE) return;
  const snap = await loadServedSnapshot();
  // Fail closed, never vacuously: a one-image release renders no thumb strip,
  // so `pdp-gallery-switch` would have nothing to click and this whole file
  // would pass by measuring nothing.
  expect(snap.pdpDetail.images.length).toBeGreaterThan(1);
  slug = snap.pdpDetail.slug;
  imageCount = snap.pdpDetail.images.length;
  const forSale = snap.details.find((d) => d.numForSale > 0 && d.priceFrom != null);
  if (!forSale) {
    throw new Error(
      "[bench-interaction] the served snapshot has no purchasable release — the zero-fetch leg " +
        "would drive a disabled CTA; the suite fails closed, it never skips",
    );
  }
  buySlug = forSale.slug;
  receipt = Receipt.parse(
    await runBatch({
      origin: ORIGIN,
      targets: PDP_VARIANTS.map((variant) => ({
        path: `/${variant}/pdp/${slug}/`,
        interactionId: "pdp-gallery-switch",
      })),
      profileId: "avg-broadband-desktop",
      runsPerUrl: RUNS,
      n: 24,
      runNonce: NONCE,
      repoRoot,
    }),
  );
  // The MIRROR case, and it is the one this file's own thesis says goes
  // untested: an interaction that must measure ZERO while the tracker
  // genuinely goes quiet. Without it, a regression that made
  // `armNetworkQuiescence` return early would still show non-zero bytes on the
  // fetching leg and pass — the zero direction is what proves the boundary is
  // measuring rather than merely producing a number (verify-slice,
  // conformance lens). `pdp-add-to-cart` is also the declaration the PDP's
  // sibling surface publishes as "none", so this is the claim under test.
  cartReceipt = Receipt.parse(
    await runBatch({
      origin: ORIGIN,
      targets: PDP_VARIANTS.map((variant) => ({
        path: `/${variant}/pdp/${buySlug}/`,
        interactionId: "pdp-add-to-cart",
      })),
      profileId: "avg-broadband-desktop",
      // ONE run per column. The claim under test is "zero, with the boundary
      // attested", which a single run states as completely as seven — and this
      // file already roughly doubles the origin suite's browser work, which
      // cost the pre-existing reproduce leg its 300 s budget on the first full
      // run after these legs landed.
      runsPerUrl: 1,
      n: 24,
      runNonce: `${NONCE}-cart`,
      repoRoot,
    }),
  );
}, 600_000);

describe.skipIf(REMOTE)("an interaction that FETCHES is measured as fetching (ADR-0001 addendum R)", () => {
  it("records NON-ZERO interaction bytes in both columns, on every variant", () => {
    // The assertion the latched wait could not survive. Under the latch the
    // post-click call returned in tens of ms while the stage image was still
    // in flight, and a request still in flight never enters resource timing at
    // all — so every one of these medians read 0.
    for (const target of receipt.targets) {
      for (const column of [target.columns.cold, target.columns.warm]) {
        expect(column.medians.interactionBytes).toBeGreaterThan(0);
        for (const run of column.runs) {
          expect(run.kb.interactionBytes).toBeGreaterThan(0);
        }
      }
    }
  });

  it("attests the boundary it measured: every run reached network quiescence", () => {
    // Zero bytes and "the runner stopped waiting" are the same artifact
    // without this flag, and the flag is only worth anything on a run where
    // something was actually in flight to wait for — which is this file.
    for (const target of receipt.targets) {
      for (const column of [target.columns.cold, target.columns.warm]) {
        for (const run of column.runs) {
          expect(run.interactionSettled).toBe(true);
        }
      }
    }
  });
});

describe.skipIf(REMOTE)("the gallery switch costs the same in every paradigm — it is image mass", () => {
  it("all four variants measure the SAME interaction bytes", () => {
    // Every variant swaps the stage to the same full-size AVIF: vanilla and
    // astro by `stage.src = img.src.replace(/\.thumb\.avif$/, ".avif")`,
    // react-next and qwik by binding `src={current.src}`. Same URL, same
    // bytes — so a DIFFERENCE here is never a paradigm cost, it is a defect,
    // and this leg is what makes that falsifiable instead of assumed.
    //
    // It is the leg that fails when the instrument disables the browser HTTP
    // cache: qwik re-writes `src` on all N thumbs with the value each already
    // holds, which costs nothing when the cache is on and re-downloads every
    // thumb when it is off (measured 2026-08-28: 25,194 B vs 52,032 B on the
    // 5-image crate master, one variable — `page.route` on or off).
    const byVariant = new Map<string, number>();
    for (const target of receipt.targets) {
      for (const name of ["cold", "warm"] as const) {
        const bytes = target.columns[name].medians.interactionBytes;
        // A null median is "the batch produced no value here", which must not
        // collapse into the agreement set as a look-alike — it is a different
        // failure from a disagreement and deserves its own message.
        expect(bytes, `${target.variant}/${name} has no interaction-byte median`).not.toBeNull();
        byVariant.set(`${target.variant}/${name}`, bytes as number);
      }
    }
    const values = [...byVariant.values()];
    expect(
      Math.max(...values) - Math.min(...values),
      `the four paradigms swap the stage to the same URL, so these must agree within the publication's ` +
        `own ${TOLERANCE_BYTES} B tolerance — got ${JSON.stringify(Object.fromEntries(byVariant))}`,
    ).toBeLessThanOrEqual(TOLERANCE_BYTES);
    // Non-vacuity: the map must actually hold every registered variant in
    // both columns, or "they all agree" would be a statement about one cell.
    expect(byVariant.size).toBe(PDP_VARIANTS.length * 2);
  });

  it("measured the release the served snapshot names, with a thumb strip to click", () => {
    // Provenance for the numbers above: a reader can re-derive which page was
    // driven without reading this file's history.
    expect(imageCount).toBeGreaterThan(1);
    expect(receipt.targets.map((t) => t.path).sort()).toEqual(
      PDP_VARIANTS.map((v) => `/${v}/pdp/${slug}/`).sort(),
    );
    for (const target of receipt.targets) {
      expect(target.surface).toBe("pdp");
      expect(target.interactionId).toBe("pdp-gallery-switch");
    }
  });
});

describe.skipIf(REMOTE)("the zero-fetch direction, on an interaction that must measure nothing", () => {
  it("pdp-add-to-cart records ZERO bytes, with the boundary attested, on every variant", () => {
    // The claim `interactionFetch: "none"` makes, driven rather than assumed.
    // A boundary that stopped waiting would also read zero here — which is why
    // the settled flag is asserted beside the bytes, and why the FETCHING leg
    // above is the other half of the same proof.
    for (const target of cartReceipt.targets) {
      for (const name of ["cold", "warm"] as const) {
        expect(
          target.columns[name].medians.interactionBytes,
          `${target.variant}/${name}`,
        ).toBe(0);
        for (const run of target.columns[name].runs) {
          expect(run.kb.interactionBytes, `${target.variant}/${name} run`).toBe(0);
          expect(run.interactionSettled, `${target.variant}/${name} run`).toBe(true);
        }
      }
      expect(target.interactionId).toBe("pdp-add-to-cart");
    }
  });
});

describe.skipIf(REMOTE)("the instrument leaves the browser cache alone (ADR-0001 addendum S)", () => {
  // The MECHANISM, not a variant's side effect. The cross-variant agreement
  // leg above catches today's cache-off symptom only because qwik happens to
  // re-write identical `src` values; the day that stops — a keyed thumb list,
  // a Qwik release that skips no-op attribute writes — all four variants agree
  // with the cache ON or OFF and the agreement leg passes either way. Then
  // `page.route` could come back and nothing would notice (verify-slice,
  // anti-rigging lens).
  //
  // So this drives the runner's OWN setup functions — `applyProfile` and
  // `armBeaconCapture`, imported, not reimplemented — and asks the only
  // question that matters: after a page has loaded a cacheable subresource,
  // does requesting it again cost bytes?
  let browser: Browser;
  beforeAll(async () => {
    if (REMOTE) return;
    try {
      browser = await chromium.launch();
    } catch {
      browser = await chromium.launch({ channel: "chrome" });
    }
  }, 120_000);
  afterAll(async () => {
    await browser?.close();
  });

  it("a second visit in the same context re-serves immutable images from cache, costing zero bytes", async () => {
    const profile = PROFILES["avg-broadband-desktop"];
    const context = await browser.newContext(profileContextOptions(profile));
    const page = await context.newPage();
    try {
      await applyProfile(page, profile);
      const beacons: Array<{ name?: string; value?: number }> = [];
      await armBeaconCapture(page, beacons);
      const url = `${ORIGIN}/vanilla/pdp/${slug}/`;

      // FIRST visit: the images are fetched for real.
      await page.goto(url, { waitUntil: "load" });
      const first = await page.evaluate(() =>
        (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
          .filter((e) => new URL(e.name).pathname.startsWith("/assets/img/"))
          .map((e) => ({ name: e.name, bytes: e.transferSize })),
      );
      // Non-vacuity in the only direction that matters: if the page fetched no
      // images, "the second visit fetched none either" proves nothing.
      expect(first.length, "the PDP page loaded no images at all").toBeGreaterThan(0);
      expect(
        first.some((e) => e.bytes > 0),
        "no image cost bytes on a cold visit — this leg cannot tell a cache hit from an empty page",
      ).toBe(true);

      // SECOND visit, same context, so the browser cache is warm exactly as a
      // real visitor's is within a session. `/assets/img/*` is served
      // `public, max-age=31536000, immutable`, so every one of these must now
      // cost zero. Under Playwright's request routing — which the runner used
      // until 2026-08-28, and which its own typings say "disables http cache"
      // — they are all full downloads again.
      await page.goto(url, { waitUntil: "load" });
      const second = await page.evaluate(() =>
        (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
          .filter((e) => new URL(e.name).pathname.startsWith("/assets/img/"))
          .map((e) => ({ name: e.name, bytes: e.transferSize })),
      );
      expect(second.length, "the second visit loaded no images").toBeGreaterThan(0);
      const paid = second.filter((e) => e.bytes > 0);
      expect(
        paid,
        `${paid.length} of ${second.length} immutable images were re-downloaded on a second visit in the ` +
          `same context — the instrument is disabling the browser HTTP cache, which turns every no-op ` +
          `re-request a paradigm makes into a measured download (ADR-0001 addendum S)`,
      ).toEqual([]);
    } finally {
      await context.close();
    }
  }, 120_000);
});
