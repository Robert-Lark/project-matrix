/**
 * The cart storage contract, exercised end-to-end (editorial-build slice A;
 * parametrized over every LIVE editorial variant in slice B — verify-slice
 * finding: this was the only JS-on interactive coverage and it was
 * hardcoded to vanilla, so react-next's cart islands had zero automated
 * end-to-end proof despite DIFF-TO-STARTER.md claiming the behavior works).
 * `packages/reference/render/shell.mjs` CART_CONTRACT is the contract of
 * record, and this file asserts each variant's implementation against the
 * imported constant — key, value shape, count semantics, announcement copy,
 * the recovery rule, and the load-time repopulation that makes the cart
 * survive a variant swap (ADR-0004 §5, same-origin storage). The canonical
 * classes/attributes this file selects on (`.pm-masthead__cart-count`,
 * `.pm-editorial__feature button.pm-button`, `[data-pm-status]`, ...) are
 * exactly what the drift gate holds every variant's markup to, so the same
 * selectors apply unchanged across variants — no per-variant branching.
 *
 * Deliberately JS-ON: this is the one client enhancement the surface
 * carries, not the gate (the gate stays JS-off; the canonical SERVED state
 * is empty and populated-cart divergence is policed when the JS-on gate
 * pass lands — ADR-0008 §7). Fresh browser context per test: each starts
 * from clean storage.
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { editorialFeaturedId, loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BUTTON = ".pm-editorial__feature button.pm-button";

interface CartContract {
  key: string;
  version: number;
  badge: (count: number) => string;
  cartLabel: (count: number) => string | null;
  announce: (title: string, count: number) => string;
}

let browser: Browser;
let contract: CartContract;
let featured: { id: number; title: string };

beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
  const shell = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "shell.mjs")).href
  );
  contract = shell.CART_CONTRACT as CartContract;
  const snap = await loadServedSnapshot();
  const detail = snap.details.find((d) => d.id === editorialFeaturedId(snap));
  if (!detail) throw new Error("resolved snapshot lost its featured release");
  featured = { id: detail.id, title: detail.title };
});
afterAll(async () => {
  await browser?.close();
});

/**
 * Open the editorial page with the beacon route intercepted. These are
 * JS-on loads of a REAL measured surface, and the post-deploy smoke runs
 * them against the production plane — without interception every goto and
 * reload here would land synthetic RUM (e.g. variant=vanilla,
 * surface=editorial) in the production collector, unmarked (the
 * bench-runner interception precedent, collect.ts). chrome.browser.test.ts
 * deliberately lets its placeholder beacons land — that suite proves the
 * collector; this one proves the cart.
 */
async function openCartPage(context: BrowserContext, pageUrl: string): Promise<Page> {
  const page = await context.newPage();
  await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
  await page.goto(pageUrl, { waitUntil: "load" });
  return page;
}

const countSlot = (page: Page) => page.locator(".pm-masthead__cart-count");
const storedCart = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), contract.key);
const waitForCount = (page: Page, value: string) =>
  page.waitForFunction(
    (v) => document.querySelector("[data-pm-cart-count]")?.textContent === v,
    value,
  );

for (const variant of SURFACE_CONTROLS["editorial"]!.variants) {
  const PAGE = `${ORIGIN}/${variant}/editorial/`;

  describe(`the cart contract at /${variant}/editorial/`, () => {
    it("served empty; an add writes the contract value, count, and announcement — twice increments one entry", async () => {
      const context = await browser.newContext();
      const page = await openCartPage(context, PAGE);

      // Canonical served state (ADR-0008 §7): empty slot, nothing stored.
      expect(await storedCart(page)).toBeNull();
      expect(await countSlot(page).textContent()).toBe("");

      await page.click(BUTTON);
      await waitForCount(page, contract.badge(1));
      expect(JSON.parse((await storedCart(page))!)).toEqual({
        v: contract.version,
        items: [{ id: featured.id, qty: 1 }],
      });
      // The announcement is the contract's copy exactly (WCAG 4.1.3 status)…
      expect(await page.locator("[data-pm-status]").textContent()).toBe(
        contract.announce(featured.title, 1),
      );
      // …and the cart anchor's accessible name carries the count (the badge
      // span is aria-hidden — masthead.css names this duty; contract Label).
      expect(await page.locator(".pm-masthead__cart").getAttribute("aria-label")).toBe(
        contract.cartLabel(1),
      );

      // Same release again: one entry per id, qty increments (contract).
      await page.click(BUTTON);
      await waitForCount(page, contract.badge(2));
      expect(JSON.parse((await storedCart(page))!)).toEqual({
        v: contract.version,
        items: [{ id: featured.id, qty: 2 }],
      });
      expect(await page.locator("[data-pm-status]").textContent()).toBe(
        contract.announce(featured.title, 2),
      );
      expect(await page.locator(".pm-masthead__cart").getAttribute("aria-label")).toBe(
        contract.cartLabel(2),
      );
      await context.close();
    }, 60_000);

    it("a 10+ cart renders the capped badge while the label carries the exact count — and the geometry holds", async () => {
      // The slot reserves min-width 2.4ch (masthead.css) — the badge cap is
      // what keeps "population never shifts layout" true for ANY cart size.
      // BOTH halves are asserted: the cap (string) AND the reserved width
      // (bounding box) — a tokens-tier edit that shrank the slot would
      // otherwise ship client-manufactured CLS the JS-off gate can never see
      // (masters and variants both serve the EMPTY slot).
      const context = await browser.newContext();
      const page = await openCartPage(context, PAGE);
      await page.evaluate(() => document.fonts.ready);
      const before = await page.locator(".pm-masthead__cart").boundingBox();
      await page.evaluate(
        ({ key, id }) =>
          localStorage.setItem(key, JSON.stringify({ v: 1, items: [{ id, qty: 12 }] })),
        { key: contract.key, id: featured.id },
      );
      await page.reload({ waitUntil: "load" });
      await waitForCount(page, contract.badge(12));
      expect(contract.badge(12)).toBe("9+"); // the cap is the contract, not an accident
      expect(await page.locator(".pm-masthead__cart").getAttribute("aria-label")).toBe(
        contract.cartLabel(12),
      );
      await page.evaluate(() => document.fonts.ready);
      const after = await page.locator(".pm-masthead__cart").boundingBox();
      expect(after, "populating the badge moved the cart link").toEqual(before);
      await context.close();
    }, 60_000);

    it("a reload repopulates the masthead count from storage — the swap-survival mechanism", async () => {
      const context = await browser.newContext();
      const page = await openCartPage(context, PAGE);
      await page.click(BUTTON);
      await waitForCount(page, "1");
      await page.reload({ waitUntil: "load" });
      // The freshly served page's slot is empty in markup (canonical state);
      // the enhancement populates it from the existing cart on load.
      await waitForCount(page, "1");
      await context.close();
    }, 60_000);

    it("a malformed stored value reads as the empty cart and is overwritten by the next add (recovery rule)", async () => {
      const context = await browser.newContext();
      const page = await openCartPage(context, PAGE);
      await page.evaluate(
        (key) => localStorage.setItem(key, '{"v":99,"items":"nope"}'),
        contract.key,
      );
      await page.reload({ waitUntil: "load" });
      // Schema-failing value → empty cart: the slot stays empty, no crash —
      // and the executable contract is TOTAL at 0 (a downstream consumer
      // calling it directly must never render a "0" badge or a 0-count label).
      expect(contract.badge(0)).toBe("");
      expect(contract.cartLabel(0)).toBeNull();
      expect(await countSlot(page).textContent()).toBe("");
      expect(await page.locator(".pm-masthead__cart").getAttribute("aria-label")).toBeNull();
      await page.click(BUTTON);
      await waitForCount(page, "1");
      expect(JSON.parse((await storedCart(page))!)).toEqual({
        v: contract.version,
        items: [{ id: featured.id, qty: 1 }],
      });
      await context.close();
    }, 60_000);
  });
}
