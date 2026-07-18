/**
 * Edge-injected chrome through the composed origin (issue #5; instrument
 * redesign, surface-design session 2026-07-17) — same seam: plain HTTP, no
 * Worker internals. The Playwright checks (JS-on HUD readout, JS-off
 * functionality, beacon firing) live in chrome.browser.test.ts.
 *
 * The redesigned contract this file pins:
 *  - the front Worker HEAD-APPENDS the instrument-mono preload + the
 *    chrome.css link (the in-body blocking/FOUC path is dead), and injects
 *    the fragment — `<aside id="pm-chrome" …>` … measure.js — into the
 *    documented `div#pm-chrome-slot`;
 *  - the switcher row is a `<nav>` of plain anchors, current cell marked
 *    `aria-current="page"`, never linked;
 *  - the chrome-owned instrument mono is served byte-identical from the
 *    /_pm/* excluded path (ADR-0001 §6);
 *  - `?profile=` selects a snapshot in the reading section ("lab profile")
 *    and every lab slot ships its C2 empty state until a run is published.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROFILE_IDS, PROFILES } from "@pm/measurement";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);

const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

/** The injected fragment, exactly as renderChrome emits it (aside → script). */
const extractFragment = (body: string) =>
  body.match(
    /<aside id="pm-chrome"[\s\S]*?<script src="\/_pm\/measure\.js" defer><\/script>/,
  )?.[0] ?? "";

describe("chrome injection (ADR-0004 §7)", () => {
  for (const variant of ["placeholder-static", "placeholder-ssr"]) {
    it(`${variant}: chrome injected exactly once, inside the slot, styles head-appended`, async () => {
      const body = await (await get(`/${variant}/sample/`)).text();
      expect(count(body, 'data-pm-chrome="1"')).toBe(1);
      // Injected INTO the documented slot, not appended elsewhere.
      expect(body).toContain('<div id="pm-chrome-slot"><aside id="pm-chrome"');
      // The stylesheet + instrument-mono preload ride in <head> (head-append:
      // the in-body blocking/FOUC path is dead) — exactly one of each, and
      // adjacent in the order the Worker appends them.
      const head = body.slice(0, body.indexOf("</head>"));
      expect(count(head, 'href="/_pm/chrome.css"')).toBe(1);
      expect(count(head, 'href="/_pm/fonts/PMInstrumentMono.var.woff2"')).toBe(1);
      expect(head).toContain(
        `<link rel="preload" href="/_pm/fonts/PMInstrumentMono.var.woff2" as="font" type="font/woff2" crossorigin>` +
          `<link rel="stylesheet" href="/_pm/chrome.css">`,
      );
      // …and only in <head>: the body carries no second copy.
      expect(count(body, 'href="/_pm/chrome.css"')).toBe(1);
      expect(count(body, "/_pm/fonts/PMInstrumentMono.var.woff2")).toBe(1);
    });
  }

  it("the chrome is byte-identical across variants (switcher cells aside)", async () => {
    // The ONLY legitimately variant-dependent parts are which switcher cell
    // is the current-marker vs a link, and the variant's own name where the
    // condition interpolates it (data-pm-variant, profile hrefs, the
    // condition list). Strip the switcher row and the rest must match
    // byte-for-byte after variant-name normalization; the switcher row must
    // offer the same cell set from both sides.
    const a = extractFragment(await (await get("/placeholder-static/sample/")).text());
    const b = extractFragment(await (await get("/placeholder-ssr/sample/")).text());
    expect(a).not.toBe("");

    const switcherRow =
      /<nav class="pm-chrome__switch" aria-label="Variant switcher" data-pm-switcher>[\s\S]*?<\/nav>/;
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
    // cache=cold bypasses the warm tier in BOTH directions: this probe must
    // not plant a canonical un-nonced KV entry on the deployed plane — the
    // fixture-era smoke's entry would outlive the crate re-seed and be
    // served to real visitors as a stale hit (issue #11; enforced by the
    // repo-checks warm-tier discipline guard).
    const api = await (await get("/api/plp?n=24&cache=cold")).text();
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

  it("the home surface at / stays free of INJECTED chrome (assets-first)", async () => {
    // Home is a singleton off the benchmarked matrix (ADR-0007): it carries
    // its own in-page HUD (same #pm-chrome contract measure.js reads) but is
    // served assets-first, so the front Worker's rewriter never touches it —
    // no injected-chrome marker, no slot, and no head-append (neither the
    // chrome stylesheet nor the instrument-mono preload).
    const body = await (await get("/")).text();
    expect(body).toContain('data-pm-surface="home"');
    expect(body).toContain('id="pm-chrome"');
    expect(body).not.toContain("data-pm-chrome");
    expect(body).not.toContain("pm-chrome-slot");
    expect(body).not.toContain("/_pm/chrome.css");
    expect(body).not.toContain("PMInstrumentMono");
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

  it("serves the instrument mono byte-identical to its @pm/switcher source", async () => {
    // The chrome-owned receipt/metric face (surface-design session): chrome
    // bytes on the known excluded path, identical on every platform — the
    // ADR-0003 §8 controlled-constant discipline applied to the instrument.
    const res = await get("/_pm/fonts/PMInstrumentMono.var.woff2");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("woff2");
    const source = readFileSync(
      join(repoRoot, "packages", "switcher", "fonts", "PMInstrumentMono.var.woff2"),
    );
    expect(Buffer.from(await res.arrayBuffer()).equals(source)).toBe(true);
  });

  it("the injected markup references instrumentation ONLY from /_pm/*", async () => {
    const body = await (await get("/placeholder-static/sample/")).text();
    expect(body).toContain('href="/_pm/chrome.css"');
    expect(count(body, '<script src="/_pm/measure.js"')).toBe(1);
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
    expect(body).toContain('aria-current="page">placeholder-ssr<');
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

describe("the reading's ?profile= selector (ADR-0004 §6)", () => {
  // The selector lives in the panel's reading section, labeled "lab profile",
  // beside what it selects — a snapshot selector, never a throttle.
  const profileRow = (body: string) =>
    body.match(
      /<span class="pm-chrome__key">lab profile<\/span>[\s\S]*?<\/p>/,
    )?.[0] ?? "";

  for (const id of PROFILE_IDS) {
    it(`?profile=${id} marks that profile selected with the empty state`, async () => {
      const body = await (await get(`/placeholder-static/sample/?profile=${id}`)).text();
      expect(body).toContain("No published runs yet");
      const row = profileRow(body);
      expect(count(row, 'aria-current="true"')).toBe(1);
      expect(row).toContain(`aria-current="true">${PROFILES[id].label}<`);
    });
  }

  it("no ?profile= still renders the reading with the empty state", async () => {
    const body = await (await get("/placeholder-static/sample/")).text();
    expect(body).toContain("No published runs yet");
    expect(body).toContain('data-pm-hud-live="LCP"');
    expect(count(profileRow(body), 'aria-current="true"')).toBe(1);
  });

  it("an unknown ?profile= falls back without breaking the page or the empty state", async () => {
    const res = await get("/placeholder-static/sample/?profile=warp-speed");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("No published runs yet");
    // Falls back to the default snapshot selection — still exactly one
    // selected cell, never a crash or an unmarked row.
    const row = profileRow(body);
    expect(count(row, 'aria-current="true"')).toBe(1);
    expect(row).toContain(
      `aria-current="true">${PROFILES["avg-broadband-desktop"].label}<`,
    );
  });
});
