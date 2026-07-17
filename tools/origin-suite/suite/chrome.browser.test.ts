/**
 * The browser leg of the chrome checks (issue #5), still at the composed-
 * origin seam — a real Chromium drives the page:
 *  - JS enabled → the HUD live readout populates from the pinned web-vitals
 *    build, and the beacon lands in the collector on visibility-hidden.
 *  - JS disabled → the page and the switcher anchors stay fully functional
 *    (the chrome injects no runtime the page depends on).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");

let browser: Browser;
beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    // No bundled Chromium (e.g. a dev machine whose TLS interception blocks
    // the Playwright CDN) — drive the system Chrome instead. CI always
    // installs the bundled build.
    browser = await chromium.launch({ channel: "chrome" });
  }
});
afterAll(async () => {
  await browser?.close();
});

describe("HUD live readout (JS on)", () => {
  it("populates the visitor's own web-vitals and beacons them on hidden", async () => {
    const page = await browser.newPage();
    const beaconResponses: number[] = [];
    const beaconBodies: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith("/api/beacon")) beaconBodies.push(req.postData() ?? "");
    });
    page.on("response", (res) => {
      if (res.url().endsWith("/api/beacon")) beaconResponses.push(res.status());
    });

    await page.goto(`${ORIGIN}/placeholder-ssr/sample/`);
    // TTFB reports as soon as the page settles.
    await page.waitForFunction(
      () =>
        document.querySelector('[data-pm-hud-live="TTFB"]')?.textContent !== "–",
      undefined,
      { timeout: 15_000 },
    );
    const ttfb = await page
      .locator('[data-pm-hud-live="TTFB"]')
      .textContent();
    expect(ttfb).toMatch(/\d+ms/);

    // Flush: the library reports final values when the page goes hidden.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => true, undefined, { timeout: 1 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    expect(beaconResponses.length).toBeGreaterThan(0);
    expect(new Set(beaconResponses)).toEqual(new Set([204]));

    // A 204 alone would also accept five "unknown" fallbacks (a severed
    // chrome→dataset wiring). The payload must carry THIS page's measurement
    // condition.
    const event = JSON.parse(beaconBodies[0]!) as {
      name: string;
      tags: Record<string, string>;
    };
    expect(event.tags.variant).toBe("placeholder-ssr");
    expect(event.tags.surface).toBe("sample");
    expect(event.tags.environment).toBe("n=24|cache=default");
    expect(event.tags.cacheState).toBe("default");
    const location = event.tags.location ?? "";
    expect(location).not.toBe("unknown");
    expect(location.length).toBeGreaterThan(0);
    await page.close();
  }, 60_000);
});

describe("home surface HUD (ADR-0007 §5 — the live half, in-page)", () => {
  it("populates the visitor's own web-vitals and beacons them tagged singleton/home", async () => {
    const page = await browser.newPage();
    const beaconResponses: number[] = [];
    const beaconBodies: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith("/api/beacon")) beaconBodies.push(req.postData() ?? "");
    });
    page.on("response", (res) => {
      if (res.url().endsWith("/api/beacon")) beaconResponses.push(res.status());
    });

    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-pm-hud-live="TTFB"]')?.textContent !== "–",
      undefined,
      { timeout: 15_000 },
    );
    expect(
      await page.locator('[data-pm-hud-live="TTFB"]').textContent(),
    ).toMatch(/\d+ms/);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await new Promise((r) => setTimeout(r, 1500));

    expect(beaconResponses.length).toBeGreaterThan(0);
    expect(new Set(beaconResponses)).toEqual(new Set([204]));

    // Home is a singleton off the matrix: variant/surface identify it; the
    // env/cache/location knobs honestly report unknown (no injected chrome
    // to tag them — ADR-0007 §5).
    const event = JSON.parse(beaconBodies[0]!) as {
      tags: Record<string, string>;
    };
    expect(event.tags.variant).toBe("singleton");
    expect(event.tags.surface).toBe("home");
    expect(event.tags.environment).toBe("unknown");
    expect(event.tags.cacheState).toBe("unknown");
    await page.close();
  }, 60_000);
});

describe("JS-off functionality (ADR-0004 §7)", () => {
  it("the page renders and the switcher swap works as a plain anchor", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/placeholder-static/sample/?n=240`);

    await expect
      .poll(() => page.locator("h1").first().textContent())
      .toBe("Sample surface");
    // The chrome rendered server-side — no JS involved.
    expect(await page.locator("#pm-chrome").count()).toBe(1);
    expect(await page.locator('[data-pm-hud-lab]').textContent()).toContain(
      "No published runs yet",
    );

    // A swap is a real navigation landing on the same measurement condition.
    await page.click('a.pm-chrome__cell[href^="/placeholder-ssr/"]');
    await page.waitForURL(`${ORIGIN}/placeholder-ssr/sample/?n=240`);
    expect(await page.locator("h1").first().textContent()).toBe("Sample surface");
    await context.close();
  }, 60_000);
});
