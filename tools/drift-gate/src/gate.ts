/**
 * Playwright page helpers — the gate's contact surface with the browser the
 * origin suite drives. The suite owns the browser; these helpers own the
 * gate's mechanics so the policy (what is stripped, when a screenshot is
 * trustworthy) lives here, next to the normalizer, not in test files.
 *
 * Contexts are created JS-OFF (`javaScriptEnabled: false`), deliberately:
 *  - the served markup is what the canonical-markup contract governs
 *    (ADR-0003 §1) — with scripts off, the DOM under test is exactly the
 *    served DOM, and the SSR placeholder's permitted noise cannot be
 *    mutated away before the normalizer proves it strips it;
 *  - rendering is deterministic (no HUD live readouts ticking mid-shot);
 *  - gate runs fire no beacons, so they never pollute the collector.
 * Playwright's own `evaluate` still works with page JS disabled.
 */
import type { BrowserContextOptions, Page } from "playwright";
import type { TestProfile } from "@pm/measurement";
import { PAGE_NORMALIZE, NO_NOISE, type NoiseSpec } from "./normalize";

/**
 * Browser-context options for one published test profile: the gate applies
 * the profile's VIEWPORT axis (width/height/DPR/mobile emulation). The
 * network/CPU axes are the bench runner's business (issue #7) — throttling
 * cannot change what a settled page looks like, and the gate always waits
 * for settled rendering.
 */
export function profileContextOptions(
  profile: TestProfile,
): BrowserContextOptions {
  return {
    viewport: {
      width: profile.viewport.width,
      height: profile.viewport.height,
    },
    deviceScaleFactor: profile.viewport.deviceScaleFactor,
    isMobile: profile.viewport.mobile,
    hasTouch: profile.viewport.mobile,
    javaScriptEnabled: false,
  };
}

/**
 * Extract the page's normalized DOM (see normalize.ts for what is stripped
 * and why). Reads a CLONE — the live page is untouched, so callers can
 * still screenshot afterwards. The chrome slot is dropped by the normalizer
 * itself: that exclusion is part of the DOM check's own contract
 * (ADR-0004 §7), independent of {@link neutralizeChrome}.
 *
 * `rootSelector` scopes the extract to one element's subtree — used to pin
 * the component demo's canonical markup to the surface golden master.
 */
export function extractNormalizedDom(
  page: Page,
  noise: NoiseSpec = NO_NOISE,
  rootSelector?: string,
): Promise<string> {
  return page.evaluate(PAGE_NORMALIZE, {
    attrPatterns: [...noise.attrPatterns],
    classPatterns: [...noise.classPatterns],
    rootSelector,
  });
}

/**
 * REMOVE the chrome slot subtree from the live page — the pixel check's
 * chrome exclusion. Removal, not region-masking: the chrome participates in
 * normal document flow, so masking its region cannot compensate for the
 * layout shift it causes below (packages/switcher/README.md); removing the
 * slot reflows the variant page into exactly the reference render's layout.
 * Removing the slot also detaches the chrome's own stylesheet link and
 * script, so no chrome byte can influence the shot.
 *
 * Returns the number of slots removed so callers can assert the exclusion
 * was exercised (1 on a contract-conforming variant page, 0 on the
 * reference render).
 */
export function neutralizeChrome(page: Page): Promise<number> {
  return page.evaluate(() => {
    const slots = document.querySelectorAll("div#pm-chrome-slot");
    for (const slot of slots) slot.remove();
    return slots.length;
  });
}

/**
 * Full-page screenshot once rendering is SETTLED: fonts loaded (an unloaded
 * or mid-`font-display: swap` webfont is the classic false pixel diff).
 *
 * Two subtleties, both demonstrated/spec-verified 2026-07-09:
 *  - Font readiness is polled from Node via SYNC evaluates — in a
 *    JS-disabled page `requestAnimationFrame` never fires, and an async
 *    in-page await dies with "execution context was destroyed".
 *  - `document.fonts.status` alone is vacuous: it reads "loaded" while the
 *    loading list is EMPTY, i.e. before layout has even triggered the font
 *    fetch (CSS Font Loading spec). So layout is forced first (offsetHeight
 *    starts any pending @font-face load), then the poll waits until no face
 *    is still `loading` AND at least one has `loaded` (an empty FontFaceSet
 *    fails loudly — every gate page loads the shared fonts.css by contract,
 *    so "no faces" means a broken page, not a fontless one). It does NOT
 *    require EVERY registered face to load: a `unicode-range` fallback face
 *    (e.g. the "PM Warn Glyph" ⚠ that only the field error triggers,
 *    ADR-0006 §3) legitimately stays `unloaded` on pages that never use its
 *    range, and must not stall the gate. Once the primary face has loaded,
 *    the same forced layout has already started every OTHER face the page
 *    actually needs, so "none loading" is a safe settle point.
 *
 * No explicit reflow wait is needed after chrome removal: the screenshot
 * call itself forces layout and a fresh frame. Animations/caret are
 * disabled by Playwright for the shot.
 */
export async function captureStablePixels(page: Page): Promise<Buffer> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const fonts = await page.evaluate(() => {
      const _force = document.body.offsetHeight; // layout → font loads start
      const faces = Array.from(document.fonts);
      return {
        count: faces.length,
        anyLoaded: faces.some((f) => f.status === "loaded"),
        // a never-triggered unicode-range fallback stays "unloaded", NOT
        // "loading" — so it doesn't count here and can't stall the gate.
        loading: faces.some((f) => f.status === "loading"),
      };
    });
    if (fonts.count > 0 && fonts.anyLoaded && !fonts.loading) break;
    if (Date.now() > deadline) {
      throw new Error(
        `fonts never settled (${JSON.stringify(fonts)}) — a screenshot now could false-diff`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return page.screenshot({
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
}
