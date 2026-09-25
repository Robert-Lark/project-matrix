// Re-observe GitHub's code view honouring ?plain=1#L<n> on docs/build-log.md
// at its new size (the how-built-links-resolve ceiling's own instruction).
// A real Chromium (the origin suite's Playwright build), one URL per line.
import { createRequire } from "node:module";
const require = createRequire("/Users/roblark/Work/project-matrix/tools/origin-suite/package.json");
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("@playwright/test")); }
const ref = process.argv[2] ?? "workers-hardening";
const lines = (process.argv[3] ?? "4342,7920").split(",").map(Number);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
for (const n of lines) {
  const url = `https://github.com/Robert-Lark/project-matrix/blob/${ref}/docs/build-log.md?plain=1#L${n}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  const obs = await page.evaluate((n) => {
    const text = document.body.innerText;
    const header = text.match(/(\d[\d,]*) lines[^\n]*·\s*([\d.]+ ?[KM]B)/)?.[0] ?? null;
    const lc = document.getElementById(`LC${n}`);
    const lineEl = lc ?? document.querySelector(`[data-line-number="${n}"]`);
    const rowText = lc?.innerText ?? null;
    // GitHub marks the anchored line with a highlighted class on the row container.
    const row = lc?.closest("[class*='highlighted'], .highlighted-line, [aria-selected='true']") ?? null;
    const highlighted = Boolean(row) || Boolean(document.querySelector(".highlighted-line, [class*='highlighted-line']"));
    const tooLarge = /too large|unable to render|Sorry, we could not display|truncated/i.test(text);
    return { header, linePresent: Boolean(lineEl), rowText, highlighted, tooLarge, title: document.title };
  }, n);
  const shot = `${process.env.SCRATCH}/ceiling-L${n}.png`;
  await page.screenshot({ path: shot });
  console.log(JSON.stringify({ url, ...obs, screenshot: shot }));
}
await browser.close();
