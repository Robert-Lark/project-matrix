/**
 * Checkout's three interaction ids, DRIVEN through the runner's own visit
 * (checkout-measure-prep, 2026-09-24). `tools/bench-runner/test` proves the
 * ids exist; this proves they are drivable against the composed origin and
 * produce what a receipt needs: a real INP from the chrome's own ruler, the
 * interaction bytes each id genuinely costs with the boundary attested, and
 * CLS 0 on the page the instrument measures (the empty cart).
 *
 * What the bytes ARE, because the first draft of this file asserted zero for
 * all three and the plane said otherwise: the two submit ids fetch ONE
 * resource — the one-glyph face for U+26A0 (⚠), which every field error and
 * the summary title draw as a non-colour cue (field.css, error-summary.css)
 * and which fonts.css scopes by `unicode-range` so the browser asks for it on
 * the first error render and never before. 1,212 B body, 1,512 B
 * `transferSize` on the held plane. The face is derived below from the
 * served page's own fonts.css, never named, and the expected transfer is its
 * body plus the 300 octets Resource Timing substitutes for headers (ADR-0001
 * addendum U; Chromium `kHeaderSize = 300`). The keystroke id fetches
 * nothing. The fit template is keyed by SURFACE and publishes ONE interaction
 * (ADR-0001 addendum T), so whichever of the three checkout publishes, its
 * `interactionFetch` declaration follows from this leg — constant for a
 * submit id, none for the keystrokes — and this is what keeps it honest.
 *
 * INP here is the visit's first-input entry unless an interaction reaches
 * the ruler's 40 ms gate (ADR-0001 addendum V), so each entry is built to
 * make its first input the interaction it names; this leg asserts only that
 * the entry arrived, never a value.
 *
 * ONE visit per id, `avg-broadband-desktop`, through `measureVisit` — the
 * function `runBatch` calls per run — rather than a batch: the claim is
 * "drivable and measured", which one visit states as completely as seven,
 * and this file already adds three heavy visits to the suite. No receipt is
 * written and no batch is minted; that is the measurement pass's, after this
 * lands (the runbook's hard ordering). LOCAL-ONLY like the other bench legs:
 * heavy variant pages exercising the harness, not plane correctness.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { PROFILES } from "@pm/measurement";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { INTERACTIONS, measureVisit, profileContextOptions, type RunSampleT } from "@pm/bench-runner";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const REMOTE = process.env.PM_EXPECT_BROTLI === "1";
const HOST = SURFACE_CONTROLS["checkout"]!.host;
const PAGE = `${ORIGIN}/${HOST}/checkout/`;
/** Resource Timing's header substitute (ADR-0001 addendum U). */
const HEADER_OCTETS = 300;

/** The ids and what each fetches: the keystrokes nothing, the two submits
 *  the ⚠ face. Per-id expectations are data, so a fourth id lands here. */
const IDS: readonly { id: string; fetches: "none" | "warn-glyph" }[] = [
  { id: "checkout-type-card", fetches: "none" },
  { id: "checkout-submit-invalid", fetches: "warn-glyph" },
  { id: "checkout-fix-and-submit", fetches: "warn-glyph" },
];

let browser: Browser;
let warnGlyphBytes: number;
const samples = new Map<string, RunSampleT>();

/** The ⚠ face's body size, derived from the SERVED page: its fonts.css link →
 *  the @font-face block scoped to U+26A0 → its url() → the bytes the plane
 *  serves. Never a literal, so a re-subset moves the expectation with it. */
async function servedWarnGlyphBytes(): Promise<number> {
  const html = await (await fetch(PAGE)).text();
  const fontsHref = [...html.matchAll(/<link rel="stylesheet" href="([^"]+fonts\.css)"/g)][0]?.[1];
  if (!fontsHref) throw new Error("the served checkout links no fonts.css");
  const fontsUrl = new URL(fontsHref, PAGE);
  const css = await (await fetch(fontsUrl)).text();
  const block = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]).find((b) => /unicode-range:\s*U\+26A0\s*;/i.test(b));
  if (!block) throw new Error("fonts.css has no @font-face scoped to U+26A0");
  const src = block.match(/url\("([^"]+)"\)/)?.[1];
  if (!src) throw new Error("the U+26A0 face has no url()");
  const res = await fetch(new URL(src, fontsUrl));
  expect(res.status).toBe(200);
  return (await res.arrayBuffer()).byteLength;
}

beforeAll(async () => {
  if (REMOTE) return;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
  warnGlyphBytes = await servedWarnGlyphBytes();
  for (const { id } of IDS) {
    const { sample } = await measureVisit(browser, PROFILES["avg-broadband-desktop"], {
      effectiveUrl: PAGE,
      interactionId: id,
    });
    samples.set(id, sample);
    // Printed for a single-file run (vitest's default reporter shows it; the
    // suite's non-TTY log carries no console output — checked on the final
    // runs). One run, never a published number; the reproducing step for
    // both profiles is docs/prototypes/checkout-measure-prep/
    // probe-samples.browser.test.ts.
    console.log(
      `SAMPLE avg-broadband-desktop ${id} INP=${sample.webVitals.INP} CLS=${sample.webVitals.CLS} bytes=${sample.kb.interactionBytes} settled=${sample.interactionSettled}`,
    );
  }
}, 600_000);
afterAll(async () => {
  await browser?.close();
});

describe.skipIf(REMOTE)("checkout's three ids are drivable and measured (ADR-0008 Consequences; ADR-0001 addendum B)", () => {
  it("the registry carries exactly the three", () => {
    expect(Object.keys(INTERACTIONS).filter((id) => id.startsWith("checkout-")).sort()).toEqual(
      IDS.map((x) => x.id).sort(),
    );
  });

  for (const { id, fetches } of IDS) {
    it(`${id}: one measured visit yields a real INP with the boundary attested, and CLS 0`, () => {
      const sample = samples.get(id)!;
      // The chrome's own web-vitals build reported the interaction: a number,
      // never null — "there is nothing to batch" was the audit's finding.
      expect(sample.webVitals.INP, "no INP arrived — the interaction produced no event-timing entry").not.toBeNull();
      expect(sample.webVitals.INP).toBeGreaterThanOrEqual(0);
      expect(sample.interactionSettled).toBe(true);
      // The page the instrument measures manufactures no shift; the error
      // summary's render is within the metric's recent-input window and is
      // excluded by the metric's own rule.
      expect(sample.webVitals.CLS).toBe(0);
    });

    it(`${id}: interaction bytes are exactly what it fetches — ${fetches === "none" ? "nothing" : "the one-glyph ⚠ face, and nothing else"}`, () => {
      const sample = samples.get(id)!;
      if (fetches === "none") {
        expect(sample.kb.interactionBytes).toBe(0);
        return;
      }
      // Non-vacuity in the direction that matters: the face is real bytes.
      expect(warnGlyphBytes).toBeGreaterThan(0);
      // Body plus the spec's header constant — one same-origin fetch, not
      // from cache (a fresh context per visit), so the arithmetic is exact.
      expect(sample.kb.interactionBytes).toBe(warnGlyphBytes + HEADER_OCTETS);
    });
  }

  it("both submit ids cost the same bytes — one resource, fetched once, on the first error render", () => {
    const invalid = samples.get("checkout-submit-invalid")!.kb.interactionBytes;
    const fixed = samples.get("checkout-fix-and-submit")!.kb.interactionBytes;
    expect(invalid).toBeGreaterThan(0);
    expect(fixed).toBe(invalid);
  });
});

/**
 * The guard for the redesign above: each registry entry is DRIVEN as the
 * runner drives it, while `first-input` and every `event` entry with an
 * `interactionId` are observed, and the first input must be the interaction
 * the id names. Without this, the first draft of `checkout-type-card` — a
 * click to focus the card field before typing — passed every other leg while
 * the cell measured that click (the verification pass's correctness lens read
 * the ruler's 40 ms gate and caught it). `checkout-fix-and-submit` keeps two
 * real clicks on purpose; this leg pins that its fills are not inputs.
 */
describe.skipIf(REMOTE)("each entry's FIRST input is the interaction its name promises (ADR-0001 addendum V)", () => {
  interface Observed {
    first: { name: string; target: string | null }[];
    interactions: number;
  }
  async function observe(id: string): Promise<Observed> {
    const context = await browser.newContext(profileContextOptions(PROFILES["avg-broadband-desktop"]));
    const page = await context.newPage();
    await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
    await page.addInitScript(() => {
      const w = window as unknown as { __pmFirst: unknown[]; __pmIds: Set<number> };
      w.__pmFirst = [];
      w.__pmIds = new Set();
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { target?: Element | null })[]) {
          w.__pmFirst.push({ name: e.name, target: e.target?.id || e.target?.tagName || null });
        }
      }).observe({ type: "first-input", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
          if ((e.interactionId ?? 0) > 0) w.__pmIds.add(e.interactionId!);
        }
      // `durationThreshold` is Event Timing's own option (the browser's floor is
      // 16 ms); the DOM lib's PerformanceObserverInit type predates it.
      }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    });
    await page.goto(PAGE, { waitUntil: "load" });
    await INTERACTIONS[id]!(page);
    // The first-input entry is dispatched after the input's presentation;
    // wait for it as a signal (the runner waits for the same entry), never
    // read the list early — the first draft of this leg did and saw [].
    await page
      .waitForFunction(() => (window as unknown as { __pmFirst: unknown[] }).__pmFirst.length > 0, undefined, { timeout: 10_000 })
      .catch(() => {
        /* no entry: the assertion below names it */
      });
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const observed = await page.evaluate(() => {
      const w = window as unknown as { __pmFirst: { name: string; target: string | null }[]; __pmIds: Set<number> };
      return { first: w.__pmFirst, interactions: w.__pmIds.size };
    });
    await context.close();
    return observed;
  }

  it("checkout-type-card: the first input is a keystroke on the card field, not the click that focused it", async () => {
    const o = await observe("checkout-type-card");
    expect(o.first, "no first-input entry — the keystrokes were not real inputs").toHaveLength(1);
    expect(o.first[0]!.name).toBe("keydown");
    expect(o.first[0]!.target).toBe("card");
  }, 120_000);

  it("checkout-submit-invalid: the first input is the pointer on the submit button", async () => {
    const o = await observe("checkout-submit-invalid");
    expect(o.first).toHaveLength(1);
    expect(o.first[0]!.name).toBe("pointerdown");
    expect(o.first[0]!.target).toBe("BUTTON");
  }, 120_000);

  it("checkout-fix-and-submit: two real clicks — the first input is the invalid submit's pointer, the fills are no input at all", async () => {
    // A programmatic priming (`requestSubmit()` + fills, one real click) was
    // tried and rejected: it manufactured CLS 0.099 (collect.ts records it).
    // So the first input is the FIRST click, and the ten fills between the
    // clicks register no interaction: at most two ids, never twelve.
    const o = await observe("checkout-fix-and-submit");
    expect(o.first).toHaveLength(1);
    expect(o.first[0]!.name).toBe("pointerdown");
    expect(o.first[0]!.target).toBe("BUTTON");
    expect(o.interactions).toBeLessThanOrEqual(2);
  }, 120_000);
});
