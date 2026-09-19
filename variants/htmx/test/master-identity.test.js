/**
 * The htmx PLP's pre-merge guards (the PLP build, 2026-08-28).
 *
 * WHY THIS FILE IS HERE AND NOT IN tools/repo-checks. htmx's OTHER
 * master-identity guard — the editorial one — lives in
 * `tools/repo-checks/test/variant-master-identity.test.ts`, and
 * `variants/README.md` records that placement deliberately (the renderer is
 * plain JS, so the shared guard workspace can drive it without hosting a
 * framework's compiler, unlike astro's and qwik's). Both homes are
 * legitimate; this one exists because `tools/repo-checks` belongs to a
 * different unit's file boundary in the parallel build that produced this
 * surface, and a guard nobody may edit is worse than a guard in a second
 * home. **htmx's guards are now split across two directories** — consolidating
 * them is a judgment call for whoever integrates the four PLP branches, and
 * this comment is the flag for it.
 *
 * Plain JavaScript, not TypeScript, matching this workspace rather than the
 * sibling guards: `@pm/htmx` has no TypeScript toolchain at all (no
 * tsconfig, no `typecheck` script, every source file `.js`/`.mjs`) and the
 * variant's whole identity is "no framework, no compile step". `@pm/blog` is
 * the standing precedent for a plain-JS workspace whose vitest suite is
 * plain JS too (`workers/blog/test/*.test.js`). Adding a TypeScript
 * toolchain to type-check one test file would buy nothing and cost the
 * variant its defining property.
 *
 * The three things these legs prove, in order of what they would catch:
 *  1. The re-implementation is BYTE-faithful to `renderPlp` — the vanilla
 *     mechanism, the strictest available, because this renderer is the same
 *     species as the reference's (plain template literals, importable with
 *     no runtime).
 *  2. The `^hx-` registration in `PERMITTED_NOISE` is EXACTLY what makes the
 *     served DOM equal the master — proven in both directions, so a
 *     registration that had stopped doing work would fail here rather than
 *     sit in the registry as decoration.
 *  3. The Worker actually serves it: routing, the knob forwarding the
 *     published cold/warm columns depend on, the partial-swap branch, and
 *     the branded-503 boundary.
 *
 * DISCLOSED LIMITS:
 *  - The `/api/plp` payload is assembled here by `applyPlpQuery` — the
 *    reference package's OWN query module, which the edge Worker imports
 *    and serves from (2026-09-04). Until then the payload was RE-TYPED here
 *    and the limit read: "if the edge Worker's facet comparator ever
 *    diverged from the reference's, these legs would still pass". There is
 *    no second comparator to diverge now, and one leg below drives the
 *    real Worker in-process to prove its plumbing returns exactly what the
 *    helper builds. The deployed seam is the origin suite's `plp.test.ts`.
 *  - Nothing here drives a browser, so htmx's own swap behaviour is
 *    unproven: what is proven is that the markup carries the documented
 *    attributes, that the anchors keep working with the attributes removed
 *    (they are plain `href`s), and that the server answers the partial when
 *    asked. The runtime is the pinned, vendored htmx.org build doing its
 *    documented job.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { NO_NOISE, PAGE_NORMALIZE, PERMITTED_NOISE, firstDomDivergence } from "@pm/drift-gate";
import { renderEditorialPage, renderPlpFragment, renderPlpPage } from "../src/render.mjs";
// The spec's query module and the REAL edge Worker, by relative path: neither
// is a dependency this variant declares or may declare (ADR-0004 §2 — a
// paradigm never ships the spec), and a guard reaching them by path is the
// react-next identity guard's precedent for exactly this seam.
import { applyPlpQuery } from "../../../packages/reference/render/plp-query.mjs";
import edgeWorker from "../../../workers/edge/src/index.js";

const repoRoot = join(import.meta.dirname, "..", "..", "..");

/** The registration this surface earns, read from the registry rather than
 *  re-typed — every leg below is written against whatever is registered. */
const HTMX_NOISE = PERMITTED_NOISE["htmx"];

const SNAPSHOTS = ["fixture", "crate"];

async function reference() {
  const lib = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
  );
  const plp = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "plp.mjs")).href
  );
  return { lib, plp };
}

/**
 * The edge Worker's `/api/plp` payload for a condition — built by the SAME
 * function the Worker serves from (`applyPlpQuery`, the reference's query
 * module), so it is the served tray by construction, not a re-typing of it.
 * `query` takes the five ADR-0005 §5 params plus `n`/`page`; `q` must be
 * the normalized form (the Worker normalizes before calling this).
 */
function plpPayload(snapshot, { n = 24, page = 1, ...query } = {}) {
  return applyPlpQuery(snapshot.summaries, {
    n,
    page,
    genre: null,
    style: null,
    format: null,
    sort: null,
    q: null,
    ...query,
  });
}

/** The real edge Worker over a committed snapshot, in-process with stub
 *  bindings — the react-next guard's `stubEnv`/`servedTray` shape. */
async function servedTray(snapshot, params = {}) {
  const warm = new Map();
  const env = {
    SNAPSHOT: {
      get: (key) =>
        Promise.resolve(
          key === "snapshot/summaries.json"
            ? { json: () => Promise.resolve(snapshot.summaries) }
            : null,
        ),
    },
    WARM: {
      get: (key) => Promise.resolve(warm.get(key) ?? null),
      put: (key, value) => {
        warm.set(key, value);
        return Promise.resolve();
      },
    },
  };
  const search = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await edgeWorker.fetch(
    new Request(`https://pm-edge/api/plp${search ? `?${search}` : ""}`),
    env,
  );
  return { status: res.status, tray: res.status === 200 ? await res.json() : null };
}

/** The conditions the master could not express until 2026-09-04, each of
 *  which now exercises one restored control: a genre, a style OUTSIDE its
 *  group's top-12 cut (the "selected facet is always listed" rule), a
 *  search, a sort, and a deep page carrying every URL knob. Values are
 *  found in the snapshot rather than typed. */
function restoredConditions(snapshot) {
  const summaries = snapshot.summaries;
  const genre = summaries[0].genres[0];
  const styleCounts = new Map();
  for (const s of summaries) for (const v of s.styles) styleCounts.set(v, (styleCounts.get(v) ?? 0) + 1);
  const ranked = [...styleCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const rareStyle = ranked.length > 12 ? ranked[ranked.length - 1][0] : ranked[ranked.length - 1][0];
  const word = summaries[3].title.split(" ").find((w) => /^[A-Za-z]{3,}$/.test(w));
  return [
    { label: "genre", query: { genre }, carry: {} },
    { label: "rare style", query: { style: rareStyle }, carry: {} },
    { label: "search", query: { q: word }, carry: {} },
    { label: "sort", query: { sort: "price-desc" }, carry: {} },
    {
      label: "deep page + every knob",
      query: { page: 2, genre, sort: "title" },
      carry: { cache: "cold", run: "bench-abc", profile: "slow-4g-mid-phone" },
    },
  ];
}

/** The ADR-0008 delivery freedoms the byte-strict legs tolerate — the head
 *  subtree, script elements, the chrome slot — then ASCII whitespace
 *  collapsed. Copied from the shape `tools/repo-checks`'s editorial guard
 *  uses, so both htmx surfaces are held to one policy. */
function stripDelivery(html) {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<div id="pm-chrome-slot"><\/div>/, "")
    .replace(/[\t\n\f\r ]+/g, " ");
}

/** The `@pm/tokens` stylesheets a page links, in order, keyed by the tail
 *  after `/css/` so the master's relative base and the variant's absolute
 *  one compare. Order is included on purpose: cascade order is a rendering
 *  property, not an ADR-0008 delivery freedom. */
function sheets(html) {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)].map((m) => {
    const at = m[1].lastIndexOf("/css/");
    if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
    return m[1].slice(at + 1);
  });
}

/**
 * Every distinct htmx attribute NAME the markup carries, sorted — the WHOLE
 * mechanism family, not just valued `hx-foo=` attributes.
 *
 * The narrow `\s(hx-[a-z-]+)=` shape was written here first and the
 * verification pass rejected it, for the reason the origin suite already
 * rejected it once for this same variant
 * (`tools/origin-suite/suite/drift.browser.test.ts:901-907`): htmx 2.0.10
 * also processes `hx-on:*` / `hx-on::*`, whose names carry a colon
 * (`htmx.js:2752`); `hx-disable`, which is VALUELESS (`htmx.js:206`); and
 * the documented `data-hx-*` prefix form, which `getAttributeValue` falls
 * back to (`htmx.js:418`). All three are live mechanisms a narrow regex
 * reports as absent — so the "exactly three attributes" and "no anchor is
 * touched" legs below would have passed with a fourth on an anchor.
 */
function hxAttributeNames(html) {
  const names = [...html.matchAll(/\s((?:data-)?hx-[a-z0-9-]+(?::{1,2}[a-z0-9-]+)*)(?=[=\s>])/gi)];
  return [...new Set(names.map((m) => m[1].toLowerCase()))].sort();
}

/** The mechanism removed, same family as `hxAttributeNames` (valued or
 *  valueless). Paired with the leg below that pins WHICH names appear and
 *  proves each is covered by a registered pattern — so this cheap strip
 *  provably removes exactly the registered noise and nothing else. */
function stripHx(html) {
  return html.replace(
    /\s(?:data-)?hx-[a-z0-9-]+(?::{1,2}[a-z0-9-]+)*(?:="[^"]*")?/gi,
    "",
  );
}

/**
 * `PAGE_NORMALIZE` is written to run INSIDE a driven browser: self-contained
 * by construction, reading `document`/`Node` as globals. linkedom supplies
 * same-shape globals for a plain HTML string — the slice-B/C precedent.
 */
function normalizeHtml(html, spec) {
  const { document, Node } = parseHTML(html);
  const g = globalThis;
  const prevDocument = g.document;
  const prevNode = g.Node;
  g.document = document;
  g.Node = Node;
  try {
    return PAGE_NORMALIZE({
      attrPatterns: [...spec.attrPatterns],
      classPatterns: [...spec.classPatterns],
      behaviorAttrPatterns: [...spec.behaviorAttrPatterns],
      dropElementSelectors: [...(spec.dropElementSelectors ?? [])],
    });
  } finally {
    g.document = prevDocument;
    g.Node = prevNode;
  }
}

describe("htmx's PLP equals the master, both snapshots (pre-merge)", () => {
  for (const name of SNAPSHOTS) {
    it(`${name}: renderPlpPage matches renderPlp byte-for-byte at n=24`, async () => {
      const { lib, plp } = await reference();
      const snapshot = lib.loadSnapshot(name);
      const master = stripDelivery(plp.renderPlp(snapshot, { origin: "", n: 24 }));
      const variant = stripHx(stripDelivery(renderPlpPage(plpPayload(snapshot, { n: 24 }))));

      // Non-vacuity: real catalogue markup was compared on both sides, not
      // two empty strings.
      expect(master).toContain("pm-release-card");
      expect(variant).toContain("pm-plp__results");
      expect(variant).toBe(master);
    });

    it(`${name}: and at n=240 — the other end of the nKnob`, async () => {
      const { lib, plp } = await reference();
      const snapshot = lib.loadSnapshot(name);
      const master = stripDelivery(plp.renderPlp(snapshot, { origin: "", n: 240 }));
      const variant = stripHx(stripDelivery(renderPlpPage(plpPayload(snapshot, { n: 240 }))));
      expect(variant).toBe(master);
    });
  }

  for (const name of SNAPSHOTS) {
    it(`${name}: and at every RESTORED condition — a facet, a rare style, a search, a sort, a deep page with every knob`, async () => {
      const { lib, plp } = await reference();
      const snapshot = lib.loadSnapshot(name);
      for (const { label, query, carry } of restoredConditions(snapshot)) {
        const master = stripDelivery(plp.renderPlp(snapshot, { origin: "", n: 24, ...query, ...carry }));
        const variant = stripHx(stripDelivery(renderPlpPage(plpPayload(snapshot, { n: 24, ...query }), carry)));
        // Non-vacuity per condition: the control's state is actually rendered.
        if (query.genre) expect(master, `${label}: no selected facet`).toContain(`aria-current="true"`);
        if (query.q) expect(master, `${label}: the search box is empty`).toContain(`value="${query.q}"`);
        if (query.sort) expect(master, `${label}: the sort is not selected`).toContain(`<option value="${query.sort}" selected>`);
        if (carry.cache) expect(master, `${label}: hrefs dropped cache`).toContain("cache=cold&amp;run=bench-abc&amp;profile=slow-4g-mid-phone");
        expect(variant, `${name}/${label}`).toBe(master);
      }
    });
  }

  it("the helper IS the served tray: the real edge Worker, driven in-process, returns exactly what plpPayload builds", async () => {
    // Closes the limit the first PLP build disclosed ("if the edge Worker's
    // facet comparator ever diverged from the reference's, these legs would
    // still pass"): the Worker now imports the reference's query module, and
    // this proves its PLUMBING — parsing, clamping, validation — hands that
    // module the same query the helper does.
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    for (const { label, query } of restoredConditions(snapshot)) {
      const { status, tray } = await servedTray(snapshot, { n: 24, ...query });
      expect(status, label).toBe(200);
      expect(tray, label).toEqual(plpPayload(snapshot, { n: 24, ...query }));
    }
    // And the served tray FILTERS — the fact the retired tripwire guarded
    // against pretending: fewer releases, every one carrying the facet.
    const { genre } = restoredConditions(snapshot)[0].query;
    const { tray } = await servedTray(snapshot, { genre, n: 240 });
    expect(tray.total).toBeLessThan(snapshot.summaries.length);
    expect(tray.total).toBeGreaterThan(0);
    for (const item of tray.items) expect(item.genres).toContain(genre);
  });

  it("the master really pins 24 cards, and n=240 really serves more (the knob is not inert)", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const cards = (html) => (html.match(/class="pm-release-card"/g) ?? []).length;
    expect(cards(renderPlpPage(plpPayload(snapshot, { n: 24 })))).toBe(24);
    expect(cards(renderPlpPage(plpPayload(snapshot, { n: 240 })))).toBe(240);
  });

  it("links exactly the master's stylesheets, in order", async () => {
    const { lib, plp } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const master = sheets(plp.renderPlp(snapshot, { origin: "", n: 24 }));
    const variant = sheets(renderPlpPage(plpPayload(snapshot, { n: 24 })));
    // Cascade order is a rendering property, not an ADR-0008 freedom.
    expect(master.length, "the master links no stylesheets").toBeGreaterThan(5);
    expect(variant).toEqual(master);
    // The surface's own sheets, not editorial's — and the rail's sheet is
    // back with the rail (2026-09-04).
    expect(variant).toContain("css/surfaces/plp.css");
    expect(variant).toContain("css/components/facets.css");
    expect(variant).not.toContain("css/surfaces/editorial.css");
  });
});

describe("the ^hx- registration is exactly what makes the served DOM equal the master", () => {
  it("the registry entry is mechanism only — no residue, no dropped elements", () => {
    expect(HTMX_NOISE, "htmx must be registered for this surface").toBeDefined();
    expect(HTMX_NOISE.behaviorAttrPatterns).toEqual(["^hx-"]);
    expect(HTMX_NOISE.attrPatterns).toEqual([]);
    expect(HTMX_NOISE.classPatterns).toEqual([]);
    expect(HTMX_NOISE.dropElementSelectors).toBeUndefined();
  });

  it("the page carries exactly three hx-* attribute NAMES, each covered by a registered pattern", async () => {
    const { lib } = await reference();
    const html = renderPlpPage(plpPayload(lib.loadSnapshot("fixture")));
    const names = hxAttributeNames(html);
    expect(names).toEqual(["hx-boost", "hx-swap", "hx-target"]);
    // The registration is `^hx-`, which does NOT match `data-hx-` (htmx's
    // other documented spelling) — so the page must not use it, or the
    // deployed gate would read a real mechanism as content drift. Pinned
    // here rather than trusted: the same narrowness is recorded in
    // normalize.ts, DIFF-TO-STARTER.md and the handoff.
    expect(html).not.toMatch(/\sdata-hx-/i);
    // Registering a pattern that did not cover the markup would make the
    // byte-strict strip above and the normalizer below disagree.
    for (const name of names) {
      expect(
        HTMX_NOISE.behaviorAttrPatterns.some((p) => new RegExp(p).test(name)),
        `${name} is on the page but no registered pattern matches it`,
      ).toBe(true);
    }
  });

  it("hx-target/hx-swap ride the root; hx-boost rides the FOUR navigation containers and never the root or a card", async () => {
    const { lib } = await reference();
    const html = renderPlpPage(plpPayload(lib.loadSnapshot("fixture")));
    // The root carries the swap contract only — `hx-boost` on the root would
    // boost every descendant same-origin anchor, INCLUDING the 24 card links
    // to /vanilla/pdp/…, and a click on a record title would swap the whole
    // PDP document into the grid (design critique, kill finding).
    const root = html.match(/<div class="pm-plp"[^>]*>/)[0];
    expect(hxAttributeNames(root)).toEqual(["hx-swap", "hx-target"]);
    expect(root).toContain('hx-target=".pm-plp"');
    expect(root).toContain('hx-swap="outerHTML"');
    // Exactly four boosted containers: the rail, both forms, the pagination.
    const boosted = [...html.matchAll(/<(nav|form) class="([^"]+)"[^>]*\shx-boost="true"/g)].map((m) => m[2]);
    expect(boosted.sort()).toEqual(["pm-facets", "pm-pagination", "pm-toolbar__search", "pm-toolbar__sort"]);
    // And nothing else carries any hx-* — not the grid, not a card, not an anchor.
    const stripped = html
      .replace(root, "")
      .replace(/<(nav|form) class="[^"]+"[^>]*\shx-boost="true"[^>]*>/g, "");
    expect(hxAttributeNames(stripped)).toEqual([]);
    expect(html.match(/<ul class="pm-grid"[^>]*>/)[0]).not.toContain("hx-");
    expect(html).not.toMatch(/<a class="pm-release-card__link"[^>]*hx-/);
    expect(html).not.toMatch(/<a class="pm-facets__facet"[^>]*hx-/);
    // The links themselves are ordinary navigation with JavaScript off.
    expect(html).toContain('<a class="pm-pagination__link" href="?page=2">2</a>');
    expect(html).toMatch(/<a class="pm-facets__facet" href="\?genre=[^"]+">/);
  });

  it("normalized DOM equals the master UNDER the registration", async () => {
    const { lib, plp } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const master = normalizeHtml(plp.renderPlp(snapshot, { origin: "", n: 24 }), NO_NOISE);
    const variant = normalizeHtml(renderPlpPage(plpPayload(snapshot)), HTMX_NOISE);
    expect(variant).not.toBe("");
    expect(variant).toContain("pm-plp");
    if (variant !== master) console.error(firstDomDivergence(master, variant));
    expect(variant).toBe(master);
  });

  it("and NOT under NO_NOISE — so the registration is load-bearing, not decoration", async () => {
    const { lib, plp } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const master = normalizeHtml(plp.renderPlp(snapshot, { origin: "", n: 24 }), NO_NOISE);
    const unregistered = normalizeHtml(renderPlpPage(plpPayload(snapshot)), NO_NOISE);
    // If this ever passes, the surface has stopped carrying the mechanism
    // and the registry entry should go with it.
    expect(unregistered).not.toBe(master);
    expect(firstDomDivergence(master, unregistered)).toContain("hx-");
  });
});

describe("page > 1 — the condition the reference renderer cannot render", () => {
  it("serves the right slice, moves the current marker, and states the right range", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const html = renderPlpPage(plpPayload(snapshot, { n: 24, page: 2 }));
    expect(html).toContain(
      '<p class="pm-toolbar__count">Showing <span class="pm-toolbar__n">25–48</span> of <span class="pm-toolbar__n">240</span> releases</p>',
    );
    expect(html).toContain(
      '<span class="pm-pagination__link pm-pagination__link--current" aria-current="page">2</span>',
    );
    expect(html).toContain('<a class="pm-pagination__link" href="?page=1">1</a>');
    expect(html).toContain('<a class="pm-pagination__link" href="?page=3" rel="next">Next</a>');
    // The 25th release of the snapshot, i.e. really the second page's data.
    expect(html).toContain(snapshot.summaries[24].title);
    expect(html).not.toContain(`>${snapshot.summaries[0].title}<`);
  });

  /**
   * BOTH LEGS BELOW EXIST BECAUSE THE VERIFICATION PASS FOUND WHAT THIS
   * DESCRIBE BLOCK ORIGINALLY MISSED. It exercised page 2 and nothing else,
   * and page 2 is the one page above 1 where two separate defects are
   * invisible:
   *   - the page window was a literal copy of the reference's
   *     `1..min(totalPages, 5)`, so from page 6 on NO element carried
   *     `aria-current="page"` and there was no route past 5 — six clicks
   *     from the front page, on both snapshots;
   *   - an out-of-range page rendered its range BACKWARDS ("Showing 241–240
   *     of 240"), which src/plp.js would then announce to a screen reader
   *     verbatim.
   * Sweeping every page is cheap (31 renders across both snapshots) and it
   * is the only version of this leg that could have caught either.
   */
  it("EVERY page in range carries exactly one current marker, and the window contains it", async () => {
    const { lib } = await reference();
    for (const name of SNAPSHOTS) {
      const snapshot = lib.loadSnapshot(name);
      const totalPages = Math.ceil(snapshot.summaries.length / 24);
      expect(totalPages).toBeGreaterThan(5); // or the defect could not appear
      for (let page = 1; page <= totalPages; page += 1) {
        const nav = renderPlpPage(plpPayload(snapshot, { n: 24, page })).match(
          /<nav class="pm-pagination"[\s\S]*?<\/nav>/,
        )[0];
        const markers = nav.match(/aria-current="page"/g) ?? [];
        expect(markers.length, `${name} page ${page} of ${totalPages}: expected exactly one current marker`).toBe(1);
        expect(
          nav,
          `${name} page ${page}: the current page must be the marked one`,
        ).toContain(`--current" aria-current="page">${page}</span>`);
      }
    }
  });

  it("a page past the last one is honest: no reversed range, no Next, no false marker", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    for (const page of [11, 999]) {
      const html = renderPlpPage(plpPayload(snapshot, { n: 24, page }));
      // "Showing 241–240 of 240 releases" was the measured string before this.
      expect(html).toContain(
        '<p class="pm-toolbar__count">Showing <span class="pm-toolbar__n">0</span> of <span class="pm-toolbar__n">240</span> releases</p>',
      );
      const nav = html.match(/<nav class="pm-pagination"[\s\S]*?<\/nav>/)[0];
      expect(nav, "Next must not promise a page that does not exist").not.toContain('rel="next"');
      expect(nav).not.toContain('aria-current="page"');
      expect((html.match(/class="pm-release-card"/g) ?? []).length).toBe(0);
    }
  });

  /**
   * The SECOND contract defect on this same `<nav>`, pinned rather than
   * fixed. `renderPlp`'s comment (plp.mjs:60-62) claims its pagination hrefs
   * "preserve the WHOLE condition (URL-as-receipt, ADR-0004 §5)"; they carry
   * `page` and `n` and nothing else, and a query-only relative reference
   * replaces the whole query (RFC 3986 §5.3) — so `cache`, `run` and
   * `profile` are dropped by every page-flip. From this arm's own preset
   * (`/htmx/plp/?cache=cold`) that silently moves the visit onto the warm
   * tier while the chrome still reads cold.
   *
   * This leg exists so the reference fix cannot land on ONE side only: it
   * asserts the variant emits exactly the master's shape, so the day
   * `plp.mjs` starts threading the condition through, this fails and the
   * variant is updated in the same change.
   */
  it("pagination hrefs are the master's shape exactly — and they CARRY cache, run and profile now", async () => {
    // This leg used to pin the opposite: the master's hrefs dropped the
    // three knobs and this arm reproduced the drop so the fix could not
    // land on one side only. The fix landed in the reference (2026-09-04,
    // `conditionHref`), so both sides carry them and this pins THAT.
    const { lib, plp } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const hrefs = (html) =>
      [...html.matchAll(/<a class="pm-pagination__link" href="([^"]+)"/g)].map((m) => m[1]);
    const master = hrefs(plp.renderPlp(snapshot, { origin: "", n: 24 }));
    expect(master).toEqual(["?page=2", "?page=3", "?page=4", "?page=5", "?page=2"]);
    expect(hrefs(renderPlpPage(plpPayload(snapshot, { n: 24 })))).toEqual(master);

    const carry = { cache: "cold", run: "bench-7", profile: "slow-4g-mid-phone" };
    const carried = hrefs(plp.renderPlp(snapshot, { origin: "", n: 24, page: 3, ...carry }));
    // Every knob, canonical order, on every flip — from this arm's own
    // preset a click on "2" used to land on the WARM tier under a chrome
    // still reading cold. (`n` is omitted at its default, so it is absent here.)
    // The "1" link omits `page` (default) but carries the rest; only the
    // BARE condition is spelled `?page=1`.
    expect(carried[0]).toBe("?cache=cold&amp;run=bench-7&amp;profile=slow-4g-mid-phone");
    expect(carried).toContain("?page=4&amp;cache=cold&amp;run=bench-7&amp;profile=slow-4g-mid-phone");
    expect(hrefs(renderPlpPage(plpPayload(snapshot, { n: 24, page: 3 }), carry))).toEqual(carried);
    // A malformed carry value is dropped, not emitted (bounded, opaque).
    const junk = hrefs(renderPlpPage(plpPayload(snapshot, { n: 24 }), { run: "<script>", profile: "x".repeat(70) }));
    expect(junk[0]).toBe("?page=2");
  });

  it("Next is gated on a real next page — and the contract now says so too", async () => {
    const { lib, plp } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    // This leg used to pin the OPPOSITE. `renderPlp` emitted `rel="next"`
    // unconditionally, so at n=240 — where the fixture is a single page of
    // 240 — the master linked a page with zero releases, and this arm
    // reproduced it rather than diverge from the contract at a condition the
    // identity guard actually compares. The reference fix in this unit's
    // handoff note has landed: `renderPlp` takes `page` and gates on
    // `page < totalPages`, so there is nothing left to reproduce.
    //
    // Both sides are asserted, not just this arm's: if the reference ever
    // regresses to unconditional, this fails on the master line first and
    // names the file that moved.
    const single = plp.renderPlp(snapshot, { origin: "", n: 240 });
    expect(single, "the master emits Next on a single-page result").not.toContain('rel="next"');
    expect(renderPlpPage(plpPayload(snapshot, { n: 240, page: 1 }))).not.toContain('rel="next"');

    // Non-vacuity: the gate must still emit Next where a next page exists.
    const many = plp.renderPlp(snapshot, { origin: "", n: 24 });
    expect(many).toContain('rel="next"');
    expect(renderPlpPage(plpPayload(snapshot, { n: 24, page: 1 }))).toContain('rel="next"');
  });

  it("the last real page offers no Next; the one before it does", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    // 240 releases at n=24 is ten pages. Page 10 is the last real one.
    const last = renderPlpPage(plpPayload(snapshot, { n: 24, page: 10 }));
    expect(last).not.toContain('rel="next"');
    expect(last).toContain('aria-current="page">10<');
    const ninth = renderPlpPage(plpPayload(snapshot, { n: 24, page: 9 }));
    expect(ninth).toContain('rel="next"');
  });

  it("the fragment is the swap target alone — no document, no shell", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const fragment = renderPlpFragment(plpPayload(snapshot, { n: 24, page: 2 }));
    expect(
      fragment.startsWith('<div class="pm-plp" hx-target=".pm-plp"'),
      `the fragment must BE the swap target, but it starts: ${fragment.slice(0, 80)}`,
    ).toBe(true);
    expect(fragment).not.toContain("<!doctype");
    expect(fragment).not.toContain("pm-masthead");
    expect(fragment).not.toContain("pm-footer");
    // It must carry the mechanism itself, or the swapped-in controls
    // would be inert and the second page-flip would be a full navigation.
    expect(hxAttributeNames(fragment)).toEqual(["hx-boost", "hx-swap", "hx-target"]);
    expect(fragment.startsWith('<div class="pm-plp" hx-target=".pm-plp" hx-swap="outerHTML">')).toBe(true);
    // And it is exactly the block the full page carries, not a variant of it.
    const page = renderPlpPage(plpPayload(snapshot, { n: 24, page: 2 }));
    expect(page).toContain(fragment.trimEnd());
  });
});

/* ── The Worker: the module production actually executes. Driven in-process
      with stub EDGE bindings, the `htmx-worker-fallback` precedent — the
      entry is framework-neutral (Request/Response/URL globals only). ───── */

async function workerFetch(env, path, init) {
  const worker = (
    await import(
      pathToFileURL(join(repoRoot, "variants", "htmx", "src", "index.js")).href
    )
  ).default;
  return worker.fetch(new Request(`https://pm-front.example${path}`, init), env);
}

/** An EDGE stub that RECORDS the paths it was asked for, so the knob
 *  forwarding can be asserted rather than assumed. */
function recordingEdge(payload, headers = {}) {
  const seen = [];
  return {
    seen,
    env: {
      EDGE: {
        fetch: (input) => {
          seen.push(new URL(input));
          return Promise.resolve(Response.json(payload, { headers }));
        },
      },
    },
  };
}

describe("the Worker serves /htmx/plp/", () => {
  it("redirects the bare path to the trailing-slash form, query preserved", async () => {
    const res = await workerFetch({}, "/htmx/plp?n=240&cache=cold");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/htmx/plp/?n=240&cache=cold");
  });

  it("editorial's own redirect and 404 fallback still behave (routing regression)", async () => {
    const editorial = await workerFetch({}, "/htmx/editorial?x=1");
    expect(editorial.status).toBe(301);
    expect(editorial.headers.get("location")).toBe("/htmx/editorial/?x=1");
    expect((await workerFetch({}, "/htmx/nothing/")).status).toBe(404);
    expect((await workerFetch({}, "/htmx/plp", { method: "POST" })).status).toBe(405);
  });

  it("serves the full document, and marks the response as varying on HX-Request", async () => {
    const { lib } = await reference();
    const { env } = recordingEdge(plpPayload(lib.loadSnapshot("fixture")));
    const res = await workerFetch(env, "/htmx/plp/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    // Without this, a shared cache may serve a bare fragment to a cold
    // navigation — the same URL has two representations.
    expect(res.headers.get("vary")).toBe("HX-Request, HX-History-Restore-Request");
    const body = await res.text();
    expect(
      body.startsWith("<!doctype html>"),
      `a plain navigation must get the whole document, but it starts: ${body.slice(0, 80)}`,
    ).toBe(true);
    expect(body).toContain('<div class="pm-plp" hx-target=".pm-plp" hx-swap="outerHTML">');
  });

  it("answers an htmx-originated request with the partial ONLY", async () => {
    const { lib } = await reference();
    const { env } = recordingEdge(plpPayload(lib.loadSnapshot("fixture"), { page: 2 }));
    const res = await workerFetch(env, "/htmx/plp/?page=2", {
      headers: { "HX-Request": "true" },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(
      body.startsWith('<div class="pm-plp" hx-target=".pm-plp"'),
      `an HX-Request must get the partial ONLY, but it starts: ${body.slice(0, 80)}`,
    ).toBe(true);
    expect(body).not.toContain("<!doctype");
    expect(body).not.toContain("pm-masthead");
  });

  /**
   * FOUND BY THE VERIFICATION PASS, and it was a blocker.
   *
   * htmx's Back button restores from a sessionStorage cache; on a MISS
   * (storage blocked, quota shed, or evicted past `historyCacheSize` = 10)
   * it re-fetches the URL and swaps the answer into `getHistoryElement()` —
   * `document.body`, since this page declares no `[hx-history-elt]` — with
   * `swapStyle: 'innerHTML'`. It sends that request with `HX-Request: true`,
   * because `historyRestoreAsHxRequest` defaults to true
   * (`htmx.org@2.0.10/dist/htmx.js:281`). A server branching on `HX-Request`
   * alone answers a full-page restore with the bare `.pm-plp` block and htmx
   * writes it over the whole body: skip link, chrome slot, masthead, footer
   * and every script gone. htmx's own config doc names this exact trap at
   * `htmx.js:277` — "This should always be disabled when using HX-Request
   * header to optionally return partial responses".
   */
  it("a history-restore re-fetch gets the WHOLE document, not the partial", async () => {
    const { lib } = await reference();
    const { env } = recordingEdge(plpPayload(lib.loadSnapshot("fixture")));
    const res = await workerFetch(env, "/htmx/plp/", {
      // Exactly what htmx sends on a history cache miss: BOTH headers.
      headers: { "HX-Request": "true", "HX-History-Restore-Request": "true" },
    });
    const body = await res.text();
    expect(
      body.startsWith("<!doctype html>"),
      `a history restore swaps into document.body — a partial here erases the shell; got: ${body.slice(0, 80)}`,
    ).toBe(true);
    expect(body).toContain('<div id="pm-chrome-slot"></div>');
    expect(body).toContain('class="pm-masthead"');
    // Both headers decide the representation, so both are cache-key inputs.
    expect(res.headers.get("vary")).toBe("HX-Request, HX-History-Restore-Request");
  });

  /**
   * The partial DECLARES itself, so the front Worker need not re-derive
   * htmx's request semantics. Inert until that Worker honours the header —
   * `workers/front/**` is another unit's boundary — but the declaration is
   * this side's half, and without it the composed origin logs
   * `chrome-slot-count` as an ERROR on every single page-flip: a partial has
   * no `div#pm-chrome-slot` by design, and the slot-cardinality check treats
   * zero as a violation (workers/front/src/index.js:147-183).
   */
  it("the partial declares itself with x-pm-partial; the whole document does not", async () => {
    const { lib } = await reference();
    const payload = plpPayload(lib.loadSnapshot("fixture"));
    const partial = await workerFetch(recordingEdge(payload).env, "/htmx/plp/", {
      headers: { "HX-Request": "true" },
    });
    expect(partial.headers.get("x-pm-partial")).toBe("1");
    const document_ = await workerFetch(recordingEdge(payload).env, "/htmx/plp/");
    expect(document_.headers.get("x-pm-partial")).toBeNull();
    // The fragment really has no slot — which is why the header is needed.
    expect(await partial.text()).not.toContain('id="pm-chrome-slot"');
  });

  /**
   * The leg that protects a PUBLISHED NUMBER rather than a rendering.
   *
   * `?cache=cold` is this arm's switcher preset (ADR-0005 §2) and the bench
   * runner sets it on every cold-column visit
   * (tools/bench-runner/src/batch.ts:78-80, which also sets `n` and `run`).
   * If the Worker dropped it, the edge would serve the KV warm tier under a
   * column labelled cold and this paradigm would read faster than it is —
   * rigging in the flattering direction, which ADR-0001 §9 refuses in both
   * directions. `run` is the batch's cache-isolation nonce; dropped, the
   * warm column inherits every previous run's KV state.
   */
  it("forwards the measurement knobs AND the five data-plane params, all nine", async () => {
    const { lib } = await reference();
    const { env, seen } = recordingEdge(plpPayload(lib.loadSnapshot("fixture")));
    await workerFetch(
      env,
      "/htmx/plp/?n=240&page=3&cache=cold&run=suite-1&genre=Jazz&style=Modal&format=LP&sort=title&q=miles",
    );
    expect(seen.length).toBe(1);
    expect(seen[0].pathname).toBe("/api/plp");
    const q = seen[0].searchParams;
    expect(q.get("cache")).toBe("cold");
    expect(q.get("run")).toBe("suite-1");
    expect(q.get("n")).toBe("240");
    expect(q.get("page")).toBe("3");
    // ADR-0005 §5's five, honoured by the data plane since 2026-09-04.
    expect(q.get("genre")).toBe("Jazz");
    expect(q.get("style")).toBe("Modal");
    expect(q.get("format")).toBe("LP");
    expect(q.get("sort")).toBe("title");
    expect(q.get("q")).toBe("miles");
  });

  /**
   * ADR-0005's ONE named obligation on this Worker
   * (docs/adr/0005-plp-data-strategy-comparison.md:203-205): "The
   * x-pm-cache-state pass-through onto server-rendered HTML is the HTMX
   * variant Worker's obligation". FOUND MISSING by the verification pass.
   *
   * It is what makes this arm's cold/warm columns FALSIFIABLE. The bench
   * runner reads the document response's header into every receipt
   * (tools/bench-runner/src/collect.ts:928 -> docCacheState). On every other
   * arm the tray fetch is client-side and visible in the network log; on
   * this one it happens inside the Worker, so the document header is the
   * only place the served condition can surface. Without it the receipts
   * record `null` and the columns rest on the runner having ASKED.
   */
  it("passes the edge's x-pm-cache-state through onto the HTML, every state", async () => {
    const { lib } = await reference();
    const payload = plpPayload(lib.loadSnapshot("fixture"));
    for (const state of ["bypass", "miss", "hit"]) {
      const { env } = recordingEdge(payload, { "x-pm-cache-state": state });
      const res = await workerFetch(env, `/htmx/plp/?cache=cold&run=r-${state}`);
      expect(
        res.headers.get("x-pm-cache-state"),
        `the ${state} column would record docCacheState: null in every receipt`,
      ).toBe(state);
      // The partial is a measured response too.
      const { env: env2 } = recordingEdge(payload, { "x-pm-cache-state": state });
      const partial = await workerFetch(env2, "/htmx/plp/", {
        headers: { "HX-Request": "true" },
      });
      expect(partial.headers.get("x-pm-cache-state")).toBe(state);
    }
  });

  it("and invents nothing when the edge sent none", async () => {
    const { lib } = await reference();
    const { env } = recordingEdge(plpPayload(lib.loadSnapshot("fixture")));
    const res = await workerFetch(env, "/htmx/plp/");
    // A fabricated value would be worse than the absence it replaces.
    expect(res.headers.get("x-pm-cache-state")).toBeNull();
  });

  it("forwards nothing else — junk is not invented, and `profile` (the chrome's knob) never reaches the data plane", async () => {
    const { lib } = await reference();
    const { env, seen } = recordingEdge(plpPayload(lib.loadSnapshot("fixture")));
    await workerFetch(env, "/htmx/plp/?genre=Jazz&nonsense=1&profile=slow-4g-mid-phone&x=y");
    expect([...seen[0].searchParams.keys()]).toEqual(["genre"]);
  });

  it("the URL's cache, run and profile reach the rendered hrefs — through the Worker, not only the renderer", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const genre = snapshot.summaries[0].genres[0];
    const { env } = recordingEdge(plpPayload(snapshot, { genre }));
    const body = await (
      await workerFetch(env, `/htmx/plp/?cache=cold&run=r1&profile=slow-4g-mid-phone&genre=${encodeURIComponent(genre)}`)
    ).text();
    // A page-flip keeps the column, the nonce, the profile AND the filter.
    expect(body).toContain(
      `href="?page=2&amp;cache=cold&amp;run=r1&amp;profile=slow-4g-mid-phone&amp;genre=${encodeURIComponent(genre).replace(/%20/g, "+")}"`,
    );
    // The selected facet toggles OFF and keeps the rest.
    expect(body).toContain(`aria-current="true"`);
    expect(body).toContain('href="?cache=cold&amp;run=r1&amp;profile=slow-4g-mid-phone" aria-current="true"');
  });

  /**
   * A tray 400 is a facet or sort value the snapshot does not hold — the
   * plane ANSWERED. Until 2026-09-04 every non-2xx fell into the branded 503,
   * so a hand-typed `?genre=jazz` told the visitor the data plane was down
   * (false) — and the two arms disagreed for one URL, since react-next
   * rendered its error boundary instead (design critique).
   */
  it("a tray 400 is a branded 404 — 'No such filter' — never the data-plane-down 503", async () => {
    const env = {
      EDGE: {
        fetch: () =>
          Promise.resolve(
            Response.json({ error: "unknown genre" }, { status: 400, headers: { "x-pm-cache-state": "none" } }),
          ),
      },
    };
    const res = await workerFetch(env, "/htmx/plp/?genre=jazz");
    expect(res.status).toBe(404);
    expect(res.headers.get("x-pm-cache-state")).toBe("none");
    const body = await res.text();
    expect(body).toContain("<h1>No such filter</h1>");
    expect(body).not.toContain("didn&#39;t answer");
    expect(body).toContain('<div id="pm-chrome-slot"></div>');
    expect(body).toContain('href="/react-next/plp/plain/" aria-current="page"');
    // A 500 is still the data plane not answering.
    const down = { EDGE: { fetch: () => Promise.resolve(new Response("nope", { status: 500 })) } };
    expect((await workerFetch(down, "/htmx/plp/?genre=jazz")).status).toBe(503);
  });

  it("a dead data plane answers the branded shell, never an escaped exception", async () => {
    const env = { EDGE: { fetch: () => Promise.reject(new Error("edge down")) } };
    const res = await workerFetch(env, "/htmx/plp/");
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('<div id="pm-chrome-slot"></div>');
    expect(body).toContain('class="pm-masthead"');
    expect(body).toContain("This page couldn");
  });

  /**
   * FOUND BY THE VERIFICATION PASS: the branded fallback marked the
   * MASTHEAD'S EDITORIAL LINK as the current page, so a screen-reader user
   * whose PLP failed was told the current page is Editorial — a wrong ARIA
   * state, served deliberately. Editorial's own 503 must stay byte-identical
   * (its receipts were measured against it), which is why `current` is a
   * parameter with a default rather than a rewrite.
   */
  it("a PLP failure marks the PLP as current, and editorial's own 503 is untouched", async () => {
    const env = { EDGE: { fetch: () => Promise.reject(new Error("edge down")) } };
    const plp = await (await workerFetch(env, "/htmx/plp/")).text();
    expect(plp).toContain('<a class="pm-masthead__link" href="/react-next/plp/plain/" aria-current="page">Records</a>');
    expect(plp).not.toContain('href="/vanilla/editorial/" aria-current="page"');

    const editorial = await (await workerFetch(env, "/htmx/editorial/")).text();
    expect(editorial).toContain('<a class="pm-masthead__link" href="/vanilla/editorial/" aria-current="page">Editorial</a>');
    expect(editorial).not.toContain('href="/react-next/plp/plain/" aria-current="page"');
  });

  it("a malformed-but-200 payload hits the SAME boundary (the render is inside the guard)", async () => {
    // The editorial precedent (htmx-worker-fallback.test.ts): a tray that
    // is structurally degenerate but answers 200 throws during template
    // interpolation, and must not escape as pm-front's plain-text 502.
    const { env } = recordingEdge({ items: [{ title: "broken" }], page: 1 });
    const res = await workerFetch(env, "/htmx/plp/");
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('class="pm-masthead"');
  });

  /**
   * FOUND BY THE VERIFICATION PASS, and it is the one failure the branded
   * boundary could not see. The editorial route's `try` wraps its render
   * because a degenerate tray THROWS during interpolation; the PLP's render
   * does not throw on a bad payload, it interpolates. Measured before the
   * fix: a payload identical to `handlePlp`'s but with `perPage` renamed
   * rendered a **200** page carrying "Showing NaN–NaN of 240 releases" and
   * every href as `?page=N&n=undefined` — which `plp.js` would then announce
   * to a screen reader, and which the edge silently clamps back to n=24, so
   * a visitor on ?n=240 is reset by clicking "2". No gate could see it: the
   * identity legs assemble this payload themselves, so they pass by
   * construction whatever workers/edge returns.
   */
  it("a payload that does not match the tray contract is a 503, not a NaN page", async () => {
    const { lib } = await reference();
    const good = plpPayload(lib.loadSnapshot("fixture"));
    const broken = [
      ["perPage renamed", { ...good, perPage: undefined, pageSize: 24 }],
      ["page missing", { ...good, page: undefined }],
      ["total non-numeric", { ...good, total: "240" }],
      ["items not an array", { ...good, items: {} }],
      ["facets missing a bucket", { ...good, facets: { genres: [], styles: [] } }],
      ["facets absent", { ...good, facets: undefined }],
      ["totalPages NaN", { ...good, totalPages: Number.NaN }],
      // A pre-`v2:` tray — the shape before `applied` — must be a 503 at the
      // boundary, not a TypeError inside the template.
      ["applied absent", { ...good, applied: undefined }],
    ];
    for (const [label, payload] of broken) {
      const { env } = recordingEdge(payload);
      const res = await workerFetch(env, "/htmx/plp/");
      expect(res.status, `${label}: served a page instead of the branded 503`).toBe(503);
      const body = await res.text();
      expect(body).toContain('class="pm-masthead"');
      expect(body, `${label}: NaN reached the markup`).not.toContain("NaN");
      expect(body).not.toContain("undefined");
    }
    // Non-vacuity: the good payload still renders.
    const { env } = recordingEdge(good);
    expect((await workerFetch(env, "/htmx/plp/")).status).toBe(200);
  });

  /**
   * The contract driven DIRECTLY, and the reason that is not redundant with
   * the leg above: through `fetch`, the facets clauses are invisible.
   * Every malformed-`facets` payload also throws during interpolation, so
   * the route answers 503 either way — a sabotage deleting those clauses
   * produced NO failure at all. Reached directly, each clause is provable.
   */
  it("the tray contract rejects each malformed shape at the boundary, and accepts the real one", async () => {
    const { lib } = await reference();
    const { assertPlpPayload } = await import(
      pathToFileURL(join(repoRoot, "variants", "htmx", "src", "index.js")).href
    );
    const good = plpPayload(lib.loadSnapshot("fixture"));
    expect(() => assertPlpPayload("/api/plp", good)).not.toThrow();
    const broken = {
      "perPage renamed": { ...good, perPage: undefined, pageSize: 24 },
      "page missing": { ...good, page: undefined },
      "total non-numeric": { ...good, total: "240" },
      "totalPages NaN": { ...good, totalPages: Number.NaN },
      "items not an array": { ...good, items: {} },
      "facets absent": { ...good, facets: undefined },
      "facets missing formats": { ...good, facets: { genres: [], styles: [] } },
      "a facet bucket not an array": { ...good, facets: { ...good.facets, genres: {} } },
      "facets is a string": { ...good, facets: "genres" },
      "applied absent": { ...good, applied: undefined },
      "applied missing q": { ...good, applied: { genre: null, style: null, format: null, sort: null } },
      "null payload": null,
      "not an object": "items",
    };
    for (const [label, payload] of Object.entries(broken)) {
      expect(
        () => assertPlpPayload("/api/plp", payload),
        `${label}: the tray contract accepted a payload it must refuse`,
      ).toThrow(/PLP tray contract/);
    }
  });

  it("an edge 4xx/5xx is a data-plane failure, not a page rendered from nothing", async () => {
    const env = {
      EDGE: { fetch: () => Promise.resolve(new Response("nope", { status: 500 })) },
    };
    expect((await workerFetch(env, "/htmx/plp/")).status).toBe(503);
  });
});

/* ── The progressive-enhancement half of "loaders + PE". The pdp-controls
      lesson is the reason these legs exist at all: the drift gate is JS-OFF
      by construction, so an enhancement file is invisible to it, and on the
      PDP that let two advertised controls ship dead on ~500 pages because
      "no pre-merge check read pdp.js at all". This workspace now has a test
      script, so its enhancement is read pre-merge. The REAL source is
      evaluated against a linkedom document — what is under test is the bytes
      that ship, not a twin. ────────────────────────────────────────────── */

/** Evaluate src/plp.js against `doc` exactly as a browser would: the file is
 *  an IIFE closing over the `document` and `window` globals, so binding them
 *  as parameters is a faithful stand-in. `win` is the per-page object that
 *  carries the re-entrancy flag — one per document, as a browsing context
 *  has one per page — so passing the SAME `win` twice models an htmx history
 *  restore re-executing the file. */
function loadEnhancement(doc, win = {}) {
  const src = readFileSync(join(repoRoot, "variants", "htmx", "src", "plp.js"), "utf8");
  new Function("document", "window", src)(doc, win);
  return win;
}

describe("the PLP enhancement restores what the partial swap takes away", () => {
  /** A page-1 document with the enhancement installed, plus the helper that
   *  performs a page-2 swap the way hx-swap="outerHTML" would. */
  /** A page-1 document with the enhancement installed, and its Event ctor. */
  async function mountedDoc() {
    const { lib } = await reference();
    const parsed = parseHTML(renderPlpPage(plpPayload(lib.loadSnapshot("fixture"))));
    loadEnhancement(parsed.document);
    return parsed;
  }

  /**
   * FOUND BY THE VERIFICATION PASS. This file runs AGAIN on every htmx
   * history restore: `cleanInnerHtmlForHistory` (htmx.js:3237-3248) keeps
   * `<script>` elements in the snapshot, `allowScriptTags` defaults true
   * (:160), and `duplicateScript` (:549) builds a node the browser executes.
   * `document` survives the body swap, so its listeners accumulate — one
   * Back press and every later flip announces the range TWICE into a
   * role="status" region and focuses twice, growing with each Forward/Back
   * cycle. The file whose whole job is a11y parity would degrade the
   * enhanced path below the JS-off one.
   *
   * The original legs loaded the file exactly once per document, so
   * idempotence was never exercised.
   */
  it("re-executing on a history restore does not double the announcement", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const { document, Event } = parseHTML(renderPlpPage(plpPayload(snapshot)));
    const win = loadEnhancement(document);
    loadEnhancement(document, win); // the restore re-executes the same file
    loadEnhancement(document, win); // and again, on the next Back

    const status = document.querySelector("[data-pm-status]");
    let announcements = 0;
    Object.defineProperty(status, "textContent", {
      set() { announcements += 1; },
      get() { return ""; },
      configurable: true,
    });
    document.querySelector(".pm-plp").outerHTML = renderPlpFragment(
      plpPayload(snapshot, { n: 24, page: 2 }),
    );
    let focused = 0;
    document.querySelector(".pm-plp .pm-page__title").focus = () => { focused += 1; };
    document.dispatchEvent(new Event("htmx:afterSwap"));

    expect(announcements, "the live region was written more than once per swap").toBe(1);
    expect(focused, "focus() ran more than once per swap").toBe(1);
  });

  async function mounted() {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const { document, Event } = parseHTML(renderPlpPage(plpPayload(snapshot, { n: 24, page: 1 })));
    loadEnhancement(document);
    const swap = () => {
      const block = document.querySelector(".pm-plp");
      block.outerHTML = renderPlpFragment(plpPayload(snapshot, { n: 24, page: 2 }));
      document.dispatchEvent(new Event("htmx:afterSwap"));
    };
    return { document, swap };
  }

  it("the SERVED page carries no tabindex — the focus stop is script-only state", async () => {
    const { lib } = await reference();
    const html = renderPlpPage(plpPayload(lib.loadSnapshot("fixture")));
    // A rendered tabindex would be a focus stop that does nothing with JS
    // off — the pm-pdp__scroll defect — and it would be DOM drift besides.
    expect(html).not.toContain("tabindex");
  });

  it("before any swap it changes nothing (it is not firing on load)", async () => {
    const { document } = await mounted();
    expect(document.querySelector(".pm-page__title").getAttribute("tabindex")).toBeNull();
    expect(document.querySelector("[data-pm-status]").textContent).toBe("");
  });

  it("after a swap it focuses the heading and announces the new range", async () => {
    const { document, swap } = await mounted();
    swap();
    const heading = document.querySelector(".pm-plp .pm-page__title");
    // Programmatically focusable, never tab-reachable.
    expect(heading.getAttribute("tabindex")).toBe("-1");
    // The live region already exists in the shell, so this costs no markup.
    expect(document.querySelector("[data-pm-status]").textContent).toBe(
      "Showing 25–48 of 240 releases",
    );
  });

  it("focus() is actually CALLED on the heading, not merely made possible", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const { document, Event } = parseHTML(renderPlpPage(plpPayload(snapshot, { n: 24, page: 1 })));
    loadEnhancement(document);
    document.querySelector(".pm-plp").outerHTML = renderPlpFragment(
      plpPayload(snapshot, { n: 24, page: 2 }),
    );
    // linkedom implements focus() as a no-op and never moves activeElement,
    // so the call itself is what is observable here. DISCLOSED LIMIT: that
    // focus actually MOVES is a browser property this cannot prove; the
    // origin suite's JS-on leg is where that belongs.
    const heading = document.querySelector(".pm-plp .pm-page__title");
    let focused = 0;
    heading.focus = () => { focused += 1; };
    document.dispatchEvent(new Event("htmx:afterSwap"));
    expect(focused, "the enhancement never called focus() on the new heading").toBe(1);
  });

  /**
   * FOUND BY THE VERIFICATION PASS. htmx maps a 4xx/5xx to
   * `{ swap: false, error: true }` (`htmx.org@2.0.10/dist/htmx.js:267`), so
   * when the data plane is down a boosted click changes NOTHING — old grid,
   * URL not pushed, no message. With JS off the same click is a navigation
   * and the visitor gets the branded 503 shell. Without this listener the
   * ENHANCED path is the worse of the two, which is the one direction a
   * progressive enhancement must never fail in (ADR-0005 §1 "works JS-off"
   * is a parity claim).
   */
  it("a failed page-flip is announced, not swallowed", async () => {
    const { document, Event } = await mountedDoc();
    for (const type of ["htmx:responseError", "htmx:sendError"]) {
      document.querySelector("[data-pm-status]").textContent = "";
      document.dispatchEvent(new Event(type));
      expect(
        document.querySelector("[data-pm-status]").textContent,
        `${type} left the visitor with no cue at all`,
      ).toBe("Couldn't load that page — the list is unchanged.");
    }
  });

  it("a swap that produced no PLP block announces nothing rather than throwing", async () => {
    const { document, swap } = await mounted();
    void swap;
    document.querySelector(".pm-plp").remove();
    const { Event } = parseHTML("<html></html>");
    expect(() => document.dispatchEvent(new Event("htmx:afterSwap"))).not.toThrow();
    expect(document.querySelector("[data-pm-status]").textContent).toBe("");
  });

  /**
   * FOUND BY SABOTAGE, not by reading — the gap this leg closes was open
   * until a sabotage that added plp.js to EDITORIAL_SCRIPTS produced NO test
   * failure at all.
   *
   * Why it matters more than it looks: editorial is the one surface on this
   * variant with PUBLISHED byte receipts, and a `<script>` element is
   * invisible to every identity guard there is — the drift normalizer drops
   * script elements as delivery (ADR-0003 §2) and the byte-strict editorial
   * guard's own stripDelivery removes them before comparing. So a stray
   * script on editorial changes a published number and passes every existing
   * check silently. The scripts a surface serves are measured bytes even
   * when they are not contract markup, so the list is pinned per surface.
   */
  it("editorial ships exactly its own two scripts — no PLP enhancement leaks onto a surface with published numbers", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const policy = await import(
      pathToFileURL(join(repoRoot, "variants", "htmx", "src", "snapshot.mjs")).href
    );
    const id = policy.featuredIdFor(snapshot.manifest.crate);
    const featured = snapshot.details.find((d) => d.id === id);
    const html = renderEditorialPage({
      isFixture: policy.isFixtureCrate(snapshot.manifest.crate),
      capturedAt: snapshot.manifest.capturedAt,
      featured,
    });
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs).toEqual(["/htmx/assets/htmx.min.js", "/htmx/assets/cart.js"]);
  });

  /**
   * FOUND BY THE VERIFICATION PASS, and it is the SCRIPT hole's twin.
   *
   * The script-list leg above exists because a sabotage adding `plp.js` to
   * `EDITORIAL_SCRIPTS` passed every check. `<link rel="stylesheet">`
   * elements are invisible to exactly the same three checks — the
   * repo-checks editorial guard's `stripDelivery` deletes the whole `<head>`
   * before comparing, the drift normalizer drops `link` elements AND the
   * head subtree, and the origin suite's only head check for this page is a
   * COUNT (`>= 13`), which a tenth stylesheet still satisfies. And this
   * slice refactored editorial's stylesheet constant, splitting it into
   * `SHELL_CSS` + `EDITORIAL_CSS` so a third surface could share the base.
   *
   * So: one added entry in `SHELL_CSS`, or two of its five reordered, and
   * editorial silently gains a request or a different cascade — on the ONE
   * htmx surface with published byte receipts. The PLP got this leg
   * immediately; the surface with the receipts did not, which is the
   * standard applied backwards. (Verified byte-neutral today: the refactor
   * produces the same nine sheets in the same order.)
   */
  it("editorial links exactly ITS master's stylesheets, in order — the <link> twin of the script leg", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const editorial = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
    );
    const policy = await import(
      pathToFileURL(join(repoRoot, "variants", "htmx", "src", "snapshot.mjs")).href
    );
    const id = policy.featuredIdFor(snapshot.manifest.crate);
    const variant = sheets(
      renderEditorialPage({
        isFixture: policy.isFixtureCrate(snapshot.manifest.crate),
        capturedAt: snapshot.manifest.capturedAt,
        featured: snapshot.details.find((d) => d.id === id),
      }),
    );
    const master = sheets(editorial.renderEditorial(snapshot, { origin: "" }));
    expect(master.length).toBeGreaterThan(5);
    expect(variant).toEqual(master);
    // And the PLP's own sheets must not have leaked in.
    expect(variant).not.toContain("css/surfaces/plp.css");
    expect(variant).not.toContain("css/components/facets.css");
  });

  it("every page ships the cart enhancement — the masthead badge is the shell's contract, not editorial's", async () => {
    const { lib } = await reference();
    const html = renderPlpPage(plpPayload(lib.loadSnapshot("fixture")));
    // CART_CONTRACT (shell.mjs): "On every shell page load the enhancement
    // populates each [data-pm-cart-count] slot". Without cart.js here the
    // PLP's badge would be permanently empty — a dead control the shell
    // promises works on every surface.
    expect(html).toContain("data-pm-cart-count");
    expect(html).toContain('<script src="/htmx/assets/cart.js" defer></script>');
    expect(html).toContain('<script src="/htmx/assets/plp.js" defer></script>');
    expect(html).toContain('<script src="/htmx/assets/htmx.min.js" defer></script>');
  });
});

describe("the served surface is honest about what it can do", () => {
  /**
   * Until 2026-09-04 this block was the `plp-params-not-yet-honoured`
   * TRIPWIRE: it pinned that the rail, the search form, the sort select and
   * `components/facets.css` were ABSENT, and read `workers/edge/src/index.js`
   * from disk to fail the day a param was wired through without the UI
   * coming back. The params are wired and the UI is back, so the tripwire
   * has done its job and is retired — replaced by the honest inverse,
   * proven by REQUEST rather than by grep: every restored control is served,
   * and the data plane it navigates to actually filters.
   */
  it("ships every navigation affordance, and the data plane honours each one", async () => {
    const { lib } = await reference();
    const snapshot = lib.loadSnapshot("fixture");
    const html = renderPlpPage(plpPayload(snapshot));
    for (const present of [
      '<form class="pm-toolbar__search"',
      '<form class="pm-toolbar__sort"',
      'class="pm-toolbar__select"',
      'class="pm-facets__facet"',
      '<nav class="pm-facets" aria-label="Filters"',
      "components/facets.css",
      '<a class="pm-pagination__link" href="?page=2">2</a>',
    ]) {
      expect(html, `${present} is missing from the served PLP`).toContain(present);
    }
    // Each control's param, honoured by the real Worker: a different tray
    // comes back, and it is the filtered/sorted/searched one.
    const { genre } = restoredConditions(snapshot)[0].query;
    const base = (await servedTray(snapshot, { n: 240 })).tray;
    const byGenre = (await servedTray(snapshot, { n: 240, genre })).tray;
    expect(byGenre.total).toBeLessThan(base.total);
    expect(byGenre.applied.genre).toBe(genre);
    const sorted = (await servedTray(snapshot, { n: 240, sort: "year-asc" })).tray;
    expect(sorted.items.map((s) => s.id)).not.toEqual(base.items.map((s) => s.id));
    expect(sorted.applied.sort).toBe("year-asc");
    const word = restoredConditions(snapshot)[2].query.q;
    const searched = (await servedTray(snapshot, { n: 240, q: word })).tray;
    expect(searched.total).toBeLessThan(base.total);
    expect(searched.total).toBeGreaterThan(0);
    // And junk is a 400 from the plane — which the Worker turns into the 404 above.
    expect((await servedTray(snapshot, { genre: "Junk" })).status).toBe(400);
  });

  it("the default sort is labelled for what it is — committed order — never 'Popularity'", async () => {
    // snapshot-capture normalize.ts: rows are id-ascending, "the one
    // neutral, deterministic order that is not a presentation choice". The
    // pre-2026-08-29 master called that option "Popularity", which it is not.
    const { lib } = await reference();
    const html = renderPlpPage(plpPayload(lib.loadSnapshot("fixture")));
    expect(html).toContain('<option value="" selected>Catalogue order</option>');
    expect(html).not.toContain("Popularity");
  });
});
