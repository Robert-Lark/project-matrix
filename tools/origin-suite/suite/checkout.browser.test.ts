/**
 * The checkout in a REAL browser, at the composed-origin seam
 * (checkout-measure-prep, 2026-09-24; the 2026-08-29 audit's priority 7).
 *
 * Until this file, checkout had no origin-suite leg of any kind: the cart
 * suite parameterises over the EDITORIAL surface (cart.browser.test.ts:100),
 * the PDP's controls have their own file, and checkout's JS-on half was
 * proven only in linkedom (tools/repo-checks checkout-controls-behave), which
 * says of itself that it has no layout, no timing, and matches `:checked` on
 * the attribute. A checkout cart that diverged from editorial's was exactly
 * as invisible as the dead PDP controls were. Everything below is what a DOM
 * emulation cannot finish:
 *
 *  - the cart contract on THIS surface: a stored cart populates the badge,
 *    the label and the order summary on load, priced by the reference's own
 *    rule; the shipping radio moves the total by exactly the price its own
 *    LABEL states; a malformed value is the empty cart; the empty cart fetches
 *    nothing (the canonical served state, ADR-0008 §7);
 *  - the form: real keystrokes format the card and expiry; an invalid submit
 *    renders the error summary and MOVES FOCUS to it (ADR-0008 §7's
 *    contract); fixing every field and resubmitting announces the order
 *    without leaving the page; the chrome survives all of it under a CPU
 *    throttle;
 *  - the geometry: a populated cart moves NOTHING on the phone profile — the
 *    form's box and the summary's box are where they were, and the
 *    layout-instability metric reads exactly 0. Before this unit a three-item
 *    cart moved the form 25 px and scored 0.0214 on the held plane (the
 *    summary's floor grew); the catalogue fetch is HELD across the first
 *    paint so the shift, if any, is observable rather than raced;
 *  - the JS-OFF path: native validation blocks an empty submit, and a filled
 *    form's native POST lands on the placed page through the 303.
 *
 * Parameterised over every LIVE checkout variant (the cart suite's idiom):
 * `["vanilla"]` today; react-next and htmx join with no edit when they move
 * `plannedVariants → variants`. Selectors are the canonical markup every
 * paradigm re-implements. Beacons intercepted (the cart suite's precedent —
 * JS-on loads of a measured surface against the production plane on the
 * smoke would otherwise land synthetic RUM). Fresh context per test.
 *
 * Settling: every in-page wait is on a DOM state the enhancement itself
 * produces — the formatted value, the focused summary, the announcement, the
 * line count — never the address bar or a timer (the htmx settle-race
 * lesson). The two exceptions are the JS-off legs, where the browser
 * navigates or refuses to: the positive waits on the placed page's own
 * response and URL, and the negative counts POST requests (zero) rather than
 * trusting that a URL had not changed yet when it was read.
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PROFILES } from "@pm/measurement";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { CHECKOUT_FILL, CHECKOUT_FORMATTED_CARD, profileContextOptions } from "@pm/bench-runner";
import { loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CHECKOUT_VARIANTS = SURFACE_CONTROLS["checkout"]!.variants;
const SUBMIT = "button.pm-button[type=submit]";

interface CartContract {
  key: string;
  version: number;
  badge: (count: number) => string;
  cartLabel: (count: number) => string | null;
}
interface PricedLine {
  id: number;
  qty: number;
  title: string;
  price: number;
}

let browser: Browser;
let contract: CartContract;
/** The reference's price rule (lib.mjs formatPrice) — the oracle for every
 *  total below, imported rather than re-typed. */
let formatPrice: (p: { amount: number; currency: string }) => string;
/** Three priced releases from the SERVED snapshot, quantities 3·2·1 so the
 *  summary renders three lines and six units — past the old floor's slack. */
let lines: PricedLine[];
let subtotal: number;

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
  const lib = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
  );
  formatPrice = lib.formatPrice;
  const snap = await loadServedSnapshot();
  const priced = snap.summaries.filter((s) => s.priceFrom?.currency === "USD").slice(0, 3);
  if (priced.length < 3) {
    throw new Error(
      "[checkout] the served snapshot has fewer than three USD-priced releases — the populated-cart legs " +
        "would render fewer lines than the geometry proof needs; the suite fails closed, it never skips",
    );
  }
  lines = priced.map((s, i) => ({ id: s.id, qty: 3 - i, title: s.title, price: s.priceFrom!.amount }));
  subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
});
afterAll(async () => {
  await browser?.close();
});

const units = (l: PricedLine[]) => l.reduce((n, x) => n + x.qty, 0);
const usd = (amount: number) => formatPrice({ amount, currency: "USD" });

/** A JS-on page with the beacon intercepted and, optionally, a cart stored
 *  BEFORE the page's own script runs (addInitScript) — a returning visitor,
 *  not a page mutated after load. `catalogueRequests` counts what the
 *  enhancement asked the plane for. */
async function open(
  context: BrowserContext,
  url: string,
  stored: unknown = null,
): Promise<{ page: Page; catalogueRequests: () => number }> {
  const page = await context.newPage();
  await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
  let catalogue = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/assets/cart-catalogue.json")) catalogue += 1;
  });
  if (stored !== null) {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: contract.key, value: JSON.stringify(stored) },
    );
  }
  await page.goto(url, { waitUntil: "load" });
  return { page, catalogueRequests: () => catalogue };
}

const total = (page: Page) => page.locator("[data-pm-cart-total]").textContent();
const badge = (page: Page) => page.locator("[data-pm-cart-count]").first().textContent();
const linesRendered = (page: Page, n: number) =>
  page.waitForFunction((want) => document.querySelectorAll(".pm-cart__line").length === want, n);

for (const variant of CHECKOUT_VARIANTS) {
  const PAGE = `${ORIGIN}/${variant}/checkout/`;

  describe(`/${variant}/checkout/: the cart contract on this surface`, () => {
    it("served empty: the summary is left exactly as served, the badge is empty, and NOTHING is fetched", async () => {
      // The canonical served state, and the one the instrument measures. A
      // catalogue request here would be a byte cost paid for a state the
      // measurement never enters (the rejected inline-index shape).
      const context = await browser.newContext();
      const { page, catalogueRequests } = await open(context, PAGE);
      await page.waitForLoadState("networkidle");
      expect(await badge(page)).toBe("");
      expect(await page.locator(".pm-masthead__cart").getAttribute("aria-label")).toBeNull();
      expect(await page.locator(".pm-cart__line").count()).toBe(0);
      expect(await page.locator(".pm-cart__empty").isHidden()).toBe(false);
      // The served list shares the reserved cell with the empty copy and is
      // hidden while empty (cart-summary.css `:empty`), so the copy owns the
      // cell alone — selectable, not covered by an empty scroll box.
      expect(await page.locator(".pm-cart__lines").evaluate((el) => getComputedStyle(el).display)).toBe("none");
      expect(await total(page)).toContain("—");
      expect(catalogueRequests(), "the empty cart fetched the catalogue it does not need").toBe(0);
      await context.close();
    }, 60_000);

    it("a stored cart populates the badge, the label and the summary on load — priced by the reference's own rule, one catalogue fetch", async () => {
      const context = await browser.newContext();
      const { page, catalogueRequests } = await open(context, PAGE, { v: contract.version, items: lines.map(({ id, qty }) => ({ id, qty })) });
      await linesRendered(page, lines.length);
      const n = units(lines);
      expect(await badge(page)).toBe(contract.badge(n));
      expect(await page.locator(".pm-masthead__cart").getAttribute("aria-label")).toBe(contract.cartLabel(n));
      expect(await page.locator(".pm-cart__empty").isHidden(), "the empty copy stays visible over a populated list").toBe(true);
      const whats = await page.locator(".pm-cart__what").allTextContents();
      expect(whats).toEqual(lines.map((l) => `${l.title} × ${l.qty}`));
      const prices = await page.locator(".pm-cart__line .pm-cart__price").allTextContents();
      expect(prices).toEqual(lines.map((l) => usd(l.price * l.qty)));
      expect(await total(page)).toBe(usd(subtotal));
      expect(catalogueRequests()).toBe(1);
      await context.close();
    }, 60_000);

    it("the shipping radio moves the total by exactly the price its own label states — and back", async () => {
      const context = await browser.newContext();
      const { page } = await open(context, PAGE, { v: contract.version, items: lines.map(({ id, qty }) => ({ id, qty })) });
      await linesRendered(page, lines.length);
      // The oracle is the served LABEL, not the script's constant: the option
      // reads "Express — $12.00, 2 days", and the total must move by that.
      const label = await page.locator('.pm-format__option:has(input[value="express"]) .pm-format__label').textContent();
      const stated = Number(label!.match(/\$([\d,]+\.\d{2})/)![1]!.replace(/,/g, ""));
      expect(stated).toBeGreaterThan(0);
      await page.locator('.pm-format__option:has(input[value="express"])').click();
      await expect.poll(() => total(page)).toBe(usd(subtotal + stated));
      await page.locator('.pm-format__option:has(input[value="standard"])').click();
      await expect.poll(() => total(page)).toBe(usd(subtotal));
      await context.close();
    }, 60_000);

    it("a malformed stored value reads as the empty cart on this surface too (recovery rule) — and asks for nothing", async () => {
      const context = await browser.newContext();
      const { page, catalogueRequests } = await open(context, PAGE, { v: 99, items: "nope" });
      await page.waitForLoadState("networkidle");
      expect(await badge(page)).toBe("");
      expect(await page.locator(".pm-cart__line").count()).toBe(0);
      expect(catalogueRequests()).toBe(0);
      await context.close();
    }, 60_000);
  });

  describe(`/${variant}/checkout/: the controls do what the markup says (JS on)`, () => {
    it("the card and expiry format as you type — real keystrokes, the hint's own promise", async () => {
      const context = await browser.newContext();
      const { page } = await open(context, PAGE);
      const card = page.locator("#card");
      await card.click();
      await card.pressSequentially(CHECKOUT_FILL.card!);
      await expect.poll(() => card.inputValue()).toBe(CHECKOUT_FORMATTED_CARD);
      const expiry = page.locator("#expiry");
      await expiry.click();
      await expiry.pressSequentially(CHECKOUT_FILL.expiry!);
      await expect.poll(() => expiry.inputValue()).toBe("12/26");
      await context.close();
    }, 60_000);

    it("an invalid submit renders the error summary with a link per rule and MOVES FOCUS to it; a second does not stack", async () => {
      // ADR-0008 §7's checkout contract, in a browser with a real focus model
      // (linkedom shimmed focus()). Each clause is a line.
      const context = await browser.newContext();
      const { page } = await open(context, PAGE);
      await page.locator(SUBMIT).click();
      await page.waitForFunction(() => document.activeElement?.classList.contains("pm-error-summary") === true);
      const summary = page.locator(".pm-error-summary");
      expect(await summary.count()).toBe(1);
      expect(await summary.getAttribute("tabindex")).toBe("-1");
      const links = await summary.locator(".pm-error-summary__list a").evaluateAll((as) =>
        as.map((a) => ({ href: a.getAttribute("href") ?? "", resolves: document.getElementById((a.getAttribute("href") ?? "").slice(1)) !== null })),
      );
      expect(links.length).toBe(10);
      for (const link of links) expect(link.resolves, `${link.href} hits nothing`).toBe(true);
      // At the TOP of the form, and announced.
      expect(await page.locator(".pm-checkout__form > :first-child").evaluate((el) => el.className)).toBe("pm-error-summary");
      expect(await page.locator("[data-pm-status]").textContent()).toContain("10 problems");
      // Every field wears the state the sheet styles from.
      expect(await page.locator('.pm-field__control[aria-invalid="true"]').count()).toBe(10);
      await page.locator(SUBMIT).click();
      await page.waitForFunction(() => document.activeElement?.classList.contains("pm-error-summary") === true);
      expect(await page.locator(".pm-error-summary").count()).toBe(1);
      await context.close();
    }, 60_000);

    it("fixing every field and resubmitting clears the summary and announces the order WITHOUT leaving the page", async () => {
      const context = await browser.newContext();
      const { page } = await open(context, PAGE);
      await page.evaluate(() => {
        (window as unknown as { __pmMarker: number }).__pmMarker = 1;
      });
      await page.locator(SUBMIT).click();
      await page.waitForFunction(() => document.activeElement?.classList.contains("pm-error-summary") === true);
      for (const [id, value] of Object.entries(CHECKOUT_FILL)) await page.locator(`#${id}`).fill(value);
      await page.locator(SUBMIT).click();
      await page.waitForFunction(() => (document.querySelector("[data-pm-status]")?.textContent ?? "").startsWith("Order placed"));
      expect(await page.locator(".pm-error-summary").count()).toBe(0);
      expect(await page.locator('[aria-invalid="true"]').count()).toBe(0);
      const status = (await page.locator("[data-pm-status]").textContent()) ?? "";
      // The email hint's promise: the address appears in the confirmation.
      expect(status).toContain(CHECKOUT_FILL.email!);
      expect(status).toContain("Standard");
      expect(status).toContain("nothing ships");
      // JS-on, the order is placed IN the page: no navigation, the marker survived.
      expect(new URL(page.url()).pathname).toBe(`/${variant}/checkout/`);
      expect(await page.evaluate(() => (window as unknown as { __pmMarker?: number }).__pmMarker)).toBe(1);
      await context.close();
    }, 60_000);

    it("the front Worker's injected chrome survives load and the invalid submit on a slow CPU", async () => {
      // The cart suite's leg, on this surface: the react-next hydration bug
      // that emptied the chrome subtree was invisible on a fast machine.
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.goto(PAGE, { waitUntil: "load" });
      const chrome = page.locator("div#pm-chrome-slot #pm-chrome");
      expect(await chrome.count(), "chrome was never injected").toBe(1);
      await page.waitForLoadState("networkidle");
      expect(await chrome.count(), "chrome vanished after startup settled").toBe(1);
      await page.locator(SUBMIT).click();
      await page.waitForFunction(() => document.activeElement?.classList.contains("pm-error-summary") === true);
      expect(await chrome.count(), "chrome vanished after the submit").toBe(1);
      await context.close();
    }, 90_000);
  });

  describe(`/${variant}/checkout/: a populated cart moves nothing (ADR-0008 §7 reserved geometry)`, () => {
    // Both profiles that show the summary differently: on the phone it sits
    // ABOVE the form (checkout.css ≤52em `order: -1`), so growth moves the
    // form; on the desktop it sits beside it, so growth could move only its
    // own total row. Before this unit the held plane measured 0.0214 and
    // 0.0011 respectively; both must read exactly 0 now.
    for (const profileId of ["slow-4g-mid-phone", "avg-broadband-desktop"] as const) {
      it(`${profileId}: with the catalogue fetch held across first paint, the form and the summary stay put and layout-shift reads 0`, async () => {
        const profile = PROFILES[profileId];
        // JS ON at the profile's viewport — the bench runner's context options,
        // not the drift gate's (which are JS-off by design).
        const context = await browser.newContext(profileContextOptions(profile));
        const page = await context.newPage();
        await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
        // HOLD the catalogue so the page paints EMPTY first, then populates —
        // otherwise a fast plane resolves the fetch before first paint and a
        // real shift is never observable. Routing disables the HTTP cache; this
        // is a geometry probe, not a measurement.
        let release: () => void = () => {};
        const held = new Promise<void>((r) => (release = r));
        await page.route("**/assets/cart-catalogue.json", async (route) => {
          await held;
          await route.continue();
        });
        await page.addInitScript(
          ({ key, value }) => {
            localStorage.setItem(key, value);
            const w = window as unknown as { __pmShifts: { value: number; recent: boolean }[]; __pmObserver: PerformanceObserver };
            w.__pmShifts = [];
            w.__pmObserver = new PerformanceObserver((list) => {
              for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
                w.__pmShifts.push({ value: e.value, recent: e.hadRecentInput });
              }
            });
            w.__pmObserver.observe({ type: "layout-shift", buffered: true });
          },
          { key: contract.key, value: JSON.stringify({ v: contract.version, items: lines.map(({ id, qty }) => ({ id, qty })) }) },
        );
        await page.goto(PAGE, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        const twoFrames = () =>
          page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
        await twoFrames();
        const before = {
          form: await page.locator(".pm-checkout__form").boundingBox(),
          cart: await page.locator(".pm-cart").boundingBox(),
          total: await page.locator(".pm-cart__total").boundingBox(),
        };
        expect(before.form, "no form box").not.toBeNull();
        expect(before.cart, "no summary box").not.toBeNull();
        expect(before.total, "no total row box — null would equal null below").not.toBeNull();
        release();
        await linesRendered(page, lines.length);
        await page.evaluate(() => document.fonts.ready);
        await twoFrames();
        const after = {
          form: await page.locator(".pm-checkout__form").boundingBox(),
          cart: await page.locator(".pm-cart").boundingBox(),
          total: await page.locator(".pm-cart__total").boundingBox(),
        };
        // The direct geometric claim first — it does not depend on the metric.
        expect(after.form, "populating the cart moved the form").toEqual(before.form);
        expect(after.cart, "populating the cart resized the summary").toEqual(before.cart);
        expect(after.total, "populating the cart moved the total row").toEqual(before.total);
        // Then the metric, drained: takeRecords() collects entries the
        // observer has not yet delivered (the first probe of this unit read
        // 0 by reading too early — the lesson this drain carries).
        const shifts = await page.evaluate(() => {
          const w = window as unknown as { __pmShifts: { value: number; recent: boolean }[]; __pmObserver: PerformanceObserver };
          for (const e of w.__pmObserver.takeRecords() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            w.__pmShifts.push({ value: e.value, recent: e.hadRecentInput });
          }
          return w.__pmShifts;
        });
        const cls = shifts.filter((s) => !s.recent).reduce((sum, s) => sum + s.value, 0);
        expect(cls, `layout-shift entries: ${JSON.stringify(shifts)}`).toBe(0);
        // And the lines really are there, inside the reserved cell.
        expect(await page.locator(".pm-cart__line").count()).toBe(lines.length);
        await context.close();
      }, 90_000);
    }

    it("slow-4g-mid-phone: a six-item cart scrolls INSIDE the summary — the cell is the track the sheet derives, the total does not move", async () => {
      const snap = await loadServedSnapshot();
      const six = snap.summaries.filter((s) => s.priceFrom?.currency === "USD").slice(0, 6);
      expect(six.length, "fewer than six priced releases in the served snapshot").toBe(6);
      const context = await browser.newContext(profileContextOptions(PROFILES["slow-4g-mid-phone"]));
      const page = await context.newPage();
      await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
      // Held across first paint like the leg above: without the hold, a fast
      // plane populates before `load` and "before" IS "after" (a vacuous pass
      // the verification pass caught).
      let release: () => void = () => {};
      const held = new Promise<void>((r) => (release = r));
      await page.route("**/assets/cart-catalogue.json", async (route) => {
        await held;
        await route.continue();
      });
      await page.addInitScript(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: contract.key, value: JSON.stringify({ v: contract.version, items: six.map((s) => ({ id: s.id, qty: 1 })) }) },
      );
      await page.goto(PAGE, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const totalBefore = await page.locator(".pm-cart__total").boundingBox();
      expect(totalBefore, "no total row box").not.toBeNull();
      release();
      await linesRendered(page, 6);
      await page.evaluate(() => document.fonts.ready);
      const list = page.locator(".pm-cart__lines");
      const scroll = await list.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY }));
      expect(scroll.overflowY).toBe("auto");
      expect(scroll.scrollHeight, "six lines did not overflow the reserved cell").toBeGreaterThan(scroll.clientHeight);
      // The cell is exactly the middle track the sheet derives — read from
      // the computed grid, not from the first line's height (a long title
      // wraps a line taller than a thumb, and the first six priced titles
      // happening to be short is a property of this snapshot, not a rule).
      const track = await page.locator(".pm-cart").evaluate((el) => {
        const rows = getComputedStyle(el).gridTemplateRows.split(" ");
        return parseFloat(rows[1] ?? "0");
      });
      expect(track).toBeGreaterThan(0);
      expect(Math.abs(scroll.clientHeight - track)).toBeLessThan(1);
      // …and it holds three thumbs plus their two gaps: the derivation the
      // sheet spells (3 × --cart-thumb + 2 × --space-stack-sm).
      const derived = await page.locator(".pm-cart").evaluate((el) => {
        const cs = getComputedStyle(el);
        const thumb = parseFloat(cs.getPropertyValue("--cart-thumb"));
        const gap = parseFloat(cs.rowGap);
        return 3 * thumb + 2 * gap;
      });
      expect(Math.abs(track - derived)).toBeLessThan(1);
      expect(await page.locator(".pm-cart__total").boundingBox()).toEqual(totalBefore);
      await context.close();
    }, 90_000);
  });

  describe(`/${variant}/checkout/: JS OFF — the path the variant exists to prove`, () => {
    it("an empty submit is blocked by native validation: ten invalid controls, no navigation", async () => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(PAGE, { waitUntil: "load" });
      expect(await page.locator(".pm-field__control:invalid").count()).toBe(10);
      // The claim is "nothing was posted", so count POSTs rather than read a
      // URL that a slow navigation might not have changed yet.
      let posts = 0;
      page.on("request", (req) => {
        if (req.method() === "POST") posts += 1;
      });
      await page.locator(SUBMIT).click();
      // Constraint validation refused the submit: the browser shows its
      // bubble on the first invalid control and sends nothing. Give a
      // navigation that should not happen time to be observable if it did.
      await page.waitForTimeout(1_000);
      expect(posts, "the browser posted an invalid form").toBe(0);
      expect(new URL(page.url()).pathname).toBe(`/${variant}/checkout/`);
      expect(await page.locator(".pm-field__control:invalid").count()).toBe(10);
      await context.close();
    }, 60_000);

    it("a filled form's native POST lands on the placed page through the 303 — a real page, not a 405", async () => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(PAGE, { waitUntil: "load" });
      // JS off there is no formatter, so the patterns are met literally:
      // digits only for the card, MM/YY for the expiry.
      const jsOff = { ...CHECKOUT_FILL, expiry: "12/26" };
      for (const [id, value] of Object.entries(jsOff)) await page.locator(`#${id}`).fill(value);
      expect(await page.locator(".pm-field__control:invalid").count()).toBe(0);
      const [response] = await Promise.all([
        page.waitForResponse((res) => new URL(res.url()).pathname === `/${variant}/checkout/placed/` && res.request().method() === "GET"),
        page.locator(SUBMIT).click(),
      ]);
      expect(response.status()).toBe(200);
      await page.waitForURL(`**/${variant}/checkout/placed/`);
      expect(await page.locator("h1.pm-page__title").textContent()).toBe("Order placed");
      // The document the browser is on was reached by GET, so a refresh
      // re-GETs it rather than re-posting — the 303's whole point.
      await page.reload({ waitUntil: "load" });
      expect(new URL(page.url()).pathname).toBe(`/${variant}/checkout/placed/`);
      expect(await page.locator("h1.pm-page__title").textContent()).toBe("Order placed");
      await context.close();
    }, 60_000);
  });
}
