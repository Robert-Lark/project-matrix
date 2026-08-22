/**
 * /{variant}/pdp/{slug}/ — the PDP served through the composed origin
 * (pdp-variants; the vanilla legs were owed by pdp-build, which shipped the
 * variant with no serving assertions at all). Same seam as editorial.test.ts:
 * plain HTTP, outside-in. What this file pins, per live PDP variant:
 *
 *  - the canonical shell order and slot cardinality on a CATALOGUE surface
 *    (hundreds of URLs, not one), driven by slugs derived from the RESOLVED
 *    snapshot — never named;
 *  - content from the resolved snapshot's committed trays: title, artist,
 *    price, stock, the full format COMPOSITION (ADR-0008 addendum A — data,
 *    never a control), each re-derived through the reference renderer's own
 *    rules;
 *  - the degenerate arms as served pages: unpriced (named em-dash, "none for
 *    sale", disabled CTA) and one-image (no thumb list);
 *  - the URL contract: a non-canonical slug is a 404, NEVER a redirect — a
 *    canonical 301 was rejected because build-time variants cannot serve one
 *    (an observable behavioural divergence between paradigms);
 *  - exactly ONE fenced subtree — the live-origin plaque is CANONICAL master
 *    content on this surface (unlike editorial, whose core pages must carry
 *    zero);
 *  - the chrome stamped for this page with counts recounted from
 *    SURFACE_CONTROLS' own arrays, and switcher anchors preserving the
 *    /pdp/{slug}/ condition across the variant swap;
 *  - the stylesheet list: exactly the master's sheets, in the master's order
 *    (cascade order is a rendering property), compared by tail after /css/.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { loadServedSnapshot, type ServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const EXPECT_BROTLI = process.env.PM_EXPECT_BROTLI === "1";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const get = (path: string) => fetch(`${ORIGIN}${path}`);
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** The variants this file writes serving describes for. The completeness
 *  test below ties it to SURFACE_CONTROLS.pdp.variants — the registry of
 *  record — so a variant cannot move planned → variants without gaining a
 *  serving describe here (the ADR-0008 addendum A §4c discipline: a guard
 *  must fail when the registry outgrows it, never keep reporting green on
 *  the variants it already knows). */
const DESCRIBED_VARIANTS = ["vanilla", "react-next"] as const;

/** content-encoding as the wire carries it (editorial.test.ts's helper —
 *  same warm-until-encoded loop on the deployed plane, same reason: a
 *  brand-new URL's first hit is an uncompressed cache MISS). */
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

describe("the PDP serving describes cover every live variant", () => {
  it("SURFACE_CONTROLS.pdp.variants equals the set this file describes", () => {
    expect([...SURFACE_CONTROLS["pdp"]!.variants].sort()).toEqual(
      [...DESCRIBED_VARIANTS].sort(),
    );
  });
});

/** The reference renderer's escaping (vanilla and astro emit this form). */
const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** React's own text escaping — identical except the apostrophe (`&#x27;`,
 *  hex). A raw-string check on react-next's bytes must match what React
 *  emits (editorial.test.ts's recorded lesson). */
const reactEsc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

/** The reference formatting rules, imported from the rules of record rather
 *  than re-typed here (lib.mjs is build tooling with no side effects on
 *  import — the drift suite's own pattern). */
async function referenceLib() {
  return import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
  ) as Promise<{
    formatPrice: (p: unknown) => string | null;
    stockLine: (n: number) => string;
    formatComposition: (formats: unknown[]) => string;
  }>;
}

/** Slugs for the arms this file exercises, derived from the SERVED snapshot
 *  (the suite's standing rule: derived, never named). Fails closed if an arm
 *  is missing — a snapshot that cannot exercise an arm must fail the suite,
 *  not skip it (the pdp-controls.browser.test.ts discipline).
 *
 *  `rich` is derived as a PRICED gallery-and-tracklist release, NOT reused
 *  from `snap.pdpDetail` — verify-slice caught the first draft doing exactly
 *  that: the fixture's pdpDetail (first ≥2-images + tracklist release,
 *  9000001) is UNPRICED, so the "rich" arm and the unpriced arm were the
 *  same page in CI, the price assertion was guarded into silence, and no leg
 *  ever asserted an ENABLED Add-to-cart CTA — a variant shipping every CTA
 *  disabled would have passed this file on the fixture. */
function armSlugs(snap: ServedSnapshot) {
  const rich = snap.details.find(
    (d) => d.priceFrom != null && d.images.length > 1 && d.tracklist.length > 0,
  );
  const unpriced = snap.details.find((d) => d.priceFrom == null && d.images.length > 1);
  const oneImage = snap.details.find((d) => d.images.length === 1);
  if (!rich) throw new Error("[pdp] served snapshot has no priced gallery+tracklist release");
  if (!unpriced) throw new Error("[pdp] served snapshot has no unpriced multi-image release");
  if (!oneImage) throw new Error("[pdp] served snapshot has no one-image release");
  return { rich, unpriced, oneImage };
}

/** The master's PDP stylesheet tails, in order, read from the committed
 *  fixture master (the list is snapshot-independent). */
function masterSheetTails(): string[] {
  const master = readFileSync(
    join(repoRoot, "packages", "reference", "surfaces", "pdp", "index.html"),
    "utf8",
  );
  return [...master.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => {
    const at = m[1]!.lastIndexOf("/css/");
    if (at === -1) throw new Error(`master stylesheet outside the css tree: ${m[1]}`);
    return m[1]!.slice(at + 1);
  });
}

function sheetTails(body: string): string[] {
  const head = body.slice(0, body.indexOf("</head>"));
  return [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)]
    .map((m) => m[1]!)
    // The front Worker head-appends /_pm/chrome.css — instrumentation, kept
    // strippable by known path (ADR-0001 §6), never part of the variant's
    // own sheet list.
    .filter((href) => !href.startsWith("/_pm/"))
    .map((href) => {
      const at = href.lastIndexOf("/css/");
      if (at === -1) throw new Error(`stylesheet href outside the css tree: ${href}`);
      return href.slice(at + 1);
    });
}

/** Shell-order + slot-cardinality + fence-cardinality assertions every live
 *  PDP variant must satisfy on every page this file opens. */
function assertPdpShell(body: string) {
  const skip = body.indexOf('class="pm-skip');
  const slot = body.indexOf('id="pm-chrome-slot"');
  const page = body.indexOf('class="pm-page"');
  expect(skip).toBeGreaterThan(-1);
  expect(slot).toBeGreaterThan(skip);
  expect(page).toBeGreaterThan(slot);
  expect(count(body, 'id="pm-chrome-slot"')).toBe(1);
  expect(body).toContain('<article class="pm-pdp">');
  expect(body).toContain('role="status"');
  expect(body).toContain("data-pm-status");
  // Exactly ONE fenced subtree: the live-origin plaque is canonical master
  // content on this surface (ADR-0002 §3's mandatory copy rides it). The
  // needle is the HTML-attribute form — react-next's RSC payload repeats the
  // bare attribute NAME inside a script (delivery, not markup), which a
  // name-only count would double-count.
  expect(count(body, 'data-pm-fenced="true"')).toBe(1);
  expect(body).toContain("Fenced demonstration");
  expect(body).toContain("data-pm-live-origin");
  expect(body).toContain("Fetch today");
  expect(body).toContain("measured with the same harness · excluded from every benchmark number");
}

/** Chrome assertions shared by every live variant's PDP page. */
function assertPdpChrome(body: string, variant: string, slug: string) {
  const controls = SURFACE_CONTROLS["pdp"]!;
  expect(controls.variants).toContain(variant);
  expect(controls.plannedVariants ?? []).not.toContain(variant);
  expect(count(body, 'data-pm-chrome="1"')).toBe(1);
  expect(body).toContain(`data-pm-variant="${variant}"`);
  expect(body).toContain('data-pm-surface="pdp"');
  const live = controls.variants.length;
  const planned = live + (controls.plannedVariants?.length ?? 0);
  expect(body).toContain(`Served by ${live} of ${planned} planned variants today.`);
  const switcherRow = body.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
  expect(switcherRow).toContain(`aria-current="page">${variant}<`);
  // The swap preserves the whole condition: same surface, same slug — a
  // switcher anchor is a pure variant-segment rewrite (URL-as-receipt).
  for (const other of controls.variants.filter((v) => v !== variant)) {
    expect(switcherRow).toContain(`href="/${other}/pdp/${slug}/"`);
  }
  for (const plannedVariant of controls.plannedVariants ?? []) {
    expect(body).toContain(
      `${plannedVariant}<span class="pm-chrome__note"> not built yet</span>`,
    );
    expect(switcherRow).not.toContain(plannedVariant);
  }
}

describe("the vanilla PDP (canonical shell + composition + URL contract)", () => {
  it("serves every arm 200 with the canonical shell and exactly one fenced plaque", async () => {
    const snap = await loadServedSnapshot();
    const arms = armSlugs(snap);
    for (const detail of Object.values(arms)) {
      const res = await get(`/vanilla/pdp/${detail.slug}/`);
      expect(res.status).toBe(200);
      assertPdpShell(await res.text());
    }
  });

  it("renders the RESOLVED snapshot's tray: title, artist, price, stock, composition, live CTA", async () => {
    const lib = await referenceLib();
    const snap = await loadServedSnapshot();
    const { rich: d } = armSlugs(snap);
    const body = await (await get(`/vanilla/pdp/${d.slug}/`)).text();
    expect(body).toContain(`<h1 class="pm-pdp__title">${esc(d.title)}</h1>`);
    expect(body).toContain(`<p class="pm-pdp__artist">${esc(d.artist)}</p>`);
    // The rich arm is priced BY DERIVATION, so the amount assertion is
    // unconditional — a guarded assertion on a maybe-unpriced page was the
    // silent-skip verify-slice caught.
    const price = lib.formatPrice(d.priceFrom);
    expect(price).not.toBeNull();
    expect(body).toContain(`<span class="pm-pdp__amount">${price}</span>`);
    expect(body).toContain(esc(lib.stockLine(d.numForSale)));
    expect(body).toContain(`<dt>Format</dt><dd>${esc(lib.formatComposition(d.formats))}</dd>`);
    // The CTA is ENABLED and says so — the unpriced arm asserts the disabled
    // twin; without this half a variant could ship every CTA disabled.
    expect(body).toContain(">Add to cart</button>");
    expect(body).not.toContain(">None for sale</button>");
    // The gallery: first thumb selected, zoom a real (not-pressed) toggle.
    // The selection count pins the BUTTON form — the injected chrome's own
    // current switcher cell also carries aria-current="true".
    expect(body).toContain('class="pm-gallery__zoom" type="button" aria-pressed="false"');
    expect(count(body, 'class="pm-gallery__thumb"')).toBe(d.images.length);
    expect(count(body, 'type="button" aria-current="true"')).toBe(1);
  });

  it("degenerate arms serve their contract: named em-dash + disabled CTA; no thumb list", async () => {
    const snap = await loadServedSnapshot();
    const { unpriced, oneImage } = armSlugs(snap);

    const unpricedBody = await (await get(`/vanilla/pdp/${unpriced.slug}/`)).text();
    expect(unpricedBody).toContain(
      '<span aria-hidden="true">—</span><span class="pm-sr-only">No price listed</span>',
    );
    expect(unpricedBody).toContain("none for sale");
    expect(unpricedBody).toContain(">None for sale</button>");
    expect(unpricedBody).toContain(" disabled>");

    const oneImageBody = await (await get(`/vanilla/pdp/${oneImage.slug}/`)).text();
    expect(oneImageBody).not.toContain("pm-gallery__thumbs");
    // The zoom toggle still ships on a one-image gallery (the master does).
    expect(oneImageBody).toContain('class="pm-gallery__zoom"');
  });

  it("cross-surface links are the master's absolute designated-host targets", async () => {
    const snap = await loadServedSnapshot();
    const body = await (await get(`/vanilla/pdp/${snap.pdpDetail.slug}/`)).text();
    expect(body).toContain('href="/react-next/plp/plain/" aria-current="page"');
    expect(body).toContain(">Back to all records</a>");
    expect(body).toContain('href="/vanilla/editorial/"');
    expect(body).toContain('href="/vanilla/checkout/"');
    expect(body).toContain('href="/vanilla/a11y/"');
    expect(body).toContain('href="/how-it-was-built/"');
  });

  it("chrome injected: stamped for this page, counts from the arrays, swap preserves the slug", async () => {
    const snap = await loadServedSnapshot();
    const body = await (await get(`/vanilla/pdp/${snap.pdpDetail.slug}/`)).text();
    assertPdpChrome(body, "vanilla", snap.pdpDetail.slug);
  });

  it("links exactly the master's stylesheets, in the master's order", async () => {
    const snap = await loadServedSnapshot();
    const body = await (await get(`/vanilla/pdp/${snap.pdpDetail.slug}/`)).text();
    expect(sheetTails(body)).toEqual(masterSheetTails());
  });

  it("a non-canonical slug is a 404, never a redirect (the URL contract)", async () => {
    const snap = await loadServedSnapshot();
    const d = snap.pdpDetail;
    // The right id under the wrong words — exactly the shape a stale or
    // hand-edited link produces. `redirect: manual` so a 301 can never hide
    // behind its own Location follow.
    const wrongWords = await fetch(`${ORIGIN}/vanilla/pdp/${d.id}-not-this-release/`, {
      redirect: "manual",
    });
    expect(wrongWords.status).toBe(404);
    const unknownId = await fetch(`${ORIGIN}/vanilla/pdp/${snap.missingId}-ghost/`, {
      redirect: "manual",
    });
    expect(unknownId.status).toBe(404);
  });

  it("the no-slash form redirects TO the slash form (slash normalisation, not the banned 301 class)", async () => {
    // Slash normalisation is each platform's own default and is pinned per
    // variant as measured — 307 from Workers static assets here — because a
    // CHANGE in it would be an observable serving-behavior change. It is not
    // the canonical-slug 301 the URL contract bans: the redirect target is
    // the same slug, only slash-normalised (the editorial suite pins qwik's
    // 301 the same way).
    const snap = await loadServedSnapshot();
    const res = await fetch(`${ORIGIN}/vanilla/pdp/${snap.pdpDetail.slug}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(`/vanilla/pdp/${snap.pdpDetail.slug}/`);
  });

  it("a percent-encoded spelling of a canonical slug 307-normalises (pinned as measured)", async () => {
    // The same platform-default class as the slash redirect: the assets
    // layer normalises the encoded spelling back to the one canonical URL.
    // react-next accepts the spelling instead (its router decodes params
    // before the slug compare) — divergence pinned per variant, recorded in
    // DIFF-TO-STARTER point 25.
    const snap = await loadServedSnapshot();
    const encoded = snap.pdpDetail.slug.replace("-", "%2D");
    expect(encoded).not.toBe(snap.pdpDetail.slug);
    const res = await fetch(`${ORIGIN}/vanilla/pdp/${encoded}/`, { redirect: "manual" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(`/vanilla/pdp/${snap.pdpDetail.slug}/`);
  });

  it("transport parity: the PDP page matches the placeholder baseline (ADR-0001 §6)", async () => {
    // The editorial suite carries this leg per variant; the PDP is the
    // surface this ticket exists to publish, so an unasserted codec here
    // would put the first PDP receipt on an unpinned wire (verify-slice).
    const snap = await loadServedSnapshot();
    const encoding = wireEncoding(`/vanilla/pdp/${armSlugs(snap).rich.slug}/`);
    const baseline = wireEncoding("/placeholder-static/sample/");
    expect(encoding).toBe(baseline);
    if (EXPECT_BROTLI) expect(encoding).toBe("br");
  });
});

describe("the react-next PDP (canonical shell + composition + URL contract)", () => {
  it("serves every arm 200 with the canonical shell and exactly one fenced plaque", async () => {
    const snap = await loadServedSnapshot();
    const arms = armSlugs(snap);
    for (const detail of Object.values(arms)) {
      const res = await get(`/react-next/pdp/${detail.slug}/`);
      expect(res.status).toBe(200);
      assertPdpShell(await res.text());
    }
  });

  it("renders the RESOLVED snapshot's tray: title, artist, price, stock, composition, live CTA", async () => {
    const lib = await referenceLib();
    const snap = await loadServedSnapshot();
    const { rich: d } = armSlugs(snap);
    const body = await (await get(`/react-next/pdp/${d.slug}/`)).text();
    expect(body).toContain(`<h1 class="pm-pdp__title">${reactEsc(d.title)}</h1>`);
    expect(body).toContain(`<p class="pm-pdp__artist">${reactEsc(d.artist)}</p>`);
    // Unconditional on the priced-by-derivation rich arm (verify-slice
    // finding — see the vanilla twin above).
    const price = lib.formatPrice(d.priceFrom);
    expect(price).not.toBeNull();
    expect(body).toContain(`<span class="pm-pdp__amount">${price}</span>`);
    expect(body).toContain(reactEsc(lib.stockLine(d.numForSale)));
    // React renders the dt/dd pairs without vanilla's same-line adjacency
    // being guaranteed byte-form — assert the composition VALUE, which is
    // the load-bearing string (the drift leg proves the full structure).
    expect(body).toContain(reactEsc(lib.formatComposition(d.formats)));
    expect(body).toContain(">Add to cart</button>");
    expect(body).not.toContain(">None for sale</button>");
    expect(body).toContain('aria-pressed="false"');
    expect(count(body, 'class="pm-gallery__thumb"')).toBe(d.images.length);
    expect(count(body, 'type="button" aria-current="true"')).toBe(1);
  });

  it("degenerate arms serve their contract: named em-dash + disabled CTA; no thumb list", async () => {
    const snap = await loadServedSnapshot();
    const { unpriced, oneImage } = armSlugs(snap);

    const unpricedBody = await (await get(`/react-next/pdp/${unpriced.slug}/`)).text();
    expect(unpricedBody).toContain('<span aria-hidden="true">—</span>');
    expect(unpricedBody).toContain('<span class="pm-sr-only">No price listed</span>');
    expect(unpricedBody).toContain("none for sale");
    expect(unpricedBody).toContain(">None for sale</button>");
    expect(unpricedBody).toContain('disabled=""');

    const oneImageBody = await (await get(`/react-next/pdp/${oneImage.slug}/`)).text();
    expect(oneImageBody).not.toContain("pm-gallery__thumbs");
    expect(oneImageBody).toContain('class="pm-gallery__zoom"');
  });

  it("cross-surface links are the master's absolute designated-host targets", async () => {
    const snap = await loadServedSnapshot();
    const body = await (await get(`/react-next/pdp/${snap.pdpDetail.slug}/`)).text();
    expect(body).toContain('href="/react-next/plp/plain/" aria-current="page"');
    expect(body).toContain(">Back to all records</a>");
    expect(body).toContain('href="/vanilla/editorial/"');
    expect(body).toContain('href="/vanilla/checkout/"');
    expect(body).toContain('href="/vanilla/a11y/"');
    expect(body).toContain('href="/how-it-was-built/"');
  });

  it("chrome injected: stamped for this page, counts from the arrays, swap preserves the slug", async () => {
    const snap = await loadServedSnapshot();
    const body = await (await get(`/react-next/pdp/${snap.pdpDetail.slug}/`)).text();
    assertPdpChrome(body, "react-next", snap.pdpDetail.slug);
  });

  it("links exactly the master's stylesheets, in the master's order", async () => {
    const snap = await loadServedSnapshot();
    const body = await (await get(`/react-next/pdp/${snap.pdpDetail.slug}/`)).text();
    expect(sheetTails(body)).toEqual(masterSheetTails());
  });

  it("fonts: the canonical loading markup verbatim modulo base path (ADR-0003 §8)", async () => {
    const canonical = readFileSync(
      join(repoRoot, "packages", "tokens", "fonts", "loading-markup.html"),
      "utf8",
    );
    const lines = canonical
      .split("\n")
      .filter((l) => l.startsWith("<link"))
      .map((l) => l.replaceAll("./node_modules/@pm/tokens", "/react-next/assets/pm"));
    expect(lines).toHaveLength(3);
    const snap = await loadServedSnapshot();
    const body = await (await get(`/react-next/pdp/${snap.pdpDetail.slug}/`)).text();
    const head = body.slice(0, body.indexOf("</head>"));
    let last = -1;
    for (const line of lines) {
      // The two tolerated JSX serializer differences (editorial.test.ts):
      // bare boolean attrs gain `=""`, void elements self-close.
      const jsxLine = line.replace("crossorigin>", 'crossorigin=""').slice(0, -1);
      const at = head.indexOf(jsxLine);
      expect(at, `canonical loading line missing or out of order: ${jsxLine}`).toBeGreaterThan(last);
      last = at;
    }
    expect(head).not.toMatch(/preload[^>]*PMWarnGlyph/);
  });

  it("a non-canonical slug is a 404, never a redirect (the URL contract)", async () => {
    const snap = await loadServedSnapshot();
    const d = snap.pdpDetail;
    // The STATUS is the whole cross-paradigm contract. The BODY is Next's
    // own error document — with multiple root layouts (this variant's
    // route-group split, the css-parameterisation fix), a thrown notFound()
    // SSRs Next's `__next_error__` shell and defers the branded not-found
    // boundary to hydration. That is accepted and recorded
    // (DIFF-TO-STARTER.md) rather than worked around: vanilla's 404 is an
    // equally unbranded asset-layer 404, the plane already serves slot-less
    // HTML 404s (qwik-city's own), and the two escapes — middleware, or
    // React 19 precedence-hoisted stylesheets under a single root layout —
    // would each change the EDITORIAL serving path whose published receipts
    // are pinned at their measurement SHAs.
    const wrongWords = await fetch(`${ORIGIN}/react-next/pdp/${d.id}-not-this-release/`, {
      redirect: "manual",
    });
    expect(wrongWords.status).toBe(404);

    const unknownId = await fetch(`${ORIGIN}/react-next/pdp/${snap.missingId}-ghost/`, {
      redirect: "manual",
    });
    expect(unknownId.status).toBe(404);
    const malformed = await fetch(`${ORIGIN}/react-next/pdp/not-a-release/`, {
      redirect: "manual",
    });
    expect(malformed.status).toBe(404);
  });

  it("the no-slash form redirects TO the slash form (slash normalisation, not the banned 301 class)", async () => {
    // Next's trailingSlash: true issues a 308 where Workers assets issue a
    // 307 — per-variant platform defaults, pinned as measured (see the
    // vanilla twin's comment).
    const snap = await loadServedSnapshot();
    const res = await fetch(`${ORIGIN}/react-next/pdp/${snap.pdpDetail.slug}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toContain(`/react-next/pdp/${snap.pdpDetail.slug}/`);
  });

  it("a percent-encoded spelling of a canonical slug serves 200 here (pinned as measured)", async () => {
    // The router decodes params before the slug compare, so this variant
    // accepts encoded spellings the static variants 307-normalise —
    // divergence of the same platform-default class as 307 vs 308, pinned
    // per variant rather than unified (DIFF-TO-STARTER point 25: recovering
    // the raw request bytes needs the middleware that was rejected for
    // touching the editorial serving path). One URL still maps to one
    // page's content; only the number of accepted spellings differs.
    const snap = await loadServedSnapshot();
    const encoded = snap.pdpDetail.slug.replace("-", "%2D");
    expect(encoded).not.toBe(snap.pdpDetail.slug);
    const res = await fetch(`${ORIGIN}/react-next/pdp/${encoded}/`, { redirect: "manual" });
    expect(res.status).toBe(200);
  });

  it("transport parity: the PDP page matches the placeholder baseline (ADR-0001 §6)", async () => {
    const snap = await loadServedSnapshot();
    const encoding = wireEncoding(`/react-next/pdp/${armSlugs(snap).rich.slug}/`);
    const baseline = wireEncoding("/placeholder-static/sample/");
    expect(encoding).toBe(baseline);
    if (EXPECT_BROTLI) expect(encoding).toBe("br");
  });

  it("no editorial chunk carries PDP island code (the chunk-freeze leak guard)", async () => {
    // The slice's headline finding made mechanical: adding the PDP route
    // initially grew EDITORIAL's served chunks by 7,984 raw bytes of PDP
    // island code — on the variant whose editorial initial-JS cell is
    // published and pinned. The three module splits that fixed it
    // (src/lib/pdp.tsx, self-contained pdp-cart.ts, pdp-format.ts + the
    // inlined error-boundary skeleton) hold only as long as no future
    // import re-groups the client graph, so the leak CLASS is asserted
    // here: every chunk the editorial page references must be free of the
    // PDP islands' unmistakable markers. Chunk hashes are deliberately NOT
    // pinned (platform-dependent minification would flake CI); the marker
    // sweep plus the count catches the failure mode that actually happened.
    const body = await (await get("/react-next/editorial/")).text();
    const chunkPaths = [...body.matchAll(/src="(\/react-next\/_next\/static\/chunks\/[^"]+)"/g)]
      .map((m) => m[1]!);
    expect(chunkPaths.length).toBe(8);
    for (const path of chunkPaths) {
      const js = await (await get(path)).text();
      expect(js.length).toBeGreaterThan(0);
      for (const marker of ["pm-gallery__zoom", "Decrease quantity", "live-price", "pm-pdp__"]) {
        expect(
          js.includes(marker),
          `editorial chunk ${path} carries PDP island code (${marker})`,
        ).toBe(false);
      }
    }
  });
});
