/**
 * The PDP's controls, JS ON — the leg whose absence let two dead controls
 * ship to ~500 deployed pages (pdp-controls unit, 2026-08-15).
 *
 * The drift gate is JS-OFF BY CONSTRUCTION (`drift.browser.test.ts`, ADR-0008
 * §7): it proves the SERVED MARKUP is identical across paradigms, which is
 * exactly the right question for a rendering benchmark and exactly the wrong
 * one for "does this button work". Both dead controls had correct, identical,
 * gate-passing markup the whole time. `cart.browser.test.ts` is the only
 * JS-on coverage that existed, and it is scoped to EDITORIAL.
 *
 * The headline test here is the LAST one: every button on the page must
 * change something observable when pressed. It is written generically on
 * purpose — a check that names zoom would have been written only after zoom
 * broke, and would say nothing about the next control. The specific tests
 * above it exist so a failure names the control rather than just "something
 * on this page is inert".
 *
 * Its pre-merge complement is
 * `tools/repo-checks/test/pdp-controls-wired.test.ts`,
 * which needs no plane and therefore CAN block a merge; this one needs a live
 * origin and therefore cannot. Neither is sufficient alone.
 *
 * Matchers are vitest's, not Playwright's web-first ones (this suite runs
 * under vitest — the cart suite's pattern): waits are `expect.poll`, never a
 * fixed sleep, which is the same discipline ADR-0001 addendum I applied to
 * the bench runner's settle windows.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { loadServedSnapshot, type ServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const CART_KEY = "pm:cart";
const ADD_TO_CART = ".pm-pdp__buy button.pm-button";

/** Every LIVE PDP variant, read from the registry rather than named here —
 *  the `cart.browser.test.ts` idiom. Today that is `["vanilla"]`; when
 *  react-next, astro or qwik moves `plannedVariants → variants` this file
 *  starts holding it to the same contract with no edit, which is the whole
 *  point of a guard written during the unit that discovered the defect. The
 *  selectors below are canonical markup every paradigm re-implements, so they
 *  need no per-variant branching. */
const PDP_VARIANTS = SURFACE_CONTROLS["pdp"]!.variants;

let browser: Browser;
let snap: ServedSnapshot;
/** A release with a gallery + tracklist — zoom, thumbs and the scroll region. */
let pdpSlug: string;
/** A release actually FOR SALE — the cart legs. These are deliberately two
 *  different pages: the suite's `pdpDetail` is the first release with ≥2
 *  images and a tracklist, and in the FIXTURE that is 9000001, which is
 *  unpriced and zero-stock, so its CTA ships `disabled` and `pdp.js`
 *  correctly does not wire it. Pointing the cart legs at it would have
 *  tested the harness's assumption rather than the page. Both are derived
 *  from the SERVED snapshot, never named — the suite's standing rule. */
let buySlug: string;
let buyable: { id: number; slug: string };
/** The widest gallery in the served snapshot — the reflow leg. */
let reflowSlug: string;
let widestThumbs: number;

beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
  snap = await loadServedSnapshot();
  // Never vacuously satisfied by a one-image or tracklist-less release.
  expect(snap.pdpDetail.images.length).toBeGreaterThan(1);
  expect(snap.pdpDetail.tracklist.length).toBeGreaterThan(0);
  pdpSlug = snap.pdpDetail.slug;

  // The reflow leg probes the WORST case in the served snapshot, not any
  // case. The gallery overflow it now guards shipped precisely because the
  // fixture's `pdpDetail` has two images: four thumbs is where the strip
  // stops fitting, so a leg pointed at "some release with a gallery" proves
  // nothing. Fixture max is 5 (release 9000016), crate max is 5.
  const widest = snap.details
    .filter((d) => d.tracklist.length >= 1)
    .reduce((a, b) => (b.images.length > a.images.length ? b : a));
  if (widest.images.length < 4) {
    throw new Error(
      `[pdp-controls] the served snapshot's widest gallery has ${widest.images.length} images; ` +
        "the reflow leg needs at least 4 to exercise thumb wrapping, or it passes vacuously — " +
        "the suite fails closed, it never skips",
    );
  }
  reflowSlug = widest.slug;
  widestThumbs = widest.images.length;

  const forSale = snap.details.find((d) => d.numForSale > 0 && d.priceFrom != null);
  if (!forSale) {
    throw new Error(
      "[pdp-controls] the served snapshot has no purchasable release — the cart legs " +
        "would pass vacuously against a disabled CTA; the suite fails closed, it never skips",
    );
  }
  buyable = { id: forSale.id, slug: forSale.slug };
  buySlug = forSale.slug;
});
afterAll(async () => {
  await browser?.close();
});

/** Beacons intercepted (the cart-suite precedent): these are JS-on loads of a
 *  REAL measured surface, and the post-deploy smoke runs them against
 *  production — un-intercepted, every goto here would land synthetic RUM in
 *  the live collector. The live-origin route is intercepted too: ADR-0002 §3
 *  fences it, and a test must never turn it into a real Discogs call. */
async function open(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/live-price/**", (route) =>
    route.fulfill({ status: 404, body: "not deployed" }),
  );
  await page.goto(url, { waitUntil: "load" });
  return page;
}

const url = (variant: string, slug: string) => `${ORIGIN}/${variant}/pdp/${slug}/`;
/** The gallery-bearing page (zoom, thumbs, the scroll region). */
const openPdp = (context: BrowserContext, v: string) => open(context, url(v, pdpSlug));
/** The purchasable page — its CTA is enabled, so add-to-cart is live. */
const openBuy = (context: BrowserContext, v: string) => open(context, url(v, buySlug));
/** The widest gallery on the plane — where reflow breaks first. */
const openWidest = (context: BrowserContext, v: string) => open(context, url(v, reflowSlug));

const cartCount = (page: Page) =>
  page.locator("[data-pm-cart-count]").first().textContent();
const storedCart = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), CART_KEY);
const transform = (page: Page) =>
  page.locator(".pm-gallery__main").evaluate((el) => getComputedStyle(el).transform);

describe.each(PDP_VARIANTS)("%s PDP: controls do what their markup says (JS on)", (variant) => {
  it("Zoom is a real toggle — the attribute flips AND the stage responds", async () => {
    const context = await browser.newContext();
    const page = await openPdp(context, variant);
    const zoom = page.locator(".pm-gallery__zoom");

    // `aria-pressed` is not CSS-settable: before this unit the served page
    // announced "toggle button, not pressed" forever (WCAG 4.1.2).
    expect(await zoom.getAttribute("aria-pressed")).toBe("false");
    const resting = await transform(page);

    await zoom.click();
    await expect.poll(() => zoom.getAttribute("aria-pressed")).toBe("true");
    // The attribute alone is not the fix — gallery.css scales the stage FROM
    // it, so this asserts the whole chain (script → native attribute → rule)
    // rather than the half a unit test could see.
    await expect.poll(() => transform(page)).not.toBe(resting);

    await zoom.click();
    await expect.poll(() => zoom.getAttribute("aria-pressed")).toBe("false");
    await expect.poll(() => transform(page)).toBe(resting);
    await context.close();
  });

  it("zoom survives a gallery switch, and the gallery switch really switches", async () => {
    const context = await browser.newContext();
    const page = await openPdp(context, variant);
    const stage = page.locator(".pm-gallery__main");
    const thumbs = page.locator(".pm-gallery__thumb");
    expect(await thumbs.count()).toBe(snap.pdpDetail.images.length);

    const first = await stage.getAttribute("src");
    await page.locator(".pm-gallery__zoom").click();
    await thumbs.nth(1).click();

    await expect.poll(() => stage.getAttribute("src")).not.toBe(first);
    // Selection is an exclusive semantic carried on aria-current (the
    // contract every paradigm re-implements): exactly one, on the one clicked.
    await expect.poll(() => thumbs.nth(1).getAttribute("aria-current")).toBe("true");
    expect(await page.locator(".pm-gallery__thumb[aria-current]").count()).toBe(1);
    // The visitor asked to look closely; changing image does not withdraw it.
    expect(await page.locator(".pm-gallery__zoom").getAttribute("aria-pressed")).toBe("true");
    await context.close();
  });

  it("the quantity stepper drives the native input and clamps a typed value", async () => {
    const context = await browser.newContext();
    const page = await openBuy(context, variant);
    const qty = page.locator("#qty");
    const down = page.locator(".pm-qty__step").first();
    const up = page.locator(".pm-qty__step").last();

    expect(await qty.inputValue()).toBe("1");
    await down.click();
    await expect.poll(() => qty.inputValue()).toBe("1"); // min, not 0
    await up.click();
    await expect.poll(() => qty.inputValue()).toBe("2");

    // `max` does not constrain TYPED input — the field is in no form, so
    // constraint validation never runs. The clamp is the enhancement's, and
    // without it typing 250 added 250 while the "+" button showed 99.
    await qty.fill("250");
    await qty.blur();
    await expect.poll(() => qty.inputValue()).toBe("99");

    // The clamp rides the COMMIT event, not blur alone: Enter commits a
    // typed value without leaving the field, and a blur-only draft shipped
    // exactly that divergence (verify-slice, pdp-variants slice 1 — vanilla
    // clamped 2501→99 on Enter while react-next held the raw value until
    // blur). Every variant is held to the Enter-commit clamp here so the
    // rejected draft cannot return green.
    await qty.fill("2501");
    await qty.press("Enter");
    await expect.poll(() => qty.inputValue()).toBe("99");
    await context.close();
  });

  it("add-to-cart stores the CHOSEN quantity in the contract's shape", async () => {
    const context = await browser.newContext();
    const page = await openBuy(context, variant);
    await page.locator("#qty").fill("3");
    await page.locator("#qty").blur();
    await page.locator(ADD_TO_CART).click();

    await expect
      .poll(() => storedCart(page))
      .toBe(JSON.stringify({ v: 1, items: [{ id: buyable.id, qty: 3 }] }));
    // Not increment-by-one: the PDP is the only surface that writes qty > 1,
    // which is what CART_CONTRACT had to be taught to say.
    await expect.poll(() => cartCount(page)).toBe("3");
    await context.close();
  });

  it("a duplicate-id cart reads as EMPTY, the same way on every surface", async () => {
    const context = await browser.newContext();
    const page = await openBuy(context, variant);
    // Schema-valid under the OLD rule, and the two implementations then
    // disagreed about it: editorial bumped the FIRST match (→ 3), the PDP
    // bumped EVERY match (→ 4). Uniqueness is now part of validity, so both
    // recover to empty and one add is one item.
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key!, value!),
      [CART_KEY, JSON.stringify({ v: 1, items: [{ id: 7, qty: 1 }, { id: 7, qty: 1 }] })],
    );
    await page.reload({ waitUntil: "load" });
    await expect.poll(() => cartCount(page)).toBe("");

    await page.locator(ADD_TO_CART).click();
    await expect
      .poll(() => storedCart(page))
      .toBe(JSON.stringify({ v: 1, items: [{ id: buyable.id, qty: 1 }] }));
    await context.close();
  });

  it("nothing pushes the page sideways at 320 px, and the tracklist really scrolls", async () => {
    const context = await browser.newContext();
    const page = await openWidest(context, variant);
    await page.setViewportSize({ width: 320, height: 800 });

    // 1. The tracklist wrapper. A focus stop on a container that cannot
    //    scroll is a stop with no purpose, and it shipped styled by NOTHING.
    const region = page.locator(".pm-pdp__scroll");
    expect(await region.getAttribute("tabindex")).toBe("0");
    expect(await region.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");

    // 2. The thumb strip must WRAP. Non-wrapping, its flex row can never be
    //    narrower than its content, and a grid item's `min-width: auto` grows
    //    the gallery column to match — which is how 316 of the crate's 500
    //    releases came to scroll the document sideways in production.
    const rows = await page.evaluate(
      () =>
        new Set(
          [...document.querySelectorAll(".pm-gallery__thumb")].map((t) =>
            Math.round(t.getBoundingClientRect().top),
          ),
        ).size,
    );
    expect(await page.locator(".pm-gallery__thumb").count()).toBe(widestThumbs);
    expect(rows, "the thumb strip did not wrap — this leg is not exercising the case").toBeGreaterThan(1);

    // 3. The property all of that exists to protect (WCAG 1.4.10).
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      scrollWidth,
      `the document scrolls horizontally at 320 px (${scrollWidth} > ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
    await context.close();
  });

  /**
   * The general rule, and the reason this file exists rather than a handful
   * of targeted assertions: pressing any button on this page must change
   * something a visitor or assistive technology could notice. It is what
   * turns "we fixed zoom" into "a control cannot ship inert here again" —
   * including controls nobody has written yet.
   */
  // A generous budget on purpose: this opens one page per button and waits on
  // each. The per-button poll below is what must be short, so a genuinely
  // inert control is REPORTED BY NAME rather than killing the test with a
  // timeout that says nothing about which button was dead.
  it("NO button on the page is inert", async () => {
    const context = await browser.newContext();
    const probe = await openPdp(context, variant);
    const total = await probe.locator("button:not([disabled])").count();
    await probe.close();
    // Zoom, one thumb at minimum, two steppers, add-to-cart, live-origin.
    expect(total).toBeGreaterThan(3);

    /** Everything a visitor could notice: the serialized DOM (attributes and
     *  text), every live input VALUE — a property, invisible in the
     *  serialization, which is what the stepper changes — and stored state.
     *
     *  Scoped to `.pm-page`, NOT to `document.body`, and that scoping is the
     *  whole difference between a real check and a vacuous one. The front
     *  Worker injects the chrome into `#pm-chrome-slot`, a SIBLING of
     *  `.pm-page`, and the HUD's live vitals readout writes an LCP value into
     *  itself after the first interaction — so a body-scoped probe changes on
     *  ANY click and this test passed against the build with the dead Zoom
     *  button. Measured, not reasoned: the first difference was
     *  `data-pm-hud-live="LCP"` going from "–" to "60ms". Same boundary the
     *  drift normalizer draws for the same reason. */
    const observable = (page: Page) =>
      page.evaluate(
        (key) => ({
          dom: document.querySelector(".pm-page")?.innerHTML ?? "",
          values: [...document.querySelectorAll("input")].map((i) => i.value),
          stored: localStorage.getItem(key),
        }),
        CART_KEY,
      );

    // TWO checks on the probe itself, because the first draft of this test
    // was vacuous and neither one alone would have caught it.
    const quiet = await openPdp(context, variant);

    // 1. The chrome is PRESENT and OUTSIDE the observed subtree. This is the
    //    one that catches the body-scoped draft. Being explicit about why the
    //    idle check below cannot: `measure.js` calls `onLCP(record)` with no
    //    options, and web-vitals only reports LCP on keydown / click /
    //    visibilitychange — so the HUD slot that made every button look alive
    //    does not move while the page merely sits there. It moves on the
    //    CLICK. Only the scope boundary defeats it.
    const chrome = await quiet.locator("#pm-chrome").count();
    expect(chrome, "no injected chrome on this page — the scoping proves nothing").toBe(1);
    expect(
      await quiet.evaluate(
        () => document.querySelector(".pm-page")?.contains(document.querySelector("#pm-chrome")) ?? true,
      ),
      "the observed subtree contains the injected chrome — its live HUD would make every button look alive",
    ).toBe(false);

    // 2. And the observed subtree must be still when nothing is pressed, which
    //    catches ambient churn of any other kind (a timer, an animation, a
    //    streaming insert) that would forge a change for an inert control.
    const settled = JSON.stringify(await observable(quiet));
    await quiet.waitForTimeout(1500);
    expect(
      JSON.stringify(await observable(quiet)),
      "the page changes on its own — this probe cannot tell a live control from ambient churn",
    ).toBe(settled);
    await quiet.close();

    /**
     * Put the page where the target control has something to DO. A control
     * that correctly refuses is not an inert control, and two refusals here
     * are correct behaviour: a decrement button at its input's minimum, and
     * an exclusive selector clicked while it is already the selection. Both
     * rules below are stated in terms of what the MARKUP is, never in terms
     * of which control it is, so they keep working for controls nobody has
     * written yet.
     */
    async function prime(page: Page, index: number): Promise<void> {
      // 1. Every number input to the middle of its OWN declared range, so a
      //    stepper is never probed from a boundary it is right to hold.
      for (const input of await page.locator('input[type="number"]').all()) {
        const min = Number((await input.getAttribute("min")) ?? "1");
        const max = Number((await input.getAttribute("max")) ?? "99");
        await input.fill(String(Math.floor((min + max) / 2)));
        await input.blur();
      }
      // 2. If the target shares its first class with siblings, select a
      //    DIFFERENT one first — an exclusive-selection control already on
      //    the target has nothing to change, which is the contract working.
      const target = page.locator("button:not([disabled])").nth(index);
      const first = ((await target.getAttribute("class")) ?? "").split(/\s+/)[0];
      if (!first) return;
      const group = page.locator(`button.${first}:not([disabled])`);
      const size = await group.count();
      if (size < 2) return;
      for (let s = 0; s < size; s += 1) {
        const sibling = group.nth(s);
        if (await sibling.evaluate((el, t) => el === t, await target.elementHandle())) continue;
        await sibling.click();
        return;
      }
    }

    const inert: string[] = [];
    for (let i = 0; i < total; i += 1) {
      // A FRESH page per button: clicks accumulate state, and an inert button
      // could otherwise be credited with an earlier one's work.
      const page = await openPdp(context, variant);
      const button = page.locator("button:not([disabled])").nth(i);
      const label =
        (await button.getAttribute("class")) ?? (await button.innerText()) ?? `button ${i}`;
      await prime(page, i);
      // SETTLE after priming, before the baseline. prime() may CLICK a
      // sibling, and on the crate plane the `pm-button` group has two members
      // — add-to-cart and the fenced live-origin button, whose handler is
      // async. Reading `before` straight after the priming click would let
      // that click's later output land during the target's poll window and be
      // credited to the target, so an inert button could pass. Wait for two
      // identical consecutive reads instead of a fixed sleep.
      let before = JSON.stringify(await observable(page));
      for (let settle = 0; settle < 25; settle += 1) {
        await page.waitForTimeout(100);
        const next = JSON.stringify(await observable(page));
        if (next === before) break;
        before = next;
      }
      await button.click();
      try {
        // Polled, not slept: the live-origin button is async.
        await expect
          .poll(async () => JSON.stringify(await observable(page)) !== before, { timeout: 2000 })
          .toBe(true);
      } catch {
        inert.push(`${label.trim()} (#${i})`);
      }
      await page.close();
    }
    expect(inert, "buttons that changed nothing when pressed").toEqual([]);
    await context.close();
  }, 180_000);
});
