// Which entry does web-vitals' INP reduce to for each checkout id? Observe
// `first-input` and every `event` entry (durationThreshold 0) while driving
// the steps the registry entries take, then print the first-input's name and
// the max event duration >= 40 ms (web-vitals 5.3.0's default gate).
// Usage: node probe-first-input.mjs [before|after|rejected]
//   before   — the first draft: a click to focus the card field; two clicks
//              in the recovery (the cell was the focusing click).
//   after    — what ships (tools/bench-runner/src/collect.ts): programmatic
//              focus, then keystrokes; two real clicks in the recovery.
//   rejected — the programmatic priming (requestSubmit + fills, one click)
//              that made the successful submit the first input and was
//              rejected because it manufactured CLS 0.099.
// The suite's guard for the same claim drives the registry entries
// themselves (tools/origin-suite/suite/bench-checkout.browser.test.ts).
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../tools/origin-suite/package.json", import.meta.url));
const { chromium } = require("playwright");
const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const mode = process.argv[2] ?? "after";
const FILL = { email: "visitor@example.com", name: "Test Visitor", address1: "1 Example Street", city: "Portland", postal: "97201", region: "OR", card: "4242424242424242", cardname: "Test Visitor", expiry: "1226", cvc: "123" };
let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: "chrome" }); }

async function drive(id, steps) {
  const context = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const page = await context.newPage();
  await page.route("**/api/beacon", (r) => r.fulfill({ status: 204 }));
  await page.addInitScript(() => {
    window.__pmFirst = [];
    window.__pmEvents = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__pmFirst.push({ name: e.name, duration: e.duration, target: e.target?.id || e.target?.tagName }); }).observe({ type: "first-input", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId > 0) window.__pmEvents.push({ name: e.name, duration: e.duration, id: e.interactionId, target: e.target?.id || e.target?.tagName }); }).observe({ type: "event", buffered: true, durationThreshold: 0 });
  });
  await page.goto(`${ORIGIN}/vanilla/checkout/`, { waitUntil: "load" });
  await steps(page);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise((r) => setTimeout(r, 500));
  const { first, events } = await page.evaluate(() => ({ first: window.__pmFirst, events: window.__pmEvents }));
  const byId = new Map();
  for (const e of events) byId.set(e.id, Math.max(byId.get(e.id) ?? 0, e.duration));
  const durations = [...byId.values()].sort((a, b) => b - a);
  const gated = durations.filter((d) => d >= 40);
  console.log(`${mode} ${id}: first-input=${JSON.stringify(first)} interactions=${byId.size} maxDuration=${durations[0] ?? null} >=40ms:${JSON.stringify(gated)} → web-vitals INP would be ${Math.max(first[0]?.duration ?? 0, ...gated)} from ${gated.length ? "an event entry" : "the first-input entry"}`);
  await context.close();
}

const submit = (page) => page.getByRole("button", { name: "Place order" });
const summaryFocused = (page) => page.waitForFunction(() => { const s = document.querySelector(".pm-error-summary"); return s !== null && document.activeElement === s; });

if (mode === "before") {
  await drive("type-card", async (page) => { const c = page.locator("#card"); await c.click(); await c.pressSequentially(FILL.card); await page.waitForFunction(() => document.getElementById("card").value === "4242 4242 4242 4242"); });
  await drive("fix-and-submit", async (page) => { await submit(page).click(); await summaryFocused(page); for (const [k, v] of Object.entries(FILL)) await page.locator(`#${k}`).fill(v); await submit(page).click(); await page.waitForFunction(() => (document.querySelector("[data-pm-status]")?.textContent ?? "").startsWith("Order placed")); });
} else if (mode === "rejected") {
  await drive("type-card", async (page) => { const c = page.locator("#card"); await c.focus(); await c.pressSequentially(FILL.card); await page.waitForFunction(() => document.getElementById("card").value === "4242 4242 4242 4242"); });
  await drive("fix-and-submit", async (page) => { await page.locator(".pm-checkout__form").evaluate((f) => f.requestSubmit()); await summaryFocused(page); for (const [k, v] of Object.entries(FILL)) await page.locator(`#${k}`).fill(v); await submit(page).click(); await page.waitForFunction(() => (document.querySelector("[data-pm-status]")?.textContent ?? "").startsWith("Order placed")); });
} else {
  await drive("type-card", async (page) => { const c = page.locator("#card"); await c.focus(); await c.pressSequentially(FILL.card); await page.waitForFunction(() => document.getElementById("card").value === "4242 4242 4242 4242"); });
  await drive("fix-and-submit", async (page) => { await submit(page).click(); await summaryFocused(page); for (const [k, v] of Object.entries(FILL)) await page.locator(`#${k}`).fill(v); await submit(page).click(); await page.waitForFunction(() => (document.querySelector("[data-pm-status]")?.textContent ?? "").startsWith("Order placed")); });
}
await drive("submit-invalid", async (page) => { await submit(page).click(); await summaryFocused(page); });
await browser.close();
