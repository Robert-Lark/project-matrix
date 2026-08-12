/**
 * The Remix 3 frames paradigm, browser-verified through the composed origin
 * (editorial-build slice F). FINDINGS §8 named this hand-off explicitly: the
 * spike's §5 behaviors — frame reload, run() anchor interception, Navigation
 * API history — were verified interactively and `test.sh` covers only the
 * HTTP-observable side; committed automated browser coverage belongs to this
 * build's gate wiring. These are BLOCKING tests, deliberately: they assert
 * the exhibit's own machinery works (the deterministic, lockfile-pinned kind
 * of claim), not its identity to the master (that comparison is the advisory
 * drift leg — ADR-0003 first addendum).
 *
 * JS-ON, fresh context per test, beacons intercepted (the cart suite's
 * pattern — the post-deploy smoke runs this against production, and
 * un-intercepted gotos would land synthetic RUM in the collector).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const PAGE = `${ORIGIN}/remix3/editorial/`;
const CARD = ".pm-frontier-demo__card";
const NEXT_ANCHOR = ".pm-frontier-demo__controls a";

let browser: Browser;

beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
});
afterAll(async () => {
  await browser?.close();
});

async function openExhibit(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
  await page.goto(PAGE, { waitUntil: "load" });
  // A document-reload sentinel: any full navigation wipes it, so its
  // survival PROVES the frame swaps below never reloaded the document.
  await page.evaluate(() => {
    (window as unknown as { __pmSentinel?: number }).__pmSentinel = 1;
  });
  return page;
}

const sentinel = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pmSentinel?: number }).__pmSentinel ?? 0);

const cardPick = (page: Page) => page.locator(CARD).getAttribute("data-pick");

describe("run() anchor interception + frame reload (FINDINGS §5, automated)", () => {
  it("clicking the demo anchor reloads ONLY the frame: one partial fetch, no document navigation, URL pushed", async () => {
    const context = await browser.newContext();
    const page = await openExhibit(context);
    expect(await cardPick(page)).toBe("0");

    // Count exactly the frame-partial fetches the click causes.
    const partialFetches: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/remix3/editorial/frames/demo")) partialFetches.push(req.url());
    });

    await page.locator(NEXT_ANCHOR).click();
    await page.waitForSelector(`${CARD}[data-pick="1"]`);

    // One request, HTML over the wire, for the next card.
    expect(partialFetches).toHaveLength(1);
    expect(partialFetches[0]).toContain("pick=1");
    // The document did NOT navigate: the sentinel survived …
    expect(await sentinel(page)).toBe(1);
    // … while the address bar updated through the Navigation API to the
    // JS-off href — the URL stays a complete, shareable receipt.
    expect(new URL(page.url()).search).toBe("?pick=1");
    // The injected chrome survived the swap (it sits outside the frame).
    expect(await page.locator("#pm-chrome").count()).toBe(1);

    await page.close();
    await context.close();
  }, 60_000);

  it("repeated cycling works — frame content carries its own next-anchor (Turbo-style)", async () => {
    const context = await browser.newContext();
    const page = await openExhibit(context);

    await page.locator(NEXT_ANCHOR).click();
    await page.waitForSelector(`${CARD}[data-pick="1"]`);
    await page.locator(NEXT_ANCHOR).click();
    await page.waitForSelector(`${CARD}[data-pick="2"]`);
    await page.locator(NEXT_ANCHOR).click();
    await page.waitForSelector(`${CARD}[data-pick="0"]`); // wraps around
    expect(await sentinel(page)).toBe(1);
    expect(new URL(page.url()).search).toBe("?pick=0");

    await page.close();
    await context.close();
  }, 60_000);

  it("browser Back restores the previous frame content WITHOUT a document reload (Navigation API history)", async () => {
    const context = await browser.newContext();
    const page = await openExhibit(context);

    await page.locator(NEXT_ANCHOR).click();
    await page.waitForSelector(`${CARD}[data-pick="1"]`);

    await page.goBack();
    await page.waitForSelector(`${CARD}[data-pick="0"]`);
    expect(await sentinel(page)).toBe(1);
    expect(new URL(page.url()).search).toBe("");

    await page.close();
    await context.close();
  }, 60_000);

  it("JS off, the same anchor is a plain full-page navigation to the same content (the fallback IS the mechanism's absence)", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(PAGE, { waitUntil: "load" });
    expect(await cardPick(page)).toBe("0");

    await page.locator(NEXT_ANCHOR).click();
    await page.waitForLoadState("load");
    // A real document navigation to the JS-off href …
    expect(new URL(page.url()).pathname).toBe("/remix3/editorial/");
    expect(new URL(page.url()).search).toBe("?pick=1");
    // … serving the full page with the same card resolved server-side.
    expect(await cardPick(page)).toBe("1");
    expect(await page.locator("article.pm-editorial").count()).toBe(1);

    await page.close();
    await context.close();
  }, 60_000);
});
