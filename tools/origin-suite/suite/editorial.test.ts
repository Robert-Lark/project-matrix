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

/**
 * content-encoding as the wire carries it (composed-origin.test.ts helper).
 *
 * On the DEPLOYED plane a brand-new URL's first hit is a cache MISS, and
 * Cloudflare serves that MISS **uncompressed** — so a variant's first-ever
 * deploy would measure cache state instead of transport configuration. Slice C
 * failed its deploy on exactly this: `/astro/editorial/` reported `''` seconds
 * after pm-astro's first-ever deploy and `br` once warm, with response headers
 * byte-identical to vanilla's. Every later slice introduces a new URL the same
 * way, so this would be a guaranteed red deploy once per variant.
 *
 * So on the deployed plane (the only place compression is asserted) the URL is
 * warmed until an encoding appears, bounded. This does NOT weaken anything: if
 * compression never shows up, the empty string is returned and the caller's
 * assertion still fails. Successive curl round-trips supply the spacing, since
 * this helper is called from synchronous tests.
 */
function wireEncoding(path: string): string {
  const measure = () =>
    execFileSync(
      "curl",
      ["-s", "-o", "/dev/null", "-H", "Accept-Encoding: br, gzip",
        "-w", "%header{content-encoding}", `${ORIGIN}${path}`],
      { encoding: "utf8" },
    ).trim();

  let encoding = measure();
  if (!EXPECT_BROTLI) return encoding;
  for (let attempt = 0; attempt < 8 && encoding === ""; attempt += 1) {
    encoding = measure();
  }
  return encoding;
}

/** The reference renderer's escaping, for tray values asserted in raw HTML
 *  (vanilla re-implements this exact form — packages/reference/render/lib.mjs
 *  esc(), variants/vanilla/render.mjs esc()). */
const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** React's OWN text escaping (react-dom-server's escapeTextForBrowser) —
 *  identical to `esc` except the apostrophe: hex `&#x27;`, not decimal
 *  `&#39;` (verified against the installed react-dom source; both decode to
 *  the same character, so the drift gate's DOM-parsed comparisons are
 *  unaffected, but a RAW STRING .toContain() check on react-next's fetched
 *  body must match what React actually emits, not vanilla's hand-rolled
 *  form — verify-slice finding, editorial-build slice B). */
const reactEsc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

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

/**
 * /react-next/editorial/ — the second real variant, on the OpenNext
 * Cloudflare adapter (editorial-build slice B). Same duties as the vanilla
 * block above, adapted for a request-time SSR paradigm: fonts/CSS verbatim
 * modulo base path (absolute here, not relative — DIFF-TO-STARTER.md), the
 * registered noise actually observed in raw served HTML (the
 * composed-origin.test.ts placeholder-ssr precedent), and the cart
 * contract's key found in the page's own JS chunks (idiomatic React state,
 * not a script-tag data hook — there is no vanilla-style data hook here).
 */
describe("the react-next editorial page (canonical shell + composition)", () => {
  it("serves 200 with the shell in canonical order: skip link, chrome slot, page", async () => {
    const res = await get("/react-next/editorial/");
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
    expect(body).toContain('role="status"');
    expect(body).toContain('data-pm-status');
  });

  it("renders the RESOLVED snapshot's content — dateline and feature from committed trays", async () => {
    const snap = await loadServedSnapshot();
    const featured = snap.details.find((d) => d.id === editorialFeaturedId(snap));
    if (!featured) throw new Error("resolved snapshot lost its featured release");
    const body = await (await get("/react-next/editorial/")).text();
    expect(body).toContain(
      `frozen <time dateTime="${snap.manifest.capturedAt}">${snap.manifest.capturedAt}</time>`,
    );
    expect(body).toContain(reactEsc(featured.title));
    expect(body).toContain(reactEsc(featured.artist));
  });

  it("cross-surface links are the master's absolute designated-host targets (never dereferenced here)", async () => {
    const body = await (await get("/react-next/editorial/")).text();
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
    expect(controls.variants).toContain("react-next");
    expect(controls.plannedVariants).not.toContain("react-next");

    const body = await (await get("/react-next/editorial/")).text();
    expect(count(body, 'data-pm-chrome="1"')).toBe(1);
    expect(body).toContain('data-pm-variant="react-next"');
    expect(body).toContain('data-pm-surface="editorial"');
    expect(body).toContain('aria-current="page">react-next<');
    const live = controls.variants.length;
    const planned = live + (controls.plannedVariants?.length ?? 0);
    expect(body).toContain(`Served by ${live} of ${planned} planned variants today.`);
    const switcherRow =
      body.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(switcherRow).toContain('aria-current="page">react-next<');
    const anchorTargets = [...switcherRow.matchAll(/href="\/([^/"]+)\//g)]
      .map((m) => m[1])
      .sort();
    const otherLive = controls.variants.filter((v) => v !== "react-next").sort();
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
    // Absolute base path here (DIFF-TO-STARTER.md point 8) — vanilla's own
    // markup is relative, since only the base path is free to differ.
    const lines = canonical
      .split("\n")
      .filter((l) => l.startsWith("<link"))
      .map((l) => l.replaceAll("./node_modules/@pm/tokens", "/react-next/assets/pm"));
    expect(lines).toHaveLength(3);

    const body = await (await get("/react-next/editorial/")).text();
    const head = body.slice(0, body.indexOf("</head>"));
    let last = -1;
    for (const line of lines) {
      // Two tolerated JSX-renderer differences, neither a content change:
      // (1) React always serializes a bare boolean-ish attribute with an
      // explicit `=""` (`crossorigin` -> `crossorigin=""`) — DOM-equivalent
      // to the canonical file's bare form (both parse to an empty-string
      // attribute value). (2) React self-closes void elements
      // (`<link .../>` not `<link ...>`) — also DOM-equivalent. Neither is
      // raw-text equality a JSX renderer can produce for a hand-typed HTML
      // file, so the search string drops the closing `>` entirely (matches
      // whether what follows is `>` or `/>`).
      const jsxLine = line.replace("crossorigin>", 'crossorigin=""').slice(0, -1);
      const at = head.indexOf(jsxLine);
      expect(at, `canonical loading line missing or out of order: ${jsxLine}`).toBeGreaterThan(last);
      last = at;
    }
    expect(head).not.toMatch(/preload[^>]*PMWarnGlyph/);
  });

  it("font files and the tokens stylesheet arrive byte-identical to @pm/tokens", async () => {
    for (const font of [
      "FamiljenGrotesk.var.woff2",
      "PMCrateSymbols.woff2",
      "PMWarnGlyph.U26A0.woff2",
    ]) {
      const res = await get(`/react-next/assets/pm/fonts/${font}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("woff2");
      const source = readFileSync(join(repoRoot, "packages", "tokens", "fonts", font));
      expect(Buffer.from(await res.arrayBuffer()).equals(source), `${font} differs`).toBe(true);
    }
    for (const sheet of ["tokens.css", "fonts.css"]) {
      const css = await get(`/react-next/assets/pm/css/${sheet}`);
      expect(css.status).toBe(200);
      expect(await css.text()).toBe(
        readFileSync(join(repoRoot, "packages", "tokens", "css", sheet), "utf8"),
      );
    }
  });

  it("transport parity: react-next's editorial page matches the placeholder baseline (ADR-0001 §6)", () => {
    // Redundant with editorial.test.ts's generic "every LIVE editorial
    // variant" assertion (auto-extends via SURFACE_CONTROLS) — pinned here
    // too because this specific parity was a real local-dev gotcha
    // (DIFF-TO-STARTER.md point 16: `localhost` vs `127.0.0.1`), and this
    // suite always runs against `run-local.mjs`'s `127.0.0.1` origin.
    const encoding = wireEncoding("/react-next/editorial/");
    const baseline = wireEncoding("/placeholder-static/sample/");
    expect(encoding).toBe(baseline);
    if (EXPECT_BROTLI) expect(encoding).toBe("br");
  });

  it("react-next's registered noise is real: the App Router streaming marker is observed in raw served HTML", async () => {
    // The composed-origin.test.ts placeholder-ssr precedent: a noise
    // registration must be provably non-vacuous against the RAW served
    // bytes, not just asserted as policy.
    expect(PERMITTED_NOISE["react-next"]).toBeDefined();
    expect(PERMITTED_NOISE["react-next"]!.dropElementSelectors?.length).toBeGreaterThan(0);
    const body = await (await get("/react-next/editorial/")).text();
    expect(body).toContain("<div hidden");
    expect(body).toContain("<!--$--><!--/$-->");
    // Content-aware, not just positional (verify-slice finding): this
    // wrapper is Next's App Router streaming-metadata boundary (any
    // `generateMetadata()` output that doesn't auto-hoist to <head> — an
    // icon, an alternate link — renders INSIDE it). The registered
    // dropElementSelectors excuses it only because it is EMPTY today (this
    // page's metadata is title-only, and <title> auto-hoists regardless of
    // tree position); the exact-substring match below fails loudly the
    // moment that stops being true, rather than silently letting the
    // normalizer erase real markup before the drift gate ever compares it.
    expect(body).toContain('<div hidden=""><!--$--><!--/$--></div>');
  });

  it("the cart enhancement carries the contract's key in its own JS, served with the canonical empty state", async () => {
    const shell = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "shell.mjs")).href
    );
    const body = await (await get("/react-next/editorial/")).text();
    // No vanilla-style script-tag data hook here (idiomatic React state,
    // DIFF-TO-STARTER.md point 10) — the contract key lives in whichever
    // JS chunk bundles src/lib/cart.ts; chunk names are build hashes, so
    // discover them from the served page rather than hardcoding one.
    const chunkPaths = [...body.matchAll(/src="(\/react-next\/_next\/static\/chunks\/[^"]+)"/g)]
      .map((m) => m[1]!);
    expect(chunkPaths.length).toBeGreaterThan(0);
    let found = false;
    for (const path of chunkPaths) {
      const js = await (await get(path)).text();
      if (js.includes(`"${shell.CART_CONTRACT.key}"`)) {
        found = true;
        break;
      }
    }
    expect(found, "no served JS chunk carries the CART_CONTRACT key").toBe(true);
    // Canonical served state: the masthead count slot is EMPTY (§7) and the
    // cart anchor carries no aria-label (count 0 removes the attribute).
    expect(body).toContain(
      '<span class="pm-masthead__cart-count" data-pm-cart-count="" aria-hidden="true"></span>',
    );
    expect(body).toMatch(/<a class="pm-masthead__cart" href="\/vanilla\/checkout\/">/);
  });
});

/**
 * /astro/editorial/ — the third real variant: the islands paradigm, static
 * output, no adapter (editorial-build slice C). Same duties as the two blocks
 * above, with the differences this paradigm actually has:
 *
 *  - fonts/CSS verbatim modulo base path, ABSOLUTE like react-next's (the base
 *    is `/astro/`, derived from astro.config.mjs via `import.meta.env.BASE_URL`)
 *    — but unlike react-next, byte-exact: Astro renders a bare `crossorigin`
 *    and does not self-close void elements, so the canonical lines match as
 *    written rather than needing JSX-shaped tolerances;
 *  - the SAME `esc` vanilla uses, not a second escaper: Astro escapes through
 *    `html-escaper`, which is byte-identical to the reference renderer's own
 *    `esc()` (apostrophe included — `&#39;`, decimal, where React emits
 *    `&#x27;`);
 *  - NO permitted-noise registration at all, which is a MEASURED fact about
 *    this page and is asserted as such (see the drift leg for the raw-bytes
 *    half of the same proof);
 *  - the cart contract's key in the page's own bundled module script — Astro
 *    processes a bare `<script>` (TypeScript, imports, `type="module"`), and
 *    the release it adds rides a JSON script element, both of which are
 *    delivery rather than contract (ADR-0008's freedoms name `script`).
 */
describe("the astro editorial page (canonical shell + composition)", () => {
  it("serves 200 with the shell in canonical order: skip link, chrome slot, page", async () => {
    const res = await get("/astro/editorial/");
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
    const body = await (await get("/astro/editorial/")).text();
    // The dateline IS the manifest's freeze date (ADR-0008 §8) — asserted from
    // the resolved committed manifest, never a literal. Astro emits the
    // lowercase `datetime` attribute the master has (React's JSX prop is
    // `dateTime`, which is why slice B's version of this assertion differs).
    expect(body).toContain(
      `frozen <time datetime="${snap.manifest.capturedAt}">${snap.manifest.capturedAt}</time>`,
    );
    expect(body).toContain(esc(featured.title));
    expect(body).toContain(esc(featured.artist));
  });

  it("cross-surface links are the master's absolute designated-host targets (never dereferenced here)", async () => {
    const body = await (await get("/astro/editorial/")).text();
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
    expect(controls.variants).toContain("astro");
    expect(controls.plannedVariants).not.toContain("astro");

    const body = await (await get("/astro/editorial/")).text();
    expect(count(body, 'data-pm-chrome="1"')).toBe(1);
    expect(body).toContain('data-pm-variant="astro"');
    expect(body).toContain('data-pm-surface="editorial"');
    expect(body).toContain('aria-current="page">astro<');
    const live = controls.variants.length;
    const planned = live + (controls.plannedVariants?.length ?? 0);
    expect(body).toContain(`Served by ${live} of ${planned} planned variants today.`);
    const switcherRow =
      body.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(switcherRow).toContain('aria-current="page">astro<');
    const anchorTargets = [...switcherRow.matchAll(/href="\/([^/"]+)\//g)]
      .map((m) => m[1])
      .sort();
    const otherLive = controls.variants.filter((v) => v !== "astro").sort();
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
    // Absolute base path, like react-next's — but matched VERBATIM, no
    // renderer-shaped tolerances: Astro emits `crossorigin` bare and does not
    // self-close void elements, so these lines survive byte-for-byte.
    const lines = canonical
      .split("\n")
      .filter((l) => l.startsWith("<link"))
      .map((l) => l.replaceAll("./node_modules/@pm/tokens", "/astro/assets/pm"));
    expect(lines).toHaveLength(3);

    const body = await (await get("/astro/editorial/")).text();
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
      const res = await get(`/astro/assets/pm/fonts/${font}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("woff2");
      const source = readFileSync(join(repoRoot, "packages", "tokens", "fonts", font));
      expect(Buffer.from(await res.arrayBuffer()).equals(source), `${font} differs`).toBe(true);
    }
    // Astro's public/ directory is the one delivery route that leaves these
    // untouched: importing them as stylesheets would let Vite hash the files
    // and rewrite fonts.css's own @font-face URLs, failing both halves of
    // ADR-0003 §8 at once.
    for (const sheet of ["tokens.css", "fonts.css"]) {
      const css = await get(`/astro/assets/pm/css/${sheet}`);
      expect(css.status).toBe(200);
      expect(await css.text()).toBe(
        readFileSync(join(repoRoot, "packages", "tokens", "css", sheet), "utf8"),
      );
    }
  });

  it("every asset the page references resolves through the composed origin (the base-path proof)", async () => {
    // The front Worker forwards the ORIGINAL request and never rewrites paths,
    // so this variant's own prefix is its own responsibility: `base: "/astro"`
    // in astro.config.mjs must agree with `outDir: "./dist/astro"` or every
    // Astro-generated URL 404s while the HTML still serves 200. That includes
    // the bundled module script, whose name is a build hash — so the set is
    // DERIVED from the served page, not hardcoded.
    const body = await (await get("/astro/editorial/")).text();
    const refs = [
      ...body.matchAll(/(?:href|src)="(\/astro\/[^"]+)"/g),
    ].map((m) => m[1]!);
    // The 9 stylesheets + 2 font preloads at minimum; a bundled script joins
    // them whenever Astro emits it as a file rather than inlining it.
    expect(refs.length).toBeGreaterThanOrEqual(11);
    for (const ref of new Set(refs)) {
      const res = await get(ref);
      expect(res.status, `${ref} did not resolve`).toBe(200);
    }
  });

  it("transport parity: astro's editorial page matches the placeholder baseline (ADR-0001 §6)", () => {
    const encoding = wireEncoding("/astro/editorial/");
    const baseline = wireEncoding("/placeholder-static/sample/");
    expect(encoding).toBe(baseline);
    if (EXPECT_BROTLI) expect(encoding).toBe("br");
  });

  it("astro registers NO permitted noise — a measured result, and non-vacuously so", async () => {
    // Both of Astro's noise species are opt-in and this page opts into
    // neither: `data-astro-cid-*` scoping attributes appear only on components
    // that carry a `<style>` block (the design system arrives as plain <link>s
    // instead), and `<astro-island>` wrappers appear only around framework
    // components given a `client:*` directive (the one interaction is a plain
    // bundled script). The drift leg compares this page under NO_NOISE, which
    // is what makes the claim load-bearing rather than decorative.
    expect(PERMITTED_NOISE["astro"]).toBeUndefined();
    const body = await (await get("/astro/editorial/")).text();
    expect(body).not.toMatch(/data-astro-cid-/);
    expect(body).not.toContain("<astro-island");
  });

  it("the cart enhancement carries the contract's key in its own bundled script, with the canonical empty state", async () => {
    const shell = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "shell.mjs")).href
    );
    const body = await (await get("/astro/editorial/")).text();

    // Astro processes a bare <script> into a `type="module"` bundle, and
    // inlines it when it is small enough — so the contract key is either in
    // the page itself or in a module file the page references. Discover which
    // from the served bytes rather than assuming either shape. The quote
    // character is the minifier's call (esbuild emits backticks here), so all
    // three are accepted; the key itself carries no regex metacharacters.
    const quoted = new RegExp(`["'\`]${shell.CART_CONTRACT.key}["'\`]`);
    let found = quoted.test(body);
    if (!found) {
      const moduleSrcs = [...body.matchAll(/<script[^>]+src="(\/astro\/[^"]+)"/g)].map(
        (m) => m[1]!,
      );
      expect(moduleSrcs.length).toBeGreaterThan(0);
      for (const src of moduleSrcs) {
        const js = await (await get(src)).text();
        if (quoted.test(js)) {
          found = true;
          break;
        }
      }
    }
    expect(found, "no served JS carries the CART_CONTRACT key").toBe(true);

    // The release the button adds rides a JSON script element — delivery, not
    // contract (ADR-0008 freedoms), so the canonical DOM stays clean. Astro
    // leaves a <script> with any attribute other than `src` untouched, which
    // is what keeps this a plain data hook rather than a bundled module.
    const snap = await loadServedSnapshot();
    const featuredId = editorialFeaturedId(snap);
    expect(body).toContain('<script type="application/json" id="pm-cart-item">');
    expect(body).toContain(`{"id":${featuredId},`);

    // Canonical served state: the masthead count slot is EMPTY (§7) and the
    // cart anchor carries no aria-label (count 0 removes the attribute).
    // Astro emits the bare boolean attribute the master has.
    expect(body).toContain(
      '<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span>',
    );
    expect(body).toMatch(/<a class="pm-masthead__cart" href="\/vanilla\/checkout\/">/);
  });
});
