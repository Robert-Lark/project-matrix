/**
 * Edge-injected chrome through the composed origin (issue #5) — same seam:
 * plain HTTP, no Worker internals. The Playwright checks (JS-on HUD readout,
 * JS-off functionality, beacon firing) live in chrome.browser.test.ts.
 */
import { describe, expect, it } from "vitest";
import { PROFILE_IDS } from "@pm/measurement";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);

const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

describe("chrome injection (ADR-0004 §7)", () => {
  for (const variant of ["placeholder-static", "placeholder-ssr"]) {
    it(`${variant}: chrome injected exactly once, inside the slot`, async () => {
      const body = await (await get(`/${variant}/sample/`)).text();
      expect(count(body, 'data-pm-chrome="1"')).toBe(1);
      // Injected INTO the documented slot, not appended elsewhere.
      expect(body).toMatch(/<div id="pm-chrome-slot">\s*<link rel="stylesheet" href="\/_pm\/chrome\.css">/);
      // Chrome is byte-identical across variants by construction — modulo
      // the variant's own name in the markup.
      expect(body).toContain('id="pm-chrome"');
    });
  }

  it("the chrome is byte-identical across variants (switcher cells aside)", async () => {
    // The ONLY legitimately variant-dependent part is which switcher cell is
    // the current-marker vs a link (position follows config order). Strip
    // the switcher row and the rest must match byte-for-byte after
    // variant-name normalization; the switcher row must offer the same cell
    // set from both sides.
    const extract = (body: string) =>
      body.match(/<link rel="stylesheet" href="\/_pm\/chrome\.css">[\s\S]*?<script src="\/_pm\/measure\.js" defer><\/script>/)?.[0] ?? "";
    const a = extract(await (await get("/placeholder-static/sample/")).text());
    const b = extract(await (await get("/placeholder-ssr/sample/")).text());
    expect(a).not.toBe("");

    const switcherRow = /<div class="pm-chrome__row" data-pm-switcher>[\s\S]*?<\/div>/;
    const normalize = (s: string) =>
      s.replaceAll("placeholder-static", "V").replaceAll("placeholder-ssr", "V");
    expect(normalize(a.replace(switcherRow, ""))).toBe(
      normalize(b.replace(switcherRow, "")),
    );

    const cells = (s: string) =>
      (s.match(switcherRow)?.[0].match(/>(placeholder-[a-z]+)</g) ?? []).sort();
    expect(cells(a)).toEqual(cells(b));
    expect(cells(a)).toHaveLength(2);
  });

  it("non-HTML responses stay untouched with the rewriter active", async () => {
    const css = await (await get("/placeholder-static/assets/pm/css/tokens.css")).text();
    expect(css).not.toContain("pm-chrome");
    const api = await (await get("/api/plp?n=24")).text();
    expect(api).not.toContain("pm-chrome");
  });

  it("fidelity survives the rewriter: injected HTML still carries query + upstream headers", async () => {
    const res = await get("/placeholder-ssr/sample/?n=240&cache=cold", {
      headers: { "x-pm-probe": "rewriter-fidelity" },
    });
    const body = await res.text();
    expect(count(body, 'data-pm-chrome="1"')).toBe(1); // injection active on THIS response
    expect(res.headers.get("x-pm-ssr")).toBe("1");
    expect(res.headers.get("x-pm-echo-search")).toBe("?n=240&cache=cold");
    expect(res.headers.get("x-pm-echo-probe")).toBe("rewriter-fidelity");
  });

  it("the throwaway index at / stays chrome-free (assets-first)", async () => {
    const body = await (await get("/")).text();
    expect(body).toContain("PM-INDEX-MARKER");
    expect(body).not.toContain("data-pm-chrome");
  });
});

describe("the /_pm/* instrumentation path (ADR-0001 §6)", () => {
  it("serves the chrome stylesheet and the pinned measurement bundle", async () => {
    const css = await get("/_pm/chrome.css");
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toContain("css");
    expect(await css.text()).toContain("#pm-chrome");

    const js = await get("/_pm/measure.js");
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toContain("javascript");
    const bundle = await js.text();
    expect(bundle).toContain("/api/beacon");
  });

  it("the injected markup references instrumentation ONLY from /_pm/*", async () => {
    const body = await (await get("/placeholder-static/sample/")).text();
    expect(body).toContain('href="/_pm/chrome.css"');
    expect(body).toContain('src="/_pm/measure.js"');
    // The chrome brings exactly one script — the measurement bundle.
    expect(count(body, "<script")).toBe(1);
  });
});

describe("switcher semantics (ADR-0004 §4–§5, §7)", () => {
  it("anchors rewrite only the variant segment, preserving surface + query", async () => {
    const body = await (await get("/placeholder-static/sample/?n=240&cache=cold")).text();
    expect(body).toContain('href="/placeholder-ssr/sample/?n=240&amp;cache=cold"');
  });

  it("offers only the mapped variants; current variant is marked, not linked", async () => {
    const body = await (await get("/placeholder-ssr/sample/")).text();
    expect(body).toContain('aria-current="true">placeholder-ssr<');
    expect(body).toContain('href="/placeholder-static/sample/"');
    for (const never of ["vanilla", "react-next", "astro", "qwik", "htmx"]) {
      expect(body).not.toContain(`href="/${never}/`);
    }
  });

  it("switcher anchors carry no script payload", async () => {
    const body = await (await get("/placeholder-static/sample/")).text();
    expect(body).not.toMatch(/<a [^>]*on[a-z]+=/i);
    expect(body).not.toContain('href="javascript:');
  });
});

describe("HUD ?profile= (ADR-0004 §6)", () => {
  for (const id of PROFILE_IDS) {
    it(`?profile=${id} marks that profile selected with the empty state`, async () => {
      const body = await (await get(`/placeholder-static/sample/?profile=${id}`)).text();
      expect(body).toContain("No published runs yet");
      const hud = body.match(/data-pm-hud>[\s\S]*?<\/div>/)?.[0] ?? "";
      expect(count(hud, 'aria-current="true"')).toBe(1);
    });
  }

  it("no ?profile= still renders the HUD with the empty state", async () => {
    const body = await (await get("/placeholder-static/sample/")).text();
    expect(body).toContain("No published runs yet");
    expect(body).toContain('data-pm-hud-live="LCP"');
  });
});
