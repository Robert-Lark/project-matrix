/**
 * The PLP's restored controls in a REAL browser, at the composed-origin seam
 * (ADR-0005 §5, landed 2026-09-04). "Done" for this unit is a sentence the
 * in-process guards cannot finish: a facet click, a search and a sort each
 * return a genuinely filtered grid on both arms — JS on (a partial swap on
 * htmx, an island fetch on react-next, no document load) AND JS off (a real
 * navigation). Playwright drives Chromium against PM_ORIGIN.
 *
 * Every URL carries `cache=cold` and the run nonce, so nothing here plants a
 * warm-tier key on the deployed plane (the widened warm-tier guard's rule).
 * Values are found in the served snapshot, never typed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PROFILES } from "@pm/measurement";
import {
  extractNormalizedDom,
  firstDomDivergence,
  profileContextOptions,
  PERMITTED_NOISE,
} from "@pm/drift-gate";
import { loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const NONCE = `suite-plpb-${Date.now().toString(36)}`;
const snap = await loadServedSnapshot();

const genre = snap.summaries[0]!.genres[0]!;
const word = snap.summaries[3]!.title.split(" ").find((w) => /^[A-Za-z]{3,}$/.test(w))!;

const ARMS = [
  // kv-exempt: path constants — every navigation below goes through url(), which sets cache=cold and the run= nonce
  { name: "htmx", path: "/htmx/plp/", noise: PERMITTED_NOISE["htmx"]! }, // kv-exempt: path constant
  { name: "react-next", path: "/react-next/plp/plain/", noise: PERMITTED_NOISE["react-next"]! }, // kv-exempt: path constant
  // The client-cache arm: the ONLY arm with the in-flight window ADR-0005
  // addendum Q2 exists for (`keepPreviousData` keeps the previous tray on
  // screen while a new condition loads; `settled` = appliedMatches gates the
  // push). Without it here, Q2's guarantee was never observed in a browser
  // (verify-slice, skeptic lens, 2026-09-18). The fenced Apollo exhibit stays
  // out: it is measured by nothing and excluded from every number.
  { name: "react-next-tanstack", path: "/react-next/plp/tanstack/", noise: PERMITTED_NOISE["react-next"]! }, // kv-exempt: path constant
] as const;

/** Every page and tray URL in this file goes through this helper or `trayTotal`,
 *  and both spell `cache=cold` and the run nonce LITERALLY on their own line:
 *  the repo-checks warm-tier guard reads lines, and the object form these
 *  replaced (`new URLSearchParams({ cache: "cold", run: NONCE, … })`) was
 *  invisible to it — cold and nonced by luck, not because anything checked
 *  (verify-slice, 2026-09-18). Nothing here may plant a warm-tier key on the
 *  deployed plane. */
const url = (path: string, params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return `${ORIGIN}${path}?cache=cold&run=${NONCE}${qs ? `&${qs}` : ""}`;
};

/** The filtered total the tray reports for a condition — what the page must state. */
async function trayTotal(params: Record<string, string>): Promise<number> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${ORIGIN}/api/plp?cache=cold&run=${NONCE}${qs ? `&${qs}` : ""}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as { total: number }).total;
}

/** htmx processes swapped-in content in a SETTLE task, `settleDelay` (20 ms)
 *  after insertion (htmx.js `insertNodesBefore` → `makeAjaxLoadTask` →
 *  `processNode`): until it runs, the new block's forms and anchors carry
 *  `hx-boost` but no listener, and a submit in that window is a NATIVE
 *  navigation — progressive enhancement's honest fallback, not a defect, but
 *  not what these legs test. The URL is pushed BEFORE settle, so a leg that
 *  acts the moment the address bar moves races it; on a fresh plane the race
 *  was lost deterministically (2026-09-18: the Back leg saw the browser's own
 *  form-state restoration, not htmx's). New nodes wear `htmx-added` from
 *  insertion until settle, so its absence is the "processed" signal; on
 *  react-next it is never present and this returns at once. */
const settled = (page: Page) =>
  page.waitForFunction(() => !document.querySelector(".htmx-added"), undefined, { timeout: 15_000 });

/** "Showing … of N releases" → N, read off the live page. */
const statedTotal = (page: Page) =>
  page.locator(".pm-toolbar__count .pm-toolbar__n").nth(1).textContent().then((t) => Number(t));

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

for (const arm of ARMS) {
  describe(`${arm.name}: the controls are real, JS on`, () => {
    let context: BrowserContext;
    beforeAll(async () => {
      context = await browser.newContext();
    });
    afterAll(async () => {
      await context?.close();
    });

    it("a facet click filters the grid IN PLACE — no document load, URL carries the filter, the column and the nonce", async () => {
      const page = await context.newPage();
      await page.goto(url(arm.path), { waitUntil: "load" });
      // A marker that only survives if the document is NOT reloaded.
      await page.evaluate(() => {
        (window as unknown as { __pmMarker: number }).__pmMarker = 1;
      });
      const facet = page.locator(`.pm-facets__facet:has(.pm-facets__value:text-is("${genre}"))`).first();
      const promised = Number(await facet.locator(".pm-facets__count").textContent());
      expect(promised).toBeGreaterThan(0);
      await facet.click();
      await page.waitForFunction(
        (g) => document.querySelector('.pm-facets__facet[aria-current="true"] .pm-facets__value')?.textContent === g,
        genre,
        { timeout: 15_000 },
      );
      await settled(page);
      // The count the facet promised is the count the grid delivers.
      expect(await statedTotal(page)).toBe(promised);
      expect(await statedTotal(page)).toBe(await trayTotal({ genre }));
      // No document load happened: the marker survived.
      expect(await page.evaluate(() => (window as unknown as { __pmMarker?: number }).__pmMarker)).toBe(1);
      // URL-as-receipt: the address bar names the filter AND kept the column and the nonce.
      const search = new URL(page.url()).searchParams;
      expect(search.get("genre")).toBe(genre);
      expect(search.get("cache")).toBe("cold");
      expect(search.get("run")).toBe(NONCE);
      // Toggle off: the selected facet's link removes the filter, in place.
      await page.locator('.pm-facets__facet[aria-current="true"]').click();
      await page.waitForFunction(() => !document.querySelector('.pm-facets__facet[aria-current="true"]'), undefined, { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get("genre")).toBeNull();
      expect(await statedTotal(page)).toBe(snap.summaries.length);
      await page.close();
    }, 60_000);

    it("a search and a sort each swap in place and state what the tray states", async () => {
      const page = await context.newPage();
      await page.goto(url(arm.path), { waitUntil: "load" });
      await page.evaluate(() => {
        (window as unknown as { __pmMarker: number }).__pmMarker = 1;
      });
      // Typed with stray whitespace on purpose: the data plane normalizes `q`
      // and echoes the applied form; both arms push the CANONICAL spelling
      // (htmx via the Worker's HX-Push-Url, react-next via the one href rule).
      await page.fill("#plp-q", `  ${word}  `);
      const before = await statedTotal(page);
      await page.locator(".pm-toolbar__search button").click();
      // Settle on the address bar and the count, not on the input's value:
      // react-next's search box is uncontrolled and keeps what was typed.
      await page.waitForFunction(
        (w) => new URL(location.href).searchParams.get("q") === w,
        word,
        { timeout: 15_000 },
      );
      await settled(page);
      await expect.poll(() => statedTotal(page), { timeout: 15_000 }).not.toBe(before);
      expect(await statedTotal(page)).toBe(await trayTotal({ q: word }));
      expect(new URL(page.url()).searchParams.get("q")).toBe(word);
      // The sort: newest first; the first card is the tray's first item.
      await page.selectOption("#plp-sort", "year-desc");
      await page.locator(".pm-toolbar__sort button").click();
      await page.waitForFunction(
        () => new URL(location.href).searchParams.get("sort") === "year-desc",
        undefined,
        { timeout: 15_000 },
      );
      await settled(page);
      const res = await fetch(`${ORIGIN}/api/plp?cache=cold&run=${NONCE}&${new URLSearchParams({ q: word, sort: "year-desc" }).toString()}`);
      const tray = (await res.json()) as { items: { title: string }[]; total: number };
      expect(await statedTotal(page)).toBe(tray.total);
      if (tray.items.length > 0) {
        expect(await page.locator(".pm-release-card__link").first().textContent()).toBe(tray.items[0]!.title);
      }
      const search = new URL(page.url()).searchParams;
      expect(search.get("sort")).toBe("year-desc");
      expect(search.get("q")).toBe(word); // the search survived the sort
      expect(search.get("cache")).toBe("cold");
      expect(await page.evaluate(() => (window as unknown as { __pmMarker?: number }).__pmMarker)).toBe(1);
      await page.close();
    }, 60_000);

    it("Back restores the CONTROLS too: after search → sort → Back → Back, the select reads the default and the box is empty", async () => {
      // ADR-0005 addendum Q2: every control is drawn from `applied`, never
      // from the URL — and never from what the visitor last touched. An
      // uncontrolled React <select>/<input> keeps its last value across a
      // re-render unless remounted, so before the `key` on each (plp.tsx)
      // this leg failed on react-next while htmx (whole-block swap) passed:
      // one interaction, two behaviours (verify-slice, 2026-09-18).
      const page = await context.newPage();
      await page.goto(url(arm.path), { waitUntil: "load" });
      await page.fill("#plp-q", word);
      await page.locator(".pm-toolbar__search button").click();
      await page.waitForFunction((w) => new URL(location.href).searchParams.get("q") === w, word, { timeout: 15_000 });
      await settled(page);
      await page.selectOption("#plp-sort", "year-desc");
      await page.locator(".pm-toolbar__sort button").click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("sort") === "year-desc", undefined, { timeout: 15_000 });
      await settled(page);
      // Back once: the sort goes, the search stays — in the URL, the grid AND the controls.
      await page.goBack();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("sort") === null, undefined, { timeout: 15_000 });
      await expect.poll(() => page.inputValue("#plp-sort"), { timeout: 15_000 }).toBe("");
      expect(await page.inputValue("#plp-q")).toBe(word);
      await expect.poll(() => statedTotal(page), { timeout: 15_000 }).toBe(await trayTotal({ q: word }));
      // Back again: the search goes too.
      await page.goBack();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("q") === null, undefined, { timeout: 15_000 });
      await expect.poll(() => page.inputValue("#plp-q"), { timeout: 15_000 }).toBe("");
      expect(await page.inputValue("#plp-sort")).toBe("");
      await expect.poll(() => statedTotal(page), { timeout: 15_000 }).toBe(snap.summaries.length);
      await page.close();
    }, 60_000);
  });

  describe(`${arm.name}: the controls are real, JS OFF`, () => {
    it("a facet click is a real navigation to the filtered grid, selected facet marked", async () => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(url(arm.path), { waitUntil: "load" });
      const facet = page.locator(`.pm-facets__facet:has(.pm-facets__value:text-is("${genre}"))`).first();
      const promised = Number(await facet.locator(".pm-facets__count").textContent());
      await Promise.all([page.waitForNavigation({ waitUntil: "load" }), facet.click()]);
      expect(await statedTotal(page)).toBe(promised);
      await expect
        .poll(() => page.locator('.pm-facets__facet[aria-current="true"] .pm-facets__value').textContent())
        .toBe(genre);
      expect(new URL(page.url()).searchParams.get("genre")).toBe(genre);
      expect(new URL(page.url()).searchParams.get("cache")).toBe("cold");
      // The GET form works as a form: submit a search, land on the filtered grid.
      await page.fill("#plp-q", word);
      await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator(".pm-toolbar__search button").click()]);
      expect(new URL(page.url()).searchParams.get("q")).toBe(word);
      expect(new URL(page.url()).searchParams.get("genre")).toBe(genre); // the hidden knob carried the filter
      expect(await statedTotal(page)).toBe(await trayTotal({ genre, q: word }));
      await context.close();
    }, 60_000);
  });
}

describe("the two arms serve one DOM for one filtered URL — at the seam, in a browser", () => {
  it("normalized DOM of /htmx/plp/ and /react-next/plp/plain/ agree under a facet + sort + search", async () => {
    // The in-process guard (repo-checks plp-arms-agree) proves this for the
    // `.pm-plp` block; this is the whole served page through the composed
    // origin, chrome and paradigm noise removed by each arm's own
    // registration — the deployed-seam version of the same claim.
    const context = await browser.newContext(profileContextOptions(PROFILES["avg-broadband-desktop"]!));
    const params = { genre, sort: "title", q: word.slice(0, 3) };
    const doms: string[] = [];
    for (const arm of ARMS) {
      const page = await context.newPage();
      await page.goto(url(arm.path, params), { waitUntil: "load" });
      doms.push(await extractNormalizedDom(page, arm.noise));
      await page.close();
    }
    await context.close();
    expect(doms[0]).toContain("pm-facets");
    for (let i = 1; i < ARMS.length; i++) {
      if (doms[0] !== doms[i]) console.error(`${ARMS[0]!.name} vs ${ARMS[i]!.name}\n${firstDomDivergence(doms[0]!, doms[i]!, 4)}`);
      expect(doms[i], `${ARMS[i]!.name} diverges from ${ARMS[0]!.name}`).toBe(doms[0]);
    }
  }, 90_000);
});
