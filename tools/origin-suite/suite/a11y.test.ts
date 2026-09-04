/**
 * /vanilla/a11y/ at the composed-origin seam (ADR-0008 §8; decision map
 * `a11y-section`; a11y-section build, 2026-09-03). Plain HTTP, outside-in, no
 * Worker internals.
 *
 *  - The URLs SERVE: three pages, 200, the canonical shell, the chrome
 *    injected (a variant page, unlike how-it-was-built), the a11y root. Before
 *    this build every store page's footer linked `/vanilla/a11y/` and the
 *    vanilla assets Worker answered 404 (probed 2026-09-03 — the build log).
 *  - The registration moved WITH the routes (decision map, 2026-08-29):
 *    `SURFACE_CONTROLS.a11y.variants` names vanilla, and the chrome on the
 *    page renders from that — one current cell, no offer, the singleton
 *    reading sentence.
 *  - Strategy-review finding 21's three conditions on the served bytes:
 *    element-demos is `noindex`; every DS-OFF twin is served inside a CLOSED
 *    <details>; label first, compliant twin adjacent.
 *  - The mode demos' honesty caveat is CONTENT, beside every toggle.
 *  - Every page links exactly the master's stylesheets in the master's order
 *    and every linked asset answers 200 from the variant's own tree — the
 *    compare and mode-demo sheets included, which no other surface links.
 *  - The footer link resolves from every served variant's editorial page and
 *    from the store's PDP and checkout hosts, and home's PM-005 row links the
 *    served section.
 *
 * The served body vs the committed master is the drift gate's leg
 * (drift.browser.test.ts, normalized DOM + pixels ×3 profiles); the controls'
 * behaviour in a real browser is a11y.browser.test.ts.
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** The three pages: URL tail → how deep below /vanilla/ (the asset base). */
const PAGES: Record<string, number> = {
  a11y: 1,
  "a11y/element-demos": 2,
  "a11y/mode-demos": 2,
};

/** The master's sheet list, by tail after `/css/` — rendered in-process from
 *  the reference renderer (file URL: the drift gate's pattern), never typed. */
async function masterSheetTails(rel: string): Promise<string[]> {
  const a11y = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "a11y.mjs")).href
  );
  const render = {
    a11y: a11y.renderA11yIndex,
    "a11y/element-demos": a11y.renderA11yElementDemos,
    "a11y/mode-demos": a11y.renderA11yModeDemos,
  }[rel] as (() => string) | undefined;
  if (!render) throw new Error(`no master renderer for ${rel}`);
  return sheetTails(render());
}
function sheetTails(html: string): string[] {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => {
    const at = m[1]!.lastIndexOf("/css/");
    if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
    return m[1]!.slice(at + 1);
  });
}

describe("/vanilla/a11y/ — the accessibility exhibit, served (ADR-0008 §8)", () => {
  it("the registration shipped with the routes: a11y is served by vanilla, a singleton, nothing planned, no lab", () => {
    const controls = SURFACE_CONTROLS["a11y"]!;
    expect(controls.variants).toEqual(["vanilla"]);
    expect(controls.singleton).toBe(true);
    expect(controls.plannedVariants ?? []).toEqual([]);
    expect(controls.host).toBe("vanilla");
    // A singleton can never publish a lab table (ADR-0007 §5); the front build
    // refuses the flag by name, and this pins the registry side of that.
    expect(controls.labBundle).toBeUndefined();
  });

  for (const [rel, depth] of Object.entries(PAGES)) {
    it(`/vanilla/${rel}/ serves 200 with the canonical shell, the chrome injected for THIS page, and the a11y root`, async () => {
      const res = await get(`/vanilla/${rel}/`);
      // Status FIRST: a 404 body is a string too.
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toContain("text/html");
      const body = await res.text();
      expect(body).toContain('class="pm-a11y"');
      expect(body).toContain('<a class="pm-skip pm-button" href="#main">Skip to content</a>');
      // The chrome: exactly one, stamped for this page (a variant page, so
      // unlike how-it-was-built the instrument IS here — ADR-0004 §7 gives a
      // singleton no render-switcher, not no chrome).
      expect(count(body, 'data-pm-chrome="1"')).toBe(1);
      expect(body).toContain('data-pm-variant="vanilla"');
      expect(body).toContain('data-pm-surface="a11y"');
      // Singleton chrome: the plain-sentence reading section, no count, one
      // current cell and NO swap anchor — the switcher can never offer a cell
      // that does not exist.
      expect(body).toContain("No lab snapshot will exist for this page");
      expect(body).not.toContain("Served by ");
      const switcherRow = body.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
      expect(switcherRow, "the switcher row renders").not.toBe("");
      expect(switcherRow).toContain('aria-current="page">vanilla<');
      expect(switcherRow).not.toContain('<a class="pm-chrome__cell"');
      // The variant's one script at this page's depth, and the shell's footer
      // linking both singleton surfaces.
      expect(body).toContain(`<script src="${"../".repeat(depth)}assets/a11y.js" defer>`);
      expect(body).toContain('href="/vanilla/a11y/"');
      expect(body).toContain('href="/how-it-was-built/"');
    });

    it(`/vanilla/${rel}/ links exactly the master's stylesheets, in order, and every linked asset answers 200 from the variant's own tree`, async () => {
      const body = await (await get(`/vanilla/${rel}/`)).text();
      // The chrome injects its own stylesheet into <head> (/_pm/chrome.css) —
      // instrumentation, excluded by known path (ADR-0001 §6). Everything
      // else must be the master's list, in the master's order.
      const own = sheetTails(body.replace(/<link rel="stylesheet" href="\/_pm\/chrome\.css">/, ""));
      expect(own).toEqual(await masterSheetTails(rel));
      expect(own.length).toBeGreaterThan(5);

      // Every relative asset the page names resolves and answers 200 with a
      // plausible type: a missing copy of compare.css or mode-demo.css would
      // render an unstyled exhibit whose markup still matched the master.
      const pageUrl = new URL(`/vanilla/${rel}/`, ORIGIN);
      const hrefs = [...body.matchAll(/(?:href|src)="(\.\.\/[^"]+)"/g)].map((m) => m[1]!);
      expect(hrefs.length).toBeGreaterThan(8);
      for (const href of hrefs) {
        const url = new URL(href, pageUrl);
        expect(url.origin, href).toBe(pageUrl.origin);
        expect(url.pathname.startsWith("/vanilla/assets/"), `${href} left the variant's asset tree`).toBe(true);
        const res = await fetch(url);
        expect(res.status, `${href} → ${url.pathname}`).toBe(200);
        const type = res.headers.get("content-type") ?? "";
        if (href.endsWith(".css")) expect(type, href).toContain("text/css");
        if (href.endsWith(".js")) expect(type, href).toContain("javascript");
        if (href.endsWith(".woff2")) expect(type, href).toContain("woff2");
      }
      expect(hrefs.some((h) => h.endsWith("/a11y.js")), "the enhancement is linked").toBe(true);
    });
  }

  it("element-demos alone is noindex (strategy-review finding 21)", async () => {
    const ROBOTS = '<meta name="robots" content="noindex">';
    for (const rel of Object.keys(PAGES)) {
      const body = await (await get(`/vanilla/${rel}/`)).text();
      expect(count(body, ROBOTS), rel).toBe(rel === "a11y/element-demos" ? 1 : 0);
    }
  });

  it("every DS-off twin is served inside a CLOSED <details>, label first, compliant twin adjacent", async () => {
    const body = await (await get("/vanilla/a11y/element-demos/")).text();
    expect(count(body, '<details class="pm-compare__off">')).toBe(5);
    expect(count(body, "pm-compare__box--off")).toBe(5);
    expect(body).not.toMatch(/<details[^>]*\sopen[\s>]/);
    const sections = body.split('<section class="pm-compare"').slice(1);
    expect(sections.length).toBe(5);
    for (const section of sections) {
      const walkthrough = section.indexOf('class="pm-compare__walkthrough"');
      const onBox = section.indexOf('<div class="pm-compare__box">');
      const details = section.indexOf('<details class="pm-compare__off">');
      const offBox = section.indexOf("pm-compare__box--off");
      expect(walkthrough).toBeGreaterThan(-1);
      expect(walkthrough).toBeLessThan(onBox);
      expect(onBox).toBeLessThan(details);
      expect(details).toBeLessThan(offBox);
    }
  });

  it("mode-demos: three toggles served unpressed, each with the honesty caveat as content beside it", async () => {
    const body = await (await get("/vanilla/a11y/mode-demos/")).text();
    expect(count(body, 'class="pm-mode__toggle" type="button" aria-pressed="false"')).toBe(3);
    expect(body).not.toContain('aria-pressed="true"');
    expect(count(body, "your OS setting is the real thing — these demos never override it")).toBe(3);
    // The caveat is content (prompt duty 5): it sits in the page body, not in
    // the injected chrome — assert it survives with the chrome slot removed
    // from consideration by checking it appears BEFORE each toggle.
    const demos = body.split('<section class="pm-mode"').slice(1);
    expect(demos.length).toBe(3);
    for (const demo of demos) {
      expect(demo.indexOf('class="pm-mode__caveat"')).toBeLessThan(demo.indexOf('class="pm-mode__toggle"'));
      expect(demo.indexOf('class="pm-mode__toggle"')).toBeLessThan(demo.indexOf('class="pm-mode__stage"'));
    }
  });

  it("the footer link resolves from every served variant's editorial page and the store's hosts (the second footer 404, closed)", async () => {
    for (const variant of ["vanilla", "react-next", "astro", "qwik", "htmx", "remix3"]) {
      const res = await get(`/${variant}/editorial/`);
      expect(res.status, `/${variant}/editorial/`).toBe(200);
      expect(await res.text(), `/${variant}/editorial/ footer`).toContain('href="/vanilla/a11y/"');
    }
    expect(await (await get("/vanilla/checkout/")).text()).toContain('href="/vanilla/a11y/"');
    expect(await (await get("/react-next/plp/plain/")).text()).toContain('href="/vanilla/a11y/"');
    // A PDP, actually FETCHED (F-A9): the PDP is the surface behind most of
    // the footer links on the plane — one page per release, in four variants —
    // and vanilla's PDP footer is a THIRD independent re-typed copy of the
    // shell, distinct from the editorial and checkout copies asserted above.
    // The earlier draft named the PDP in this leg's own prose and never
    // requested one, so the copy behind the bulk of the links was the one
    // thing here that went unchecked.
    const snap = await loadServedSnapshot();
    for (const variant of ["vanilla", "react-next", "astro", "qwik"]) {
      const res = await get(`/${variant}/pdp/${snap.pdpDetail.slug}/`);
      expect(res.status, `/${variant}/pdp/${snap.pdpDetail.slug}/`).toBe(200);
      expect(await res.text(), `/${variant}/pdp/ footer`).toContain('href="/vanilla/a11y/"');
    }
    const target = await get("/vanilla/a11y/");
    expect(target.status).toBe(200);
  });

  it("the no-slash form redirects TO the slash form (slash normalisation, pinned as measured — the PDP rule)", async () => {
    const res = await fetch(`${ORIGIN}/vanilla/a11y`, { redirect: "manual" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/vanilla/a11y/");
  });

  it("home's PM-005 row links the served section on THIS origin, not a GitHub document", async () => {
    // ADR-0007 §4: rows update as surfaces land. The composed-origin leg
    // derives this row's state from the registry; this pins the href by name
    // (the PM-006 precedent) so it cannot rot back to the ADR link.
    const home = await (await get("/")).text();
    const rows = home.split('<li class="cat__row').slice(1);
    const row = rows.find((r) => r.includes(">Accessibility<"));
    expect(row, "home renders no Accessibility catalogue row").toBeDefined();
    const status = row!.match(/<p class="cat__status">([\s\S]*?)<\/p>/)?.[1] ?? "";
    expect(status, "PM-005 status").toContain("Public today");
    expect(status, "PM-005 must link the served surface").toContain('href="/vanilla/a11y/"');
    expect(status, "PM-005 must not send the visitor off-origin for a page this origin serves").not.toContain("github.com");
  });
});
