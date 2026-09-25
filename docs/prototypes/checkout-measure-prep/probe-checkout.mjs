// Inline probes for unit 7 (checkout measure-prep) against a HELD plane —
// the layout-shift measurement before and after the fixed cell, the empty
// summary geometry, the 320 px overflow check and the JS-off POST. The
// layout-shift reading waits two animation frames and 600 ms after the last
// line renders; the suite leg drains the observer with takeRecords(), which
// is the stronger form (the first draft of this probe read 0 by reading too
// early).
// Usage: node probe-checkout.mjs [label]   (PM_ORIGIN defaults to 127.0.0.1:8787)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(new URL("../../../tools/origin-suite/package.json", import.meta.url));
const { chromium } = require("playwright");
const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const label = process.argv[2] ?? "probe";
const out = (k, v) => console.log(`${label} ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);

// Priced fixture ids, derived from the committed trays (never typed).
const summaries = JSON.parse(
  readFileSync(new URL("../../../tools/snapshot-fixture/snapshot/summaries.json", import.meta.url), "utf8"),
);
const priced = summaries.filter((s) => s.priceFrom?.currency === "USD").slice(0, 3).map((s) => s.id);
out("priced ids", priced);

// 1. The JS-off POST, as the browser would send it.
{
  const res = await fetch(`${ORIGIN}/vanilla/checkout/`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "shipping=standard",
  });
  const body = await res.text();
  out("POST /vanilla/checkout/", {
    status: res.status,
    location: res.headers.get("location"),
    contentLength: res.headers.get("content-length"),
    bodyBytes: body.length,
    floor: {
      xcto: res.headers.get("x-content-type-options"),
      rp: res.headers.get("referrer-policy"),
      xfo: res.headers.get("x-frame-options"),
    },
  });
  const placed = await fetch(`${ORIGIN}/vanilla/checkout/placed/`);
  out("GET /vanilla/checkout/placed/", { status: placed.status, type: placed.headers.get("content-type") });
}

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ channel: "chrome" });
}

const PROFILES = {
  phone: { viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1350, height: 940 }, deviceScaleFactor: 1, isMobile: false },
  narrow: { viewport: { width: 320, height: 700 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};

const box = (page, sel) => page.locator(sel).first().boundingBox();

async function shiftProbe(profileName, items, holdMs) {
  const context = await browser.newContext(PROFILES[profileName]);
  const page = await context.newPage();
  await page.route("**/api/beacon", (r) => r.fulfill({ status: 204 }));
  // Hold the catalogue so the page paints EMPTY first, then populates.
  let release;
  const held = new Promise((r) => (release = r));
  await page.route("**/cart-catalogue.json", async (route) => {
    await held;
    await route.continue();
  });
  await page.addInitScript(
    ({ key, items }) => {
      localStorage.setItem(key, JSON.stringify({ v: 1, items }));
      window.__pmShifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__pmShifts.push({ value: e.value, hadRecentInput: e.hadRecentInput, t: e.startTime });
        }
      }).observe({ type: "layout-shift", buffered: true });
    },
    { key: "pm:cart", items },
  );
  await page.goto(`${ORIGIN}/vanilla/checkout/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const before = { form: await box(page, ".pm-checkout__form"), cart: await box(page, ".pm-cart") };
  await new Promise((r) => setTimeout(r, holdMs));
  release();
  await page.waitForFunction((n) => document.querySelectorAll(".pm-cart__line").length === n, items.length, {
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
  const after = { form: await box(page, ".pm-checkout__form"), cart: await box(page, ".pm-cart") };
  const shifts = await page.evaluate(() => window.__pmShifts);
  const cls = shifts.filter((s) => !s.hadRecentInput).reduce((a, s) => a + s.value, 0);
  const linesBox = await box(page, ".pm-cart__lines");
  const totalBox = await box(page, ".pm-cart__total");
  out(`${profileName} x${items.length}`, {
    formTopBefore: before.form?.y,
    formTopAfter: after.form?.y,
    cartHeightBefore: before.cart?.height,
    cartHeightAfter: after.cart?.height,
    linesHeight: linesBox?.height,
    totalBottomInsideCart: totalBox && after.cart ? totalBox.y + totalBox.height <= after.cart.y + after.cart.height + 0.5 : null,
    cls: Number(cls.toFixed(4)),
    shifts: shifts.length,
  });
  await page.screenshot({
    path: `./${label}-${profileName}-x${items.length}.png`,
    fullPage: false,
  });
  await context.close();
}

// 2. Empty-state geometry at phone + desktop.
for (const p of ["phone", "desktop"]) {
  const context = await browser.newContext(PROFILES[p]);
  const page = await context.newPage();
  await page.route("**/api/beacon", (r) => r.fulfill({ status: 204 }));
  await page.goto(`${ORIGIN}/vanilla/checkout/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const cart = await box(page, ".pm-cart");
  const form = await box(page, ".pm-checkout__form");
  const rootPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  out(`${p} empty`, { cartHeight: cart?.height, cartHeightRem: cart ? cart.height / rootPx : null, formTop: form?.y, cartTop: cart?.y, rootPx });
  await context.close();
}

// 3. Populated: 1, 3 and 6 items on phone; 3 on desktop.
const six = summaries.filter((s) => s.priceFrom?.currency === "USD").slice(0, 6).map((s) => s.id);
await shiftProbe("phone", [{ id: priced[0], qty: 1 }], 400);
await shiftProbe("phone", priced.map((id, i) => ({ id, qty: i + 1 })), 400);
await shiftProbe("phone", six.map((id) => ({ id, qty: 1 })), 400);
await shiftProbe("desktop", priced.map((id, i) => ({ id, qty: i + 1 })), 400);

// 4. 320px overflow check on the empty page.
{
  const context = await browser.newContext(PROFILES.narrow);
  const page = await context.newPage();
  await page.route("**/api/beacon", (r) => r.fulfill({ status: 204 }));
  await page.goto(`${ORIGIN}/vanilla/checkout/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const widths = await page.evaluate(() => ({
    inner: window.innerWidth,
    scrollWidth: document.scrollingElement.scrollWidth,
    form: document.querySelector(".pm-checkout__form").getBoundingClientRect().width,
    body: document.querySelector(".pm-checkout__body").getBoundingClientRect().width,
    widestControl: Math.max(...[...document.querySelectorAll(".pm-field__control")].map((el) => el.getBoundingClientRect().right)),
    formRight: document.querySelector(".pm-checkout__form").getBoundingClientRect().right,
    formMinWidth: getComputedStyle(document.querySelector(".pm-checkout__form")).minWidth,
  }));
  out("320px widths", widths);
  await context.close();
}

await browser.close();
