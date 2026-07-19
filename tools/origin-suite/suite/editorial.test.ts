/**
 * /vanilla/editorial/ — the first REAL variant page through the composed
 * origin (editorial-build slice A). Same seam as composed-origin.test.ts:
 * plain HTTP, outside-in. What this file pins:
 *
 *  - the canonical shell order (skip link FIRST, then the chrome slot,
 *    then .pm-page) and the master's absolute designated-host cross-surface
 *    links — WITHOUT dereferencing the targets that 404 until their builds
 *    land (the PRD forbids requiring them to resolve);
 *  - content renders from the RESOLVED snapshot's committed trays
 *    (issue-#11 pattern) — the same assertions hold for the fixture in CI
 *    and the crate on the deployed plane;
 *  - fonts as the controlled constant (ADR-0003 §8): the canonical loading
 *    markup verbatim modulo base path, files byte-identical to @pm/tokens;
 *  - the chrome stamped for this page, the serving cell aria-current, and
 *    every count recounted from SURFACE_CONTROLS' own arrays — never typed;
 *  - vanilla as the permitted-noise registry's NO_NOISE control (nothing
 *    registered; the drift leg compares under NO_NOISE);
 *  - the cart enhancement served and carrying the CART_CONTRACT key (the
 *    behavior itself is exercised JS-on in cart.browser.test.ts).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { PERMITTED_NOISE } from "@pm/drift-gate";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { editorialFeaturedId, loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const EXPECT_BROTLI = process.env.PM_EXPECT_BROTLI === "1";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const get = (path: string) => fetch(`${ORIGIN}${path}`);
const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

/** content-encoding as the wire carries it (composed-origin.test.ts helper). */
function wireEncoding(path: string): string {
  return execFileSync(
    "curl",
    ["-s", "-o", "/dev/null", "-H", "Accept-Encoding: br, gzip",
      "-w", "%header{content-encoding}", `${ORIGIN}${path}`],
    { encoding: "utf8" },
  ).trim();
}

/** The reference renderer's escaping, for tray values asserted in raw HTML. */
const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

describe("the vanilla editorial page (canonical shell + composition)", () => {
  it("serves 200 with the shell in canonical order: skip link, chrome slot, page", async () => {
    const res = await get("/vanilla/editorial/");
    expect(res.status).toBe(200);
    const body = await res.text();
    const skip = body.indexOf('class="pm-skip');
    const slot = body.indexOf('id="pm-chrome-slot"');
    const page = body.indexOf('class="pm-page"');
    expect(skip).toBeGreaterThan(-1);
    expect(slot).toBeGreaterThan(skip);
    expect(page).toBeGreaterThan(slot);
    expect(count(body, 'id="pm-chrome-slot"')).toBe(1);
    expect(body).toContain('<article class="pm-editorial">');
    expect(body).toContain('role="status" data-pm-status');
  });

  it("renders the RESOLVED snapshot's content — dateline and feature from committed trays", async () => {
    const snap = await loadServedSnapshot();
    const featured = snap.details.find((d) => d.id === editorialFeaturedId(snap));
    if (!featured) throw new Error("resolved snapshot lost its featured release");
    const body = await (await get("/vanilla/editorial/")).text();
    // The dateline IS the manifest's freeze date (ADR-0008 §8) — asserted
    // from the resolved committed manifest, never a literal.
    expect(body).toContain(
      `frozen <time datetime="${snap.manifest.capturedAt}">${snap.manifest.capturedAt}</time>`,
    );
    expect(body).toContain(esc(featured.title));
    expect(body).toContain(esc(featured.artist));
  });

  it("cross-surface links are the master's absolute designated-host targets (never dereferenced here)", async () => {
    const body = await (await get("/vanilla/editorial/")).text();
    // Unbuilt targets 404 by design until their builds land — the assertion
    // is the HREF, deliberately not the response (editorial-build PRD).
    expect(body).toContain('href="/react-next/plp/plain/"');
    expect(body).toContain('href="/vanilla/editorial/" aria-current="page"');
    expect(body).toContain('href="/vanilla/checkout/"');
    expect(body).toContain('href="/vanilla/a11y/"');
    expect(body).toContain('href="/how-it-was-built/"');
    expect(body).toContain('href="/vanilla/pdp/');
  });

  it("chrome injected: stamped for this page, serving cell current, counts from the arrays", async () => {
    const controls = SURFACE_CONTROLS["editorial"]!;
    // The registration move is part of this build's definition of done.
    expect(controls.variants).toContain("vanilla");
    expect(controls.plannedVariants).not.toContain("vanilla");

    const body = await (await get("/vanilla/editorial/")).text();
    expect(count(body, 'data-pm-chrome="1"')).toBe(1);
    expect(body).toContain('data-pm-variant="vanilla"');
    expect(body).toContain('data-pm-surface="editorial"');
    expect(body).toContain('aria-current="page">vanilla<');
    // "Served by N of M" recounts from the config's own arrays (chrome.ts) —
    // this expectation recounts them the same way, so nothing here is typed.
    const live = controls.variants.length;
    const planned = live + (controls.plannedVariants?.length ?? 0);
    expect(body).toContain(`Served by ${live} of ${planned} planned variants today.`);
    // Unbuilt cells stay disclosures: dead labeled headers in the reading
    // table, never switcher anchors. Scoped to the switcher row — the
    // masthead's designated-host links (e.g. Records → /react-next/plp/…)
    // legitimately anchor to a planned variant's OTHER surface. The anchor
    // set is DERIVED from the arrays (live variants render as anchors by
    // design), so this holds unchanged as B–F register.
    const switcherRow =
      body.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(switcherRow).toContain('aria-current="page">vanilla<');
    const anchorTargets = [...switcherRow.matchAll(/href="\/([^/"]+)\//g)]
      .map((m) => m[1])
      .sort();
    const otherLive = controls.variants.filter((v) => v !== "vanilla").sort();
    expect(anchorTargets).toEqual(otherLive);
    for (const v of controls.plannedVariants ?? []) {
      expect(body).toContain(`${v}<span class="pm-chrome__note"> not built yet</span>`);
      expect(switcherRow).not.toContain(v);
    }
  });

  it("fonts: the canonical loading markup verbatim modulo base path (ADR-0003 §8)", async () => {
    const canonical = readFileSync(
      join(repoRoot, "packages", "tokens", "fonts", "loading-markup.html"),
      "utf8",
    );
    const lines = canonical
      .split("\n")
      .filter((l) => l.startsWith("<link"))
      .map((l) => l.replaceAll("./node_modules/@pm/tokens", "../assets/pm"));
    expect(lines).toHaveLength(3);

    const body = await (await get("/vanilla/editorial/")).text();
    const head = body.slice(0, body.indexOf("</head>"));
    let last = -1;
    for (const line of lines) {
      const at = head.indexOf(line);
      expect(at, `canonical loading line missing or out of order: ${line}`).toBeGreaterThan(last);
      last = at;
    }
    // PMWarnGlyph is served but never preloaded (error-state-only glyph).
    expect(head).not.toMatch(/preload[^>]*PMWarnGlyph/);
  });

  it("font files and the tokens stylesheet arrive byte-identical to @pm/tokens", async () => {
    for (const font of [
      "FamiljenGrotesk.var.woff2",
      "PMCrateSymbols.woff2",
      "PMWarnGlyph.U26A0.woff2",
    ]) {
      const res = await get(`/vanilla/assets/pm/fonts/${font}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("woff2");
      const source = readFileSync(join(repoRoot, "packages", "tokens", "fonts", font));
      expect(Buffer.from(await res.arrayBuffer()).equals(source), `${font} differs`).toBe(true);
    }
    // tokens.css AND fonts.css: the loading half of "fonts are a controlled
    // constant" (ADR-0003 §8) — an edited fonts.css copy (font-display, a
    // widened unicode-range) would pass the file checks above and the
    // settled-pixels gate both, so it is byte-pinned here.
    for (const sheet of ["tokens.css", "fonts.css"]) {
      const css = await get(`/vanilla/assets/pm/css/${sheet}`);
      expect(css.status).toBe(200);
      expect(await css.text()).toBe(
        readFileSync(join(repoRoot, "packages", "tokens", "css", sheet), "utf8"),
      );
    }
  });

  it("transport parity extends to every LIVE editorial variant page (ADR-0001 §6)", () => {
    // composed-origin.test.ts pins parity for the placeholder pages; the
    // real variant pages every benchmark KB rides must not ship with
    // unasserted wire encoding. Derived from the live arrays, so B–F join
    // this assertion by registering.
    const controls = SURFACE_CONTROLS["editorial"]!;
    const encodings = controls.variants.map((v) => ({
      variant: v,
      encoding: wireEncoding(`/${v}/editorial/`),
    }));
    const baseline = wireEncoding("/placeholder-static/sample/");
    for (const { variant, encoding } of encodings) {
      expect(encoding, `content-encoding for /${variant}/editorial/`).toBe(baseline);
      if (EXPECT_BROTLI) expect(encoding).toBe("br");
    }
  });

  it("vanilla is the NO_NOISE control: nothing registered in PERMITTED_NOISE", () => {
    // The drift leg (drift.browser.test.ts) compares this page under
    // NO_NOISE — zero stripping — which is what makes the control real;
    // this pins the registry side of the same fact.
    expect(PERMITTED_NOISE["vanilla"]).toBeUndefined();
  });

  it("the cart enhancement is served and carries the contract's key; the page ships its data hook as delivery", async () => {
    const shell = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "shell.mjs")).href
    );
    const res = await get("/vanilla/assets/cart.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    const cartJs = await res.text();
    expect(cartJs).toContain(`"${shell.CART_CONTRACT.key}"`);

    const body = await (await get("/vanilla/editorial/")).text();
    // Both hooks are script elements — delivery, not contract (ADR-0008
    // freedoms), so the canonical DOM stays clean.
    expect(body).toContain('<script type="application/json" id="pm-cart-item">');
    expect(body).toContain('<script src="../assets/cart.js" defer></script>');
    // Canonical served state: the masthead count slot is EMPTY (§7).
    expect(body).toContain(
      '<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span>',
    );
  });
});
