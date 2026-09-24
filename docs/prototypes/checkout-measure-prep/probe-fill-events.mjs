// Does Playwright's fill() (CDP Input.insertText) register as an INTERACTION
// in Event Timing? If it does, checkout-fix-and-submit's INP would include the
// ten fills; if not, the cell is the worse of the two submit clicks. Measured,
// not assumed — the registry comment states whichever this prints.
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../tools/origin-suite/package.json", import.meta.url));
const { chromium } = require("playwright");
const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: "chrome" }); }
const context = await browser.newContext({ viewport: { width: 1350, height: 940 } });
const page = await context.newPage();
await page.route("**/api/beacon", (r) => r.fulfill({ status: 204 }));
await page.addInitScript(() => {
  window.__pmEvents = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__pmEvents.push({ name: e.name, interactionId: e.interactionId, duration: e.duration, target: e.target?.id ?? e.target?.tagName ?? null });
    }
  }).observe({ type: "event", buffered: true, durationThreshold: 0 });
});
await page.goto(`${ORIGIN}/vanilla/checkout/`, { waitUntil: "load" });
const drain = async (label) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise((r) => setTimeout(r, 300));
  const events = await page.evaluate(() => { const e = window.__pmEvents; window.__pmEvents = []; return e; });
  const withId = events.filter((e) => e.interactionId > 0);
  const byName = {};
  for (const e of withId) byName[e.name] = (byName[e.name] ?? 0) + 1;
  console.log(label, "entries", events.length, "with interactionId>0:", withId.length, JSON.stringify(byName), "distinct ids:", new Set(withId.map((e) => e.interactionId)).size);
};
await drain("after load");
// 1. fill() alone on ten fields
const FILL = { email: "visitor@example.com", name: "Test Visitor", address1: "1 Example Street", city: "Portland", postal: "97201", region: "OR", card: "4242424242424242", cardname: "Test Visitor", expiry: "1226", cvc: "123" };
for (const [id, v] of Object.entries(FILL)) await page.locator(`#${id}`).fill(v);
await drain("after 10 fills");
console.log("card value after fill:", await page.locator("#card").inputValue(), "| expiry:", await page.locator("#expiry").inputValue());
// 2. one submit click (valid)
await page.locator("button.pm-button[type=submit]").click();
await page.waitForFunction(() => (document.querySelector("[data-pm-status]")?.textContent ?? "").startsWith("Order placed"));
await drain("after valid submit click");
// 3. pressSequentially on a fresh field: keystrokes
await page.locator("#cvc").fill("");
await page.locator("#cvc").click();
await drain("after click to focus cvc");
await page.locator("#cvc").pressSequentially("123");
await drain("after 3 keystrokes");
await browser.close();
