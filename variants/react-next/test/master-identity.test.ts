/**
 * Pre-merge identity + fencing guards for the react-next PLP (the PLP build's
 * data-strategy slice). Everything here runs in-process: no plane, no browser,
 * no image bytes.
 *
 * WHY IT LIVES HERE AND NOT IN tools/repo-checks. react-next's editorial and
 * PDP identity guards are in `tools/repo-checks/test/variant-master-identity.test.ts`
 * (:387 and :516) because `render.tsx` is framework-neutral React and needs no
 * compiler — astro and qwik keep theirs in-workspace only because they need
 * their framework's. This surface is the first react-next one that DOES need
 * workspace-local machinery: the fenced exhibit imports `apollo-link-rest`,
 * whose published entry is loadable only through a bundler (see
 * `src/components/PlpApollo.tsx`), which is what `vitest.config.ts`'s
 * `ssr.noExternal` line exists for. Routing every repo-wide structural check
 * through that is the exact coupling the astro note at
 * `variant-master-identity.test.ts:493-503` refuses. So react-next's guards are
 * now SPLIT across two homes, deliberately, and consolidating them is an
 * integration decision rather than a silent one.
 *
 * This file is also what earns `@pm/react-next` its first `test` script: the
 * package contributed exactly one task (`typecheck`) to turbo's 30 before this.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApolloProvider } from "@apollo/client/react";
import {
  Fragment,
  createElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlpPage } from "@pm/data-contract";
import { NO_NOISE, PAGE_NORMALIZE, PERMITTED_NOISE, firstDomDivergence, type NoiseSpec } from "@pm/drift-gate";
import { PLP_N, clampN } from "@pm/measurement";
import edgeWorker from "../../../workers/edge/src/index.js";
import { PLP_APOLLO_CSS, PLP_CSS, Document } from "../src/lib/document";
import { PER_PAGE, PlpArticle, clampPlpN, clampPlpPage } from "../src/lib/plp";
import {
  PLP_FACET_PARAMS,
  PLP_RUN_RE,
  PLP_SORTS,
  PLP_STALE_TIME_MS,
  appliedMatches,
  conditionFromSearchParams,
  normalizePlpQ,
  plpApiPath,
  sameCondition,
  plpHistoryUrl,
  readPlpCondition,
  type PlpCondition,
} from "../src/lib/plp-condition";
import { APOLLO_EXHIBIT, PlpApolloPlaque } from "../src/lib/plp-fence";
import { Shell } from "../src/lib/render";
import { PlpPlain, paginate } from "../src/components/PlpPlain";
import {
  PlpTanstack,
  PlpTanstackInner,
  createSeededQueryClient,
  plpQueryKey,
  plpQueryOptions,
} from "../src/components/PlpTanstack";
import {
  APOLLO_CACHE_WINDOW,
  PLP_QUERY,
  PlpApollo,
  PlpApolloInner,
  createSeededApolloClient,
  plpApolloQueryOptions,
} from "../src/components/PlpApollo";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const SNAPSHOT_DIRS = {
  fixture: join(repoRoot, "tools", "snapshot-fixture", "snapshot"),
  crate: join(repoRoot, "tools", "snapshot-capture", "crate"),
} as const;

const REACT_NEXT_NOISE = PERMITTED_NOISE["react-next"]!;

/** A real browser's HTML tokenizer lowercases attribute names; linkedom's
 *  parser does not. React spells the PLP master's `fetchpriority="high"` as
 *  the `fetchPriority` prop and emits it camel-cased into the wire bytes, so
 *  without this pre-pass card 1 diverges from the master for a reason no
 *  visitor's browser could ever see. Same fixup, same reason, as
 *  `tools/repo-checks/test/variant-master-identity.test.ts:390-409`. */
function lowercaseAttributeNames(document: ReturnType<typeof parseHTML>["document"]): void {
  for (const el of document.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const lower = attr.name.toLowerCase();
      if (lower !== attr.name) {
        const value = attr.value;
        el.removeAttribute(attr.name);
        el.setAttribute(lower, value);
      }
    }
  }
}

/** `PAGE_NORMALIZE` is written to run INSIDE a driven browser — self-contained,
 *  reading `document`/`Node` as globals. linkedom supplies same-shape globals;
 *  install them for the one SYNCHRONOUS call, then restore. */
function normalizeHtml(html: string, noise: NoiseSpec, dropFencedSubtrees = false): string {
  const { document, Node } = parseHTML(html);
  lowercaseAttributeNames(document);
  const g = globalThis as unknown as { document?: unknown; Node?: unknown };
  const prevDocument = g.document;
  const prevNode = g.Node;
  g.document = document;
  g.Node = Node;
  try {
    return PAGE_NORMALIZE({
      attrPatterns: [...noise.attrPatterns],
      classPatterns: [...noise.classPatterns],
      behaviorAttrPatterns: [...noise.behaviorAttrPatterns],
      dropElementSelectors: noise.dropElementSelectors ? [...noise.dropElementSelectors] : [],
      dropFencedSubtrees,
    });
  } finally {
    g.document = prevDocument;
    g.Node = prevNode;
  }
}

const documentOf = (body: string) =>
  `<!doctype html><html lang="en"><head></head><body>${body}</body></html>`;

/** `Shell` with `children` passed as a PROP rather than as createElement's
 *  variadic tail: `Shell`'s props type declares `children` required, and the
 *  variadic overload does not satisfy it. The repo-checks guards get away with
 *  the tail form only because they reach `Shell` through a dynamic import,
 *  which is `any`. */
const shellHtml = (...children: ReactNode[]): string =>
  renderToStaticMarkup(
    createElement(Shell, {
      current: "plp",
      children: children.length === 1 ? children[0] : createElement(Fragment, null, ...children),
    }),
  );

const countFenced = (html: string) => (html.match(/data-pm-fenced/g) ?? []).length;

/**
 * The REAL edge Worker, driven in-process over a committed snapshot.
 *
 * This is deliberately not a hand-built payload. `renderPlp` computes its facet
 * buckets itself (`packages/reference/render/plp.mjs:28-41`) and the Worker
 * computes them again (`workers/edge/src/index.js:101-119`); the renderer's own
 * comment says the two comparators "must match the Worker byte-for-byte or the
 * crate-plane drift leg diverges", and NO TEST anywhere compares them
 * (`git grep -c computeFacets ae97f8e` — 8 hits at this branch's base commit:
 * two definitions, two call sites, four prose mentions, not one assertion.
 * Pinned to the SHA rather than to "the tree", because this comment is itself
 * one of the tree's hits.) Feeding this variant the Worker's real
 * output and comparing the
 * rendered rail against the reference's makes the identity legs below pin that
 * agreement as a side effect — on both committed snapshots, where the ICU
 * disagreement the renderer's comment records was found.
 */
function stubEnv(dir: string) {
  const files: Record<string, string> = {
    "snapshot/summaries.json": readFileSync(join(dir, "summaries.json"), "utf8"),
    "snapshot/details.json": readFileSync(join(dir, "details.json"), "utf8"),
  };
  const warm = new Map<string, string>();
  return {
    SNAPSHOT: {
      get: (k: string) =>
        Promise.resolve(
          files[k] === undefined
            ? null
            : { json: () => Promise.resolve(JSON.parse(files[k]!) as unknown) },
        ),
    },
    WARM: {
      get: (k: string) => Promise.resolve(warm.get(k) ?? null),
      put: (k: string, v: string) => {
        warm.set(k, v);
        return Promise.resolve();
      },
    },
  };
}

async function servedTray(snapshot: keyof typeof SNAPSHOT_DIRS, condition: PlpCondition) {
  const res = await (edgeWorker as { fetch: (r: Request, e: unknown) => Promise<Response> }).fetch(
    new Request(`https://pm-edge${plpApiPath(condition)}`),
    stubEnv(SNAPSHOT_DIRS[snapshot]),
  );
  expect(res.status, `edge worker refused ${plpApiPath(condition)}`).toBe(200);
  return (await res.json()) as PlpPage;
}

const condition = (over: Partial<PlpCondition> = {}): PlpCondition => ({
  n: PER_PAGE,
  page: 1,
  cache: "cold",
  run: "",
  profile: "",
  genre: null,
  style: null,
  format: null,
  sort: null,
  q: null,
  ...over,
});

/** The reference's OWN modules, by path (a paradigm never declares the spec —
 *  ADR-0004 §2): the query semantics the Worker serves from, and the renderer
 *  whose href rule this variant re-types. */
async function loadReferenceQuery() {
  return (await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "plp-query.mjs")).href
  )) as {
    normalizeQ: (raw: string | null | undefined) => string | null;
    facetValueSets: (s: unknown[]) => { genre: Set<string>; style: Set<string>; format: Set<string> };
  };
}
async function loadReferenceHref() {
  return (await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "plp.mjs")).href
  )) as { conditionHref: (c: Partial<Record<keyof PlpCondition, unknown>>) => string };
}

/** The conditions the committed master cannot express, one per restored
 *  control, with values found in the snapshot rather than typed. */
function restoredConditions(summaries: { genres: string[]; styles: string[]; title: string }[]) {
  const genre = summaries[0]!.genres[0]!;
  const styleCounts = new Map<string, number>();
  for (const s of summaries) for (const v of s.styles) styleCounts.set(v, (styleCounts.get(v) ?? 0) + 1);
  const ranked = [...styleCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const rareStyle = ranked[ranked.length - 1]![0];
  const word = summaries[3]!.title.split(" ").find((w) => /^[A-Za-z]{3,}$/.test(w))!;
  return [
    { label: "genre", over: { genre } },
    { label: "rare style", over: { style: rareStyle } },
    { label: "search", over: { q: word } },
    { label: "sort", over: { sort: "price-desc" } },
    {
      label: "deep page + every knob",
      over: { page: 2, genre, sort: "title", cache: "cold" as const, run: "bench-abc", profile: "slow-4g-mid-phone" },
    },
  ];
}

async function loadReference() {
  const lib = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
  );
  const plp = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "plp.mjs")).href
  );
  return { lib, plp } as {
    lib: { loadSnapshot: (n: string) => { summaries: { genres: string[]; styles: string[]; title: string }[] } };
    plp: { renderPlp: (s: unknown, o: Record<string, unknown>) => string };
  };
}

/* ── 1. The catalogue equals the master ───────────────────────────────────── */

describe("react-next PLP equals the master by normalized DOM (pre-merge)", () => {
  // Both committed snapshots, and BOTH ends of the `n` knob the switcher
  // offers. The committed master exists only at n=24 (`renderPlp` defaults to
  // PER_PAGE and the master carries exactly 24 cards), so n=240 is compared
  // against the RENDERER rather than the artifact — which is the only place
  // that condition is expressible at all, and the reason this guard is written
  // against `renderPlp` rather than against the HTML file.
  //
  // The axis is the CONDITION, not the tray: `renderPlp` reads
  // `snapshot.summaries` and slices (`plp.mjs:71`), so the PDP guards'
  // per-tray sweep shape does not transfer — repeating one page 240 times
  // would prove one thing slowly.
  for (const name of ["fixture", "crate"] as const) {
    for (const n of [PLP_N.default, PLP_N.max]) {
      it(`${name}: n=${n} matches renderPlp, over the real edge Worker's tray`, async () => {
        const { lib, plp } = await loadReference();
        const snapshot = lib.loadSnapshot(name);
        const master = plp.renderPlp(snapshot, { origin: "", n });
        expect(master).not.toBe("");

        const payload = await servedTray(name, condition({ n }));
        const body = shellHtml(createElement(PlpArticle, { payload }));

        const masterDom = normalizeHtml(master, NO_NOISE);
        const variantDom = normalizeHtml(documentOf(body), REACT_NEXT_NOISE);
        expect(variantDom).not.toBe("");
        expect(variantDom).toContain("pm-plp__results");
        expect(
          variantDom === masterDom ? undefined : firstDomDivergence(masterDom, variantDom, 4),
        ).toBeUndefined();
        expect(variantDom).toBe(masterDom);

        // Non-vacuity: the comparison must have had the whole catalogue in it,
        // not an empty grid that trivially equals an empty grid.
        expect(payload.items.length).toBe(n);
        expect((variantDom.match(/<li class="pm-release-card">/g) ?? []).length).toBe(n);
        // The budget catches a HANG; it is not fitted to a local timing. The
        // heaviest leg here is 107 ms locally (n=240, 240 cards through React
        // SSR and linkedom, twice), and this repo's own measured local→CI
        // ratios span 2.1×–15.5× on one runner in one run — so a fitted
        // budget cannot be trusted in either direction. This is the bench
        // runner's 300_000, the same figure the PDP sweeps took after
        // vitest's 5 s default failed PR #30's check job and skipped its
        // deploy.
      }, 300_000);
    }
  }

  it("matches the COMMITTED master artifact, not only the renderer", async () => {
    // The renderer and the artifact are held together by @pm/reference's own
    // re-render leg; this pins that THIS page matches the bytes actually
    // served to a visitor, so a stale committed master cannot pass both sides.
    const master = readFileSync(
      join(repoRoot, "packages", "reference", "surfaces", "plp", "index.html"),
      "utf8",
    );
    const payload = await servedTray("fixture", condition());
    const body = shellHtml(createElement(PlpArticle, { payload }));
    expect(normalizeHtml(documentOf(body), REACT_NEXT_NOISE)).toBe(
      normalizeHtml(master, NO_NOISE),
    );
  });

  it("adds NO permitted noise of its own: it also matches under NO_NOISE", async () => {
    // Measured, not assumed (the astro/htmx precedent). react-next's
    // registration exists for App Router's streaming wrapper, which
    // `renderToStaticMarkup` never emits — so this leg would pass under the
    // registration whatever it said, and saying so is the honest form. What
    // this DOES prove is that the PLP surface introduces no NEW noise species:
    // no scoping hashes, no hydration-marker attributes, nothing that would
    // need a sixth line in `PERMITTED_NOISE["react-next"]`.
    const { lib, plp } = await loadReference();
    const snapshot = lib.loadSnapshot("fixture");
    const payload = await servedTray("fixture", condition());
    const body = shellHtml(createElement(PlpArticle, { payload }));
    expect(normalizeHtml(documentOf(body), NO_NOISE)).toBe(
      normalizeHtml(plp.renderPlp(snapshot, { origin: "", n: PER_PAGE }), NO_NOISE),
    );
  });

  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: matches renderPlp at every RESTORED condition — a facet, a rare style, a search, a sort, a deep page with every knob`, async () => {
      // The conditions the committed master cannot express, rendered by the
      // reference for the same query and compared normalized. The tray is the
      // REAL Worker's, so this also proves the Worker forwards and filters.
      const { lib, plp } = await loadReference();
      const snapshot = lib.loadSnapshot(name);
      for (const { label, over } of restoredConditions(snapshot.summaries)) {
        const cond = condition(over);
        const payload = await servedTray(name, cond);
        const carry = { cache: cond.cache, run: cond.run, profile: cond.profile };
        const body = shellHtml(createElement(PlpArticle, { payload, carry }));
        const master = plp.renderPlp(snapshot, {
          origin: "",
          n: cond.n,
          page: cond.page,
          genre: cond.genre,
          style: cond.style,
          format: cond.format,
          sort: cond.sort,
          q: cond.q,
          cache: cond.cache,
          run: cond.run,
          profile: cond.profile,
        });
        const variantDom = normalizeHtml(documentOf(body), REACT_NEXT_NOISE);
        const masterDom = normalizeHtml(master, NO_NOISE);
        expect(payload.items.length, `${name}/${label} served nothing`).toBeGreaterThan(0);
        expect(
          variantDom === masterDom ? undefined : `${label}: ${firstDomDivergence(masterDom, variantDom, 4)}`,
        ).toBeUndefined();
        expect(variantDom).toBe(masterDom);
      }
    }, 300_000);
  }
});

/* ── 2. Every strategy serves the same contract ───────────────────────────── */

describe("all three strategy routes serve the master's markup", () => {
  // The whole premise of the surface: the measured variable is WHERE THE DATA
  // LAYER LIVES, so the served DOM must be identical across strategies or the
  // comparison is measuring markup instead. Each island is rendered through
  // its real provider stack — the same server output the drift gate sees
  // JS-off, and the same one a visitor gets before hydration.
  it("plain, tanstack and apollo all render the master's catalogue", async () => {
    const { lib, plp } = await loadReference();
    const snapshot = lib.loadSnapshot("fixture");
    // The islands are served under `condition()` — cache cold — and carry the
    // column into every in-surface href and both forms' hidden inputs (the
    // one href rule), so the master is rendered for the SAME condition.
    const masterDom = normalizeHtml(
      plp.renderPlp(snapshot, { origin: "", n: PER_PAGE, cache: "cold" }),
      NO_NOISE,
    );
    const initial = await servedTray("fixture", condition());
    const cond = condition();

    const islands = {
      plain: createElement(PlpPlain, { initial, condition: cond }),
      tanstack: createElement(PlpTanstack, { initial, condition: cond }),
      apollo: createElement(PlpApollo, { initial, condition: cond }),
    };

    for (const [strategy, island] of Object.entries(islands)) {
      const body = shellHtml(island);
      const dom = normalizeHtml(documentOf(body), REACT_NEXT_NOISE);
      expect(dom, `${strategy} did not render the catalogue`).toContain("pm-release-card");
      expect(
        dom === masterDom ? undefined : `${strategy}: ${firstDomDivergence(masterDom, dom, 4)}`,
      ).toBeUndefined();
    }
  }, 300_000);

  it("both client caches are really SEEDED — the render's `?? initial` is a floor, not the mechanism", async () => {
    // Non-vacuity for this file's own guard. The two islands render
    // `data ?? initial`, so the markup legs above pass whether or not the
    // cache holds anything — a cache that never held the tray would fire a
    // request the server already paid for on every first load, and "a revisit
    // costs 0 requests" would be false with nothing red. So the seed is
    // asserted through the SAME key/document the components read, not through
    // the rendered output.
    const initial = await servedTray("fixture", condition());
    const cond = condition();

    const qc = createSeededQueryClient(cond, initial);
    expect(qc.getQueryState(plpQueryKey(cond))?.status).toBe("success");
    expect((qc.getQueryData(plpQueryKey(cond)) as PlpPage | undefined)?.items.length).toBe(
      PER_PAGE,
    );
    // The published window must actually be in force on that client, or the
    // seeded entry is stale on arrival and refetches anyway (ADR-0005 §4's
    // whole point).
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(PLP_STALE_TIME_MS);
    // The lead's SECOND non-default knob. TanStack retries 3× with backoff by
    // default; this arm does not, so a failed page change reaches the error
    // floor at once instead of after three silent re-requests that would put
    // bytes and seconds into an interaction cell without appearing in any
    // receipt. ADR-0005 §4 says configuration is published copy, and this one
    // was published nowhere until a lens asked — so it is asserted here as
    // well as stated, because an unasserted published knob is the shape this
    // file has caught sixteen times.
    expect(qc.getDefaultOptions().queries?.retry).toBe(false);

    const apollo = createSeededApolloClient(cond, initial);
    const read = apollo.cache.readQuery({
      query: PLP_QUERY,
      variables: { path: plpApiPath(cond) },
    }) as { plp?: { items?: unknown[] } } | null;
    expect(read, "the Apollo cache was not seeded").not.toBeNull();
    expect(read?.plp?.items?.length).toBe(PER_PAGE);
    // A DIFFERENT condition must NOT resolve from the seed — otherwise the
    // key is not carrying the condition and a paginate click would show the
    // wrong page from cache.
    expect(
      apollo.cache.readQuery({
        query: PLP_QUERY,
        variables: { path: plpApiPath(condition({ page: 2 })) },
      }),
    ).toBeNull();
    expect(qc.getQueryState(plpQueryKey(condition({ page: 2 })))).toBeUndefined();
  });
});

/* ── 2b. Beyond the contract: page >= 2, and where the master's own link goes ─ */

describe("pages the reference cannot render", () => {
  // `renderPlp` takes no `page` argument (plp.mjs:70) — it renders page 1 from
  // `summaries.slice(0, n)` and always marks "1" current — while the master it
  // produces links `?page=2..5` on every visit. This build generalizes rather
  // than 404ing those links or serving page 1 under a page-2 URL, and the
  // generalization is PINNED here because it is not in the contract and the
  // parallel htmx PLP has to match it. At page 1 it reduces to the master
  // exactly, which the identity legs above prove.
  it("page 2 moves the current marker and the count window, and points Next at 3", async () => {
    const payload = await servedTray("fixture", condition({ page: 2 }));
    const html = renderToStaticMarkup(
      createElement(PlpArticle, { payload }),
    );
    expect(html).toContain(">Showing <");
    expect(html).toContain('<span class="pm-toolbar__n">25–48</span>');
    expect(html).toContain(
      '<span class="pm-pagination__link pm-pagination__link--current" aria-current="page">2</span>',
    );
    expect(html).toContain('href="?page=1"');
    // The NEXT ANCHOR specifically, not `href="?page=3"` anywhere — at page 2
    // the numbered link for 3 carries that href too, so the looser assertion
    // survived hardcoding Next back to page 2 (proven by sabotage). Match the
    // whole element.
    expect(html).toContain(
      '<a class="pm-pagination__link" href="?page=3" rel="next">Next</a>',
    );
    // Exactly one current marker in the pagination, as the master has.
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
  });

  it("EVERY page with content carries exactly one aria-current, including page 10", async () => {
    // The leg that would have caught this unit's own worst defect. The first
    // draft anchored the pagination window at [1..5] the way `renderPlp` does
    // (`plp.mjs:88`) — correct there, because the reference only ever renders
    // page 1, but generalized to page N it means no rendered link equals the
    // served page from page 6 on, so a FULL grid of 24 real cards shipped with
    // ZERO `aria-current`. One click from page 5's own Next link. The
    // page-2-only guard could not see it; sweeping every page can.
    for (const page of [1, 2, 3, 5, 6, 9, 10]) {
      const payload = await servedTray("fixture", condition({ page }));
      expect(payload.items.length, `page ${page} served nothing`).toBe(PER_PAGE);
      const html = renderToStaticMarkup(createElement(PlpArticle, { payload }));
      expect(
        (html.match(/aria-current="page"/g) ?? []).length,
        `page ${page} does not carry exactly one aria-current`,
      ).toBe(1);
      expect(
        html,
        `page ${page}'s current marker is on the wrong page`,
      ).toContain(
        `<span class="pm-pagination__link pm-pagination__link--current" aria-current="page">${page}</span>`,
      );
    }
  });

  it("Next is not emitted past the last page, and an empty page reads 0", async () => {
    // This leg used to PIN the opposite. `plp.mjs` emitted `rel="next"`
    // unconditionally, so on the FIXTURE at n=240 (one page of 240) the
    // served master linked `?page=2&n=240` — the very next click into an
    // empty page — and this arm mirrored it, rendering "0–0" and ZERO
    // `aria-current`. htmx's arm did NOT mirror it: it gated the link and
    // rendered "0". Two arms, one URL, structurally different DOM, and
    // nothing could see it because the only thing either was compared
    // against rendered page 1.
    //
    // The reference is now page-aware and gates on `page < totalPages`, so
    // there is one answer. Scoped to the fixture deliberately: the crate
    // holds 500 releases, so n=240 is THREE pages there and its first empty
    // page is 4 — the defect was the same either way (the link appeared at
    // the LAST page of every `n`); only "one click" was a fixture fact.
    const payload = await servedTray("fixture", condition({ n: 240, page: 2 }));
    expect(payload.totalPages).toBe(1);
    expect(payload.items.length).toBe(0);
    const html = renderToStaticMarkup(createElement(PlpArticle, { payload }));
    expect((html.match(/<li class="pm-release-card">/g) ?? []).length).toBe(0);
    expect(html).toContain('<span class="pm-toolbar__n">0</span>');
    expect(html).not.toContain('<span class="pm-toolbar__n">0–0</span>');
    expect(html).toContain('<span class="pm-toolbar__n">240</span>');
    expect(html).not.toContain('rel="next"');
  });

  it("the last real page offers no Next, and the page before it does", async () => {
    // The boundary the gate is actually about, on the crate where n=240 gives
    // three pages. Page 2 must offer Next; page 3 — the last real page — must
    // not. Without this, `hasNext` could be hardcoded false and the leg above
    // would still pass.
    const last = await servedTray("crate", condition({ n: 240, page: 3 }));
    expect(last.totalPages).toBe(3);
    expect(last.items.length).toBeGreaterThan(0);
    const lastHtml = renderToStaticMarkup(createElement(PlpArticle, { payload: last }));
    expect(lastHtml).not.toContain('rel="next"');

    const mid = await servedTray("crate", condition({ n: 240, page: 2 }));
    const midHtml = renderToStaticMarkup(createElement(PlpArticle, { payload: mid }));
    expect(midHtml).toContain('rel="next"');
  });

  it("the toolbar carries the count, the search form and the sort form; the body carries the rail", async () => {
    // Until 2026-09-04 this leg pinned the OPPOSITE — that the rail and both
    // forms were absent — because the edge Worker honoured none of the params
    // they navigated to. It honours all five now, so the controls are back
    // and this pins that they stay.
    const payload = await servedTray("crate", condition());
    const html = renderToStaticMarkup(createElement(PlpArticle, { payload }));
    expect(html).toContain('class="pm-toolbar__count"');
    // React orders a form's `action` first and spells `autoComplete` as
    // written (a browser lowercases it on parse, which the identity legs
    // account for); these are substring checks, so they name attributes,
    // not attribute order.
    for (const present of [
      '<nav class="pm-facets" aria-label="Filters">',
      'class="pm-toolbar__search"',
      'class="pm-toolbar__sort"',
      'method="get"',
      'class="pm-toolbar__select"',
      'class="pm-toolbar__input"',
      'name="q"',
      'name="sort"',
      '<option value="" selected="">Catalogue order</option>',
    ]) {
      expect(html, `${present} is missing from the served PLP`).toContain(present);
    }
    expect((html.match(/<form /g) ?? []).length).toBe(2);
    expect(html).not.toContain("Popularity");
  });

  it("everything rendered comes from the PAYLOAD: the same tray under two conditions is byte-identical except for the carried knobs", async () => {
    // The in-flight rule (plp.tsx header): under keepPreviousData the previous
    // tray is on screen while a new condition is in flight, so the selected
    // facet, the sort and the search value must come from `payload.applied`,
    // never from the condition — or a toggle-off link would not toggle off.
    // `carry` (cache/run/profile) is the ONLY thing a condition may add.
    const { lib } = await loadReference();
    const { genre } = restoredConditions(lib.loadSnapshot("crate").summaries)[0]!.over;
    const payload = await servedTray("crate", condition({ genre }));
    const a = renderToStaticMarkup(createElement(PlpArticle, { payload }));
    const b = renderToStaticMarkup(createElement(PlpArticle, { payload, carry: { cache: "default", run: "", profile: "" } }));
    expect(b).toBe(a);
    // The selected state is the payload's, whatever a caller might think the condition is.
    expect(a).toContain('aria-current="true"');
    expect(a).toContain(`<span class="pm-facets__value">${genre}</span>`);
    // And carry changes hrefs ONLY: strip every href and the two renders are equal.
    const c = renderToStaticMarkup(
      createElement(PlpArticle, { payload, carry: { cache: "cold", run: "r1", profile: "slow-4g-mid-phone" } }),
    );
    const noHrefs = (h: string) => h.replace(/ href="[^"]*"/g, "").replace(/<input type="hidden"[^>]*>/g, "");
    expect(noHrefs(c)).toBe(noHrefs(a));
    expect(c).toContain("cache=cold&amp;run=r1&amp;profile=slow-4g-mid-phone");
  });

  it("facet hrefs URL-encode every crate value that needs it — in the form-submit spelling", async () => {
    // UN-SKIPPED with the rail (it was skipped, not deleted, on 2026-08-29).
    // 119 of the crate's 213 facet values carry a character that must be
    // encoded — `&`, commas, spaces, quotes, a non-ASCII glyph. The spelling
    // is `URLSearchParams`' (`+` for a space), the same encoding a browser
    // gives a GET form submit, so the rail's links and a JS-off search spell
    // one condition alike (the reference's conditionHref rule).
    const payload = await servedTray("crate", condition());
    const html = renderToStaticMarkup(createElement(PlpArticle, { payload }));
    const rendered = [
      ...payload.facets.genres,
      ...payload.facets.styles.slice(0, 12),
      ...payload.facets.formats.slice(0, 8),
    ].map((b) => b.value);
    const tricky = rendered.filter((v) => /[&,\s"]/.test(v));
    expect(tricky.length, "the crate lost its awkward facet values").toBeGreaterThan(8);
    expect(rendered).toContain("Folk, World, & Country");
    expect(rendered).toContain('12"');
    expect(rendered).toContain("33 ⅓ RPM");
    const formEncoded = (v: string) => new URLSearchParams({ v }).toString().slice(2);
    for (const v of tricky) {
      expect(html, `facet "${v}" is not encoded in its href`).toContain(`=${formEncoded(v)}"`);
    }
    // The two shapes that break a naive encoder: an ampersand (which must not
    // become a second query param) and a non-ASCII glyph.
    expect(html).toContain('href="?genre=Folk%2C+World%2C+%26+Country"');
    expect(html).toContain('href="?format=33+%E2%85%93+RPM"');
    expect(html).toContain('href="?format=12%22"');
    // And every one of them round-trips through the REAL Worker to a 200.
    for (const v of tricky.slice(0, 6)) {
      const param = payload.facets.genres.some((b) => b.value === v)
        ? "genre"
        : payload.facets.styles.some((b) => b.value === v)
          ? "style"
          : "format";
      const tray = await servedTray("crate", condition({ [param]: v }));
      expect(tray.applied[param as "genre" | "style" | "format"], v).toBe(v);
    }
  }, 300_000);
});

describe("the cache arms actually READ their cache, at the key the condition names", () => {
  // Eight sabotages survived this file before these legs existed, and they
  // share a cause: every leg proved a constant or a WRITE, and none proved the
  // READ. Pointing either hook at page 1's key, swapping Apollo to
  // `network-only`, or deleting the cache read outright all stayed green,
  // because both islands render `data ?? initial` and every test passed the
  // matching `initial`.
  //
  // The seam: seed a cache with payload X under ONE condition, then render the
  // island's inner component for a DIFFERENT condition with `initial` = Y. A
  // component that reads its cache at the condition's key renders Y (a miss);
  // one pinned to the seeded key renders X. The two are distinguishable
  // without a DOM, which is what makes this a test rather than a comment.
  const idsOf = (html: string) =>
    [...html.matchAll(/\/vanilla\/pdp\/(\d+)-/g)].map((m) => m[1]);

  it("tanstack reads at the SERVED condition's key, not a pinned one", async () => {
    const pageOne = await servedTray("fixture", condition({ page: 1 }));
    const pageTwo = await servedTray("fixture", condition({ page: 2 }));
    // Precondition: the two pages must actually differ, or every assertion
    // below is satisfied by either one.
    expect(pageOne.items[0]!.id).not.toBe(pageTwo.items[0]!.id);

    // Cache holds PAGE ONE. The component is asked for PAGE TWO with page
    // two's tray as `initial`.
    const client = createSeededQueryClient(condition({ page: 1 }), pageOne);
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client, children: null },
        createElement(PlpTanstackInner, {
          initial: pageTwo,
          condition: condition({ page: 2 }),
        }),
      ),
    );
    // Page two's ids: a miss at page two's key, falling through to `initial`.
    // If the key were pinned to page one, page ONE's ids would render.
    expect(idsOf(html)[0]).toBe(pageTwo.items[0]!.id.toString());
    expect(idsOf(html)).not.toContain(pageOne.items[0]!.id.toString());

    // And the SEEDED condition really does read back — otherwise the leg above
    // would pass against a cache that holds nothing at all.
    const hit = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client, children: null },
        createElement(PlpTanstackInner, {
          initial: pageTwo,
          condition: condition({ page: 1 }),
        }),
      ),
    );
    expect(idsOf(hit)[0]).toBe(pageOne.items[0]!.id.toString());
  });

  it("apollo reads its cache under cache-first — not `initial`, and not the network", async () => {
    const pageOne = await servedTray("fixture", condition({ page: 1 }));
    const pageTwo = await servedTray("fixture", condition({ page: 2 }));
    // Cache seeded for PAGE ONE; component asked for PAGE ONE but handed page
    // TWO as `initial`. A component that ignores its cache (or fetches instead
    // of reading it) renders page two's ids; one that reads renders page one's.
    const client = createSeededApolloClient(condition({ page: 1 }), pageOne);
    const html = renderToStaticMarkup(
      createElement(
        ApolloProvider,
        { client, children: null },
        createElement(PlpApolloInner, {
          initial: pageTwo,
          condition: condition({ page: 1 }),
        }),
      ),
    );
    expect(idsOf(html)[0], "the Apollo island did not read its cache").toBe(
      pageOne.items[0]!.id.toString(),
    );
  });

  it("the seeded entry is NOT stale under the published window — the whole point of §4", async () => {
    // The record claimed this as "measured under SSR as isPending/isFetching
    // false" and nothing in the tree asserted it — a runtime claim about the
    // lead arm's HEADLINE behaviour existing only as a comment, which is the
    // shape this file has now caught fourteen times. Asserted here through the
    // mechanism that actually decides it.
    //
    // Staleness, not fetch counts, is the right seam: `renderToStaticMarkup`
    // runs no effects, so NO arm fires a request during it and an
    // `isFetching() === 0` assertion would pass whatever `staleTime` said. What
    // decides whether a real mount refetches in the background is whether the
    // cached entry is stale — and under TanStack's own default (`staleTime: 0`,
    // "consider cached data as stale") it is, which is the 1 request / 11.6 KB
    // the prototype measured and the reason ADR-0005 §4 publishes the config.
    const initial = await servedTray("fixture", condition());
    const cond = condition();
    const client = createSeededQueryClient(cond, initial);
    const entry = client.getQueryCache().find({ queryKey: plpQueryKey(cond) });
    expect(entry, "the seeded entry is not in the cache at all").toBeDefined();
    expect(entry!.state.status).toBe("success");
    // Under the PUBLISHED window: fresh, so a mount adds no request.
    expect(
      entry!.isStaleByTime(plpQueryOptions(cond).staleTime),
      "the seeded entry is stale under the published window — a revisit would refetch",
    ).toBe(false);
    // Under the LIBRARY DEFAULT: stale, and that contrast is the finding
    // ADR-0005 §4 exists to record. If this ever stops being true, the
    // published config has stopped buying anything and the cell copy is wrong.
    expect(
      entry!.isStaleByTime(0),
      "the library default no longer marks a fresh entry stale — §4's premise moved",
    ).toBe(true);
  });

  it("both arms' query options carry the published policy, and vary with the condition", () => {
    // `APOLLO_CACHE_WINDOW` and `PLP_STALE_TIME_MS` only DESCRIBE the policy; a
    // literal-vs-literal assertion on a description proves nothing about the
    // call. These are the objects the hooks actually receive.
    expect(plpQueryOptions(condition()).staleTime).toBe(PLP_STALE_TIME_MS);
    expect(plpQueryOptions(condition()).queryKey).not.toEqual(
      plpQueryOptions(condition({ page: 2 })).queryKey,
    );
    expect(plpQueryOptions(condition()).queryKey).not.toEqual(
      plpQueryOptions(condition({ n: 240 })).queryKey,
    );
    expect(plpQueryOptions(condition()).queryKey).not.toEqual(
      plpQueryOptions(condition({ cache: "default" })).queryKey,
    );
    expect(plpApolloQueryOptions(condition()).fetchPolicy).toBe(
      APOLLO_CACHE_WINDOW.policy,
    );
    expect(plpApolloQueryOptions(condition()).variables).not.toEqual(
      plpApolloQueryOptions(condition({ page: 2 })).variables,
    );
  });
});

/* ── 3. The fence ─────────────────────────────────────────────────────────── */

describe("the Apollo exhibit is fenced, and the two benchmarked routes are not", () => {
  it("apollo carries exactly one fenced subtree; plain and tanstack carry zero", async () => {
    const initial = await servedTray("fixture", condition());
    const cond = condition();
    const apollo = shellHtml(
      createElement(PlpApolloPlaque, null),
      createElement(PlpApollo, { initial, condition: cond }),
    );
    // The PLP master renders no plaque at all, so the PLP follows EDITORIAL's
    // rule (core pages carry zero fenced elements), not the PDP's (exactly one,
    // never dropped). Copying the PDP pattern here would fail every core page.
    expect(countFenced(apollo)).toBe(1);
    for (const island of [
      createElement(PlpPlain, { initial, condition: cond }),
      createElement(PlpTanstack, { initial, condition: cond }),
    ]) {
      expect(
        countFenced(shellHtml(island)),
      ).toBe(0);
    }
  });

  it("the fenced drop is load-bearing: without it the exhibit DIVERGES from the master", async () => {
    // The complement that keeps the extension honest (the remix3 precedent):
    // if the plaque ever stopped reaching the page, `dropFencedSubtrees` would
    // be excusing nothing and the leg above would be vacuously green.
    const { lib, plp } = await loadReference();
    const snapshot = lib.loadSnapshot("fixture");
    const master = normalizeHtml(plp.renderPlp(snapshot, { origin: "", n: PER_PAGE, cache: "cold" }), NO_NOISE);
    const initial = await servedTray("fixture", condition());
    const body = documentOf(
      shellHtml(
        createElement(PlpApolloPlaque, null),
        createElement(PlpApollo, { initial, condition: condition() }),
      ),
    );
    expect(normalizeHtml(body, REACT_NEXT_NOISE, true)).toBe(master);
    expect(normalizeHtml(body, REACT_NEXT_NOISE, false)).not.toBe(master);
  });

  it("the plaque carries the DS canonical rule line and the INSTALLED pins", () => {
    const html = renderToStaticMarkup(createElement(PlpApolloPlaque, null));
    // The canonical fenced form, byte-checked against the string the PDP
    // master renders — not remix3's version-carrying override, which belongs
    // to a pre-release exhibit and this is not one.
    expect(html).toContain(
      "measured with the same harness · excluded from every benchmark number",
    );
    expect(html).toContain('data-pm-fenced="true"');
    expect(html).toContain("pm-plaque--fenced");
    // Tool-derived, never typed (the remix3 precedent): the versions on the
    // plaque are the versions actually INSTALLED.
    //
    // The first draft of this leg read `variants/react-next/package.json` and
    // compared it against `APOLLO_EXHIBIT`, which is DERIVED from that same
    // file — it compared the file with itself and could not fail under any
    // change, while its own name said "the INSTALLED pins" and its comment
    // said "the versions the lockfile actually installs". Neither was backed.
    // Found by the verification pass; it now resolves each package's own
    // manifest, which is what the declared range actually resolved to.
    const require_ = createRequire(import.meta.url);
    const installed = (name: string): string =>
      (JSON.parse(readFileSync(require_.resolve(`${name}/package.json`), "utf8")) as {
        version: string;
      }).version;
    const apolloInstalled = installed("@apollo/client");
    const restInstalled = installed("apollo-link-rest");
    expect(APOLLO_EXHIBIT.apolloVersion).toBe(apolloInstalled);
    expect(APOLLO_EXHIBIT.restLinkVersion).toBe(restInstalled);
    expect(html).toContain(apolloInstalled);
    expect(html).toContain(restInstalled);
    // And the declared range is the EXACT pin ADR-0005 §7 requires, so a
    // caret could not silently float the exhibit onto a different library.
    const declared = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(declared.dependencies["@apollo/client"]).toBe(apolloInstalled);
    expect(declared.dependencies["apollo-link-rest"]).toBe(restInstalled);
    // The two caches' windows DIFFER, and the exhibit says so rather than
    // claiming parity it cannot deliver: Apollo 4 ships no staleTime
    // equivalent at all, so `cache-first` is unbounded. An earlier draft
    // exported a constant asserting equality and wired it to nothing.
    expect(APOLLO_CACHE_WINDOW.policy).toBe("cache-first");
    expect(APOLLO_CACHE_WINDOW.staleTimeMs).toBeNull();
    expect(APOLLO_CACHE_WINDOW.leadStaleTimeMs).toBe(PLP_STALE_TIME_MS);
  });

  it("Apollo really has no staleTime — the exhibit's honesty depends on it", () => {
    // The exhibit states that its cache window DIFFERS from the lead's because
    // Apollo ships no staleTime equivalent. That is a claim about a third-party
    // package, so it is pinned rather than asserted in prose: if a future
    // @apollo/client adds the knob, this fails and the record follows it
    // instead of going quietly stale (the remix3 beta-pin canary idiom).
    const pkgPath = createRequire(import.meta.url).resolve("@apollo/client/package.json");
    const root = dirname(pkgPath);
    // grep's documented exit codes: 0 = matched, 1 = no match, >=2 = error.
    // `execFileSync` throws on ANY non-zero, so the no-match case — which is
    // the case this test EXPECTS — arrives as an exception. Distinguishing 1
    // from >=2 is what keeps this a guard rather than a crash: a missing grep,
    // an unreadable directory or a bad path must fail loudly and separately,
    // not be silently read as "no staleTime here".
    const result = spawnSync(
      "grep",
      ["-rl", "--include=*.js", "--include=*.cjs", "--include=*.d.ts", "staleTime", root],
      { encoding: "utf8" },
    );
    expect(result.error, `grep did not run: ${result.error?.message}`).toBeUndefined();
    expect(
      result.status,
      `grep failed (status ${result.status}): ${result.stderr}`,
    ).toBeLessThan(2);
    const hits = (result.stdout ?? "").trim();
    expect(hits, `@apollo/client now mentions staleTime:\n${hits}`).toBe("");
    // Non-vacuity: the same sweep MUST find a token the package really ships,
    // or a typo'd path would report "no staleTime" about an empty directory.
    const control = spawnSync(
      "grep",
      ["-rl", "--include=*.js", "--include=*.cjs", "--include=*.d.ts", "fetchPolicy", root],
      { encoding: "utf8" },
    );
    expect(control.status, "the control sweep found nothing — the path is wrong").toBe(0);
    expect((control.stdout ?? "").trim().length).toBeGreaterThan(0);
    // Two recursive greps over an installed package tree: 155 ms here and the
    // slowest leg in the file, but I/O-bound, so a cold CI filesystem is the
    // case this budget exists for.
  }, 300_000);
});

/* ── 4. Stylesheets, which the DOM compare throws away with the head ──────── */

describe("the PLP documents link exactly the sheets they owe", () => {
  const sheets = (html: string): string[] =>
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)].map((m) => {
      const at = m[1]!.lastIndexOf("/css/");
      if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
      return m[1]!.slice(at + 1);
    });

  it("the benchmarked PLP document links exactly the master's sheets, in order", async () => {
    const { lib, plp } = await loadReference();
    const snapshot = lib.loadSnapshot("fixture");
    const master = sheets(plp.renderPlp(snapshot, { origin: "", n: PER_PAGE }));
    const variant = sheets(
      renderToStaticMarkup(createElement(Document, { css: PLP_CSS, children: null })),
    );
    expect(master.length, "the master links no stylesheets").toBeGreaterThan(5);
    // Order included: cascade order is a rendering property, not a freedom.
    expect(variant).toEqual(master);
  });

  it("each route GROUP's layout passes the list it owes — the constants alone proved nothing", async () => {
    // The leg above compares two exported CONSTANTS. Nothing connected either
    // one to a route, so pointing the BENCHMARKED group's layout at
    // `PLP_APOLLO_CSS` — shipping the plaque sheet on the two measured
    // strategies — passed every assertion in this file. Proven by sabotage,
    // then closed by importing the layouts and reading what they actually
    // pass. A layout is a plain function returning an element, so this needs
    // no renderer and no Next runtime.
    const plpLayout = (await import("../src/app/(plp)/layout")).default;
    const apolloLayout = (await import("../src/app/(plp-apollo)/layout")).default;

    const cssOf = (
      layout: (props: { children: ReactNode }) => ReactElement,
    ): readonly string[] =>
      (layout({ children: null }) as ReactElement<{ css: readonly string[] }>).props.css;

    expect(cssOf(plpLayout), "the benchmarked PLP group is not on PLP_CSS").toEqual(
      PLP_CSS,
    );
    expect(cssOf(apolloLayout), "the fenced group is not on PLP_APOLLO_CSS").toEqual(
      PLP_APOLLO_CSS,
    );
    // The consequence the swap would have had, asserted directly: the two
    // measured strategies must not carry the exhibit's sheet, because an
    // unused sheet is measured bytes on a published cell.
    expect(cssOf(plpLayout)).not.toContain("components/plaque.css");
    expect(cssOf(apolloLayout)).toContain("components/plaque.css");
  });

  it("the fenced exhibit adds the plaque sheet and nothing else", () => {
    const benchmarked = sheets(
      renderToStaticMarkup(createElement(Document, { css: PLP_CSS, children: null })),
    );
    const exhibit = sheets(
      renderToStaticMarkup(createElement(Document, { css: PLP_APOLLO_CSS, children: null })),
    );
    expect(exhibit).toEqual([...benchmarked, "css/components/plaque.css"]);
    // The plaque must not ride on the benchmarked routes: an unused sheet is
    // measured bytes on a published cell.
    expect(benchmarked).not.toContain("css/components/plaque.css");
  });
});

/* ── 4b. The cold arm's interaction path ──────────────────────────────────── */

describe("the cold arm answers the last CLICK, not the last response", () => {
  // The only arm whose request ordering is hand-written: TanStack and Apollo
  // both re-key on the condition and render whatever the current key holds, so
  // they get ordering from the library. Leaving cold without it would make the
  // baseline look worse for a reason that is not its data strategy — rigging
  // in the punishing direction, which ADR-0001 §9 forbids exactly as much as
  // the flattering kind. Driven directly because `renderToStaticMarkup` runs
  // no handlers and no effects: an inline version of this would be an
  // untested claim about the arm the `plp-paginate` cell will measure.
  const APPLIED_NONE = { genre: null, style: null, format: null, sort: null, q: null };
  const tray = (page: number): PlpPage => ({
    items: [],
    page,
    perPage: PER_PAGE,
    total: 240,
    totalPages: 10,
    facets: { genres: [], styles: [], formats: [] },
    applied: APPLIED_NONE,
  });

  it("a superseded response is dropped, and the newest click wins", async () => {
    const committed: number[] = [];
    const pushed: string[] = [];
    let latest = 0;
    const release: Record<number, () => void> = {};

    const start = (page: number) => {
      const ticket = ++latest;
      return paginate(
        condition({ page }),
        `?page=${page}`,
        () => ticket === latest,
        {
          fetchTray: () =>
            new Promise<Response>((resolve) => {
              release[page] = () => resolve(Response.json(tray(page)));
            }),
          commit: (_c, payload) => committed.push(payload.page),
          push: (href) => pushed.push(href),
          navigate: () => committed.push(-1),
        },
      );
    };

    const first = start(2);
    const second = start(3);
    // Page 3 answers FIRST, then the superseded page 2 answers — the exact
    // out-of-order sequence a slow network produces.
    release[3]!();
    await second;
    release[2]!();
    await first;

    expect(committed, "a superseded response was painted").toEqual([3]);
    expect(pushed, "a superseded response pushed a URL").toEqual(["?page=3"]);
  });

  it("a failed request falls back to the real navigation — unless it is superseded", async () => {
    const navigated: string[] = [];
    const io = {
      fetchTray: () => Promise.resolve(new Response("nope", { status: 503 })),
      commit: () => {
        throw new Error("must not commit on a failure");
      },
      push: () => {
        throw new Error("must not push on a failure");
      },
      navigate: (href: string) => navigated.push(href),
    };
    // Current: the anchor's own navigation is the floor (ADR-0005 §8).
    await paginate(condition({ page: 2 }), "?page=2", () => true, io);
    expect(navigated).toEqual(["?page=2"]);
    // Superseded: a stale failure must not yank the visitor off the page they
    // asked for last.
    await paginate(condition({ page: 2 }), "?page=2", () => false, io);
    expect(navigated).toEqual(["?page=2"]);
  });

  it("a pagination click is INTERCEPTED, and a modified click is not", () => {
    // Driven for real, without a DOM: `PlpArticle` is a plain function, so its
    // returned element tree can be walked and the anchor's own `onClick`
    // invoked with a stub event. That matters because `preventDefault` is the
    // difference between a client-side page change and a full document load —
    // delete it and every strategy silently becomes a hard navigation, which
    // is precisely what the interaction cells are supposed to distinguish.
    // A structural grep could not tell the two apart; this can.
    type Node = { props?: { children?: unknown; [k: string]: unknown } } | null;
    const anchors: Record<string, unknown>[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      const el = node as Node;
      if (el === null || typeof el !== "object" || !("props" in el) || !el.props) return;
      const props = el.props;
      if (
        typeof props["className"] === "string" &&
        props["className"].includes("pm-pagination__link") &&
        typeof props["onClick"] === "function"
      ) {
        anchors.push(props);
      }
      walk(props["children"]);
    };

    const payload: PlpPage = {
      items: [],
      page: 1,
      perPage: PER_PAGE,
      total: 240,
      totalPages: 10,
      facets: { genres: [{ value: "Jazz", count: 3 }], styles: [], formats: [] },
      applied: APPLIED_NONE,
    };
    const chosen: number[] = [];
    walk(PlpArticle({ payload, onNavigate: (c) => chosen.push(c.page) }));
    expect(anchors.length, "no intercepted pagination anchors were found").toBeGreaterThan(
      3,
    );

    const fire = (props: Record<string, unknown>, modifiers: Record<string, boolean> = {}) => {
      let prevented = false;
      (props["onClick"] as (e: unknown) => void)({
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        ...modifiers,
        preventDefault: () => {
          prevented = true;
        },
      });
      return prevented;
    };

    // A plain click: the default MUST be prevented, and the strategy told.
    expect(fire(anchors[0]!), "a plain click did not preventDefault").toBe(true);
    expect(chosen.length).toBe(1);

    // A modified click must stay a real navigation — open-in-new-tab has to
    // keep working, and a handler that swallowed it would break a browser
    // affordance no test elsewhere covers.
    chosen.length = 0;
    for (const mod of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
      expect(fire(anchors[0]!, { [mod]: true }), `${mod}-click was intercepted`).toBe(
        false,
      );
    }
    expect(chosen, "a modified click still called onNavigate").toEqual([]);

    // And with no strategy mounted (the server render, and JS-off) the anchors
    // carry no handler at all — the master's plain links.
    const bare: Record<string, unknown>[] = [];
    const walkBare = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walkBare);
      const el = node as Node;
      if (el === null || typeof el !== "object" || !("props" in el) || !el.props) return;
      if (
        typeof el.props["className"] === "string" &&
        el.props["className"].includes("pm-pagination__link") &&
        el.props["onClick"] !== undefined
      ) {
        bare.push(el.props);
      }
      walkBare(el.props["children"]);
    };
    walkBare(PlpArticle({ payload }));
    expect(bare, "the served page carries click handlers").toEqual([]);
  });

  it("a facet click hands the strategy the whole next CONDITION — filter set, page reset — and a form submit does too", () => {
    // The seam every control shares (plp.tsx `onNavigate`): a facet click is
    // a condition change, not a page change. Walked without a DOM like the
    // leg above; the forms' onSubmit handlers are invoked with a stub event
    // carrying a real FormData.
    type Node = { type?: unknown; props?: { children?: unknown; [k: string]: unknown } } | null;
    const found: { className: string; props: Record<string, unknown> }[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      const el = node as Node;
      if (el === null || typeof el !== "object" || !("props" in el) || !el.props) return;
      const cls = el.props["className"];
      if (typeof cls === "string" && (el.props["onClick"] || el.props["onSubmit"])) {
        found.push({ className: cls, props: el.props });
      }
      walk(el.props["children"]);
    };
    const payload: PlpPage = {
      items: [],
      page: 3,
      perPage: PER_PAGE,
      total: 240,
      totalPages: 10,
      facets: { genres: [{ value: "Jazz", count: 3 }, { value: "Rock", count: 2 }], styles: [], formats: [] },
      applied: { ...APPLIED_NONE, genre: "Jazz" },
    };
    const seen: PlpCondition[] = [];
    walk(PlpArticle({ payload, carry: { cache: "cold", run: "r1" }, onNavigate: (c) => seen.push(c) }));
    const facets = found.filter((f) => f.className === "pm-facets__facet");
    expect(facets).toHaveLength(2);
    const noMods = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: () => {} };
    // The SELECTED facet toggles off; the other adds itself. Both reset page,
    // both keep the carried knobs and the payload's other applied values.
    (facets[0]!.props["onClick"] as (e: unknown) => void)(noMods);
    (facets[1]!.props["onClick"] as (e: unknown) => void)(noMods);
    expect(seen[0]).toEqual(condition({ page: 1, genre: null, cache: "cold", run: "r1" }));
    expect(seen[1]).toEqual(condition({ page: 1, genre: "Rock", cache: "cold", run: "r1" }));
    // The search form: `q` normalized client-side, page reset, genre kept.
    const search = found.find((f) => f.className === "pm-toolbar__search")!;
    const form = (fields: Record<string, string>) =>
      ({
        currentTarget: { entries: () => Object.entries(fields) } as unknown as HTMLFormElement,
        preventDefault: () => {},
      });
    const realFormData = globalThis.FormData;
    // FormData over a fake form: hand the handler the same iterable shape.
    globalThis.FormData = class {
      private readonly f: Record<string, string>;
      constructor(el: { entries: () => [string, string][] }) {
        this.f = Object.fromEntries(el.entries());
      }
      get(k: string) {
        return this.f[k] ?? null;
      }
    } as unknown as typeof FormData;
    try {
      (search.props["onSubmit"] as (e: unknown) => void)(form({ q: "  Miles   Davis  " }));
      const sort = found.find((f) => f.className === "pm-toolbar__sort")!;
      (sort.props["onSubmit"] as (e: unknown) => void)(form({ sort: "" }));
      (sort.props["onSubmit"] as (e: unknown) => void)(form({ sort: "title" }));
    } finally {
      globalThis.FormData = realFormData;
    }
    expect(seen[2]).toEqual(condition({ page: 1, genre: "Jazz", q: "Miles Davis", cache: "cold", run: "r1" }));
    // An untouched select (`sort=`) is the default, never a value.
    expect(seen[3]).toEqual(condition({ page: 1, genre: "Jazz", sort: null, cache: "cold", run: "r1" }));
    expect(seen[4]).toEqual(condition({ page: 1, genre: "Jazz", sort: "title", cache: "cold", run: "r1" }));
  });

  it("all three arms wire the address-bar duties — checked structurally, since no DOM runs here", () => {
    // A STRUCTURAL guard, and its limits are stated rather than implied. The
    // two duties in usePlpNavigation.ts are effects: `renderToStaticMarkup`
    // runs no effects and this workspace has no DOM, so nothing here can prove
    // that Back actually restores or that a failure actually navigates. What
    // it CAN prove is that no arm silently loses the wiring — the failure that
    // actually happened, twice, in this unit's first draft (three pushState
    // writers and zero popstate listeners; an error floor on one arm of
    // three). The behavioural proof is owed to the origin suite's JS-on leg,
    // which is where this repo already puts JS-on control checks
    // (`repo-checks/pdp-controls-wired.test.ts` greps the enhancement for
    // exactly this reason; `origin-suite/pdp-controls.browser.test.ts` drives
    // it). Named as owed in the handoff, not quietly skipped.
    // Match the CALL, never the identifier. The first draft of this leg used
    // `src.includes("usePopstateCondition")`, which is satisfied by the IMPORT
    // line alone — deleting the call from two of the three arms left it green,
    // proven by sabotaging it. Import statements are stripped first and the
    // match requires a call site, so the guard can only be satisfied by the
    // thing it names. (This is the third vacuous guard this unit wrote and
    // caught; the shape is always the same — asserting that a name is present
    // rather than that a mechanism runs.)
    const withoutImports = (src: string) =>
      src.replace(/^import[\s\S]*?from\s+"[^"]+";$/gm, "");
    const read = (f: string) =>
      withoutImports(
        readFileSync(join(import.meta.dirname, "..", "src", "components", f), "utf8"),
      );
    for (const file of ["PlpPlain.tsx", "PlpTanstack.tsx", "PlpApollo.tsx"]) {
      const src = read(file);
      expect(src, `${file} never CALLS usePopstateCondition`).toMatch(
        /usePopstateCondition\(/,
      );
      // Every arm needs a floor when a client-side page change fails. The cold
      // arm's lives inside `paginate`'s catch; the two cache arms use the
      // shared hook.
      const hasFloor =
        /useNavigateOnError\(/.test(src) || /navigate: navigateOrReload/.test(src);
      expect(hasFloor, `${file} has no error floor`).toBe(true);
    }
    // Non-vacuity of the STRIP itself: an import line must actually be removed,
    // or `withoutImports` is a no-op and the two checks above are back to
    // matching import statements.
    const rawTanstack = readFileSync(
      join(import.meta.dirname, "..", "src", "components", "PlpTanstack.tsx"),
      "utf8",
    );
    expect(rawTanstack).toContain('from "./usePlpNavigation"');
    expect(withoutImports(rawTanstack)).not.toContain('from "./usePlpNavigation"');
    // Non-vacuity: the strings must exist in the module they come from, or
    // this leg is grepping for something nothing defines.
    const hooks = readFileSync(
      join(import.meta.dirname, "..", "src", "components", "usePlpNavigation.ts"),
      "utf8",
    );
    expect(hooks).toContain("export function usePopstateCondition");
    expect(hooks).toContain("export function useNavigateOnError");
    expect(hooks).toContain('window.addEventListener("popstate"');
    expect(hooks).toContain("window.removeEventListener");
    // The hook BODIES, not just their names: deleting the navigation out of
    // `useNavigateOnError` left every call site intact and the guard green
    // (found by sabotage). Same for the restore, which must re-derive the
    // condition from the URL rather than from anything it remembers.
    expect(hooks, "useNavigateOnError no longer navigates").toContain(
      "navigateOrReload(href, condition)",
    );
    // BOTH branches, because the one that only ever `assign`s is the bug:
    // `assign` always appends a history entry, so on the Back path — where the
    // browser is already at the target — it moves the visitor FORWARD out of
    // the position they just navigated to, and Back goes dead.
    expect(hooks, "navigateOrReload cannot reload").toContain("window.location.reload()");
    expect(hooks, "navigateOrReload cannot navigate").toContain(
      "window.location.assign(href)",
    );
    // Conditions, not strings: a URL spelled differently is still where we
    // already are, and a string compare turns the reload back into the assign
    // that appends an entry and moves the visitor forward.
    expect(hooks, "navigateOrReload compares strings, not conditions").toContain(
      "sameCondition(shown, condition)",
    );
    // And the mount latch, without which the seeded cache makes `settled` true
    // on the first render and every measured load rewrites its own URL.
    expect(hooks, "usePushWhenSettled has no mount latch").toContain(
      "if (!navigated.current) {",
    );
    expect(hooks, "usePushWhenSettled compares strings, not conditions").toContain(
      "if (sameCondition(shown, condition)) return;",
    );
    expect(hooks, "the popstate handler does not re-derive from the URL").toContain(
      "readPlpCondition(new URLSearchParams(window.location.search))",
    );
    // Each arm must WRITE the address bar when it changes the page, or the URL
    // stops being a receipt — and each must do it AFTER the content moves, not
    // on the click. The cold arm routes it through `paginate`'s injected
    // `push` (asserted behaviourally above); the two cache arms use
    // `usePushWhenSettled`, which is what gives them the cold arm's timing.
    expect(read("PlpPlain.tsx"), "the cold arm never writes the address bar").toMatch(
      /window\.history\.pushState\(null, "", /,
    );
    for (const file of ["PlpTanstack.tsx", "PlpApollo.tsx"]) {
      expect(read(file), `${file} does not push when the content settles`).toMatch(
        /usePushWhenSettled\(/,
      );
      // And it must be gated on the DISPLAYED page matching the requested one.
      // Pushing on the click is what made the URL and `aria-current` disagree
      // for the whole in-flight window; a call with `true` here would restore
      // that silently.
      // Settled = the PAYLOAD's applied query matches the requested condition
      // (ADR-0005 addendum Q2) — page alone would push a facet click's URL
      // while the previous grid was still on screen.
      expect(read(file), `${file} pushes without waiting for the content`).toMatch(
        /usePushWhenSettled\(current,[\s\S]{0,80}?appliedMatches\([a-z]+, current\)\)/,
      );
    }
    expect(hooks, "usePushWhenSettled does not write the address bar").toContain(
      'window.history.pushState(null, "", href)',
    );

    // The fenced plaque belongs to the exhibit ALONE: rendering it on a
    // benchmarked route would put a `[data-pm-fenced]` element on a measured
    // page, which is the one thing editorial's rule forbids — and the fence
    // legs render the ISLANDS, so they cannot see a plaque added to a PAGE.
    const pageSrc = (group: string, leaf: string) =>
      readFileSync(
        join(import.meta.dirname, "..", "src", "app", group, "plp", leaf, "page.tsx"),
        "utf8",
      );
    expect(pageSrc("(plp)", "plain")).not.toContain("PlpApolloPlaque");
    expect(pageSrc("(plp)", "tanstack")).not.toContain("PlpApolloPlaque");
    expect(pageSrc("(plp-apollo)", "apollo")).toContain("<PlpApolloPlaque />");
  });

  it("every pushed URL round-trips back to the condition that produced it", () => {
    // URL-as-receipt is only true if the URL parses back to what was served.
    const cases: PlpCondition[] = [
      condition({ cache: "default" }),
      condition(),
      condition({ n: 240, page: 4 }),
      condition({ n: 240, cache: "default", genre: "Folk, World, & Country" }),
      condition({
        page: 3,
        genre: "Jazz",
        style: "Dark Jazz",
        format: '12"',
        sort: "year-desc",
        q: "a b&c",
        profile: "slow-4g-mid-phone",
        run: "bench-1",
      }),
    ];
    for (const c of cases) {
      const url = plpHistoryUrl(c, PER_PAGE);
      expect(readPlpCondition(new URLSearchParams(url.slice(1))), url).toEqual(c);
    }
  });
});

/* ── 5. The measurement condition ─────────────────────────────────────────── */

describe("the served condition is the URL's condition", () => {
  it("clampPlpN agrees with the canonical clampN on every shape", () => {
    // The duplication in src/lib/plp.tsx is deliberate (@pm/measurement
    // publishes TS source that Next does not transpile) and is not left to
    // trust: a variant that clamped differently would SERVE one condition and
    // let the chrome PUBLISH another, because the beacon's `environment` tag is
    // derived from the URL and never from what was served.
    const cases = [
      null, undefined, "", "24", "240", "0240", "1", "0", "-5", "23.9",
      "241", "99999", "abc", "24abc", " 24 ", "1e3", "Infinity", "NaN",
    ];
    for (const raw of cases) {
      expect(clampPlpN(raw), `clampPlpN(${JSON.stringify(raw)})`).toBe(clampN(raw));
    }
    expect(PER_PAGE).toBe(PLP_N.default);
  });

  it("reads the five data-plane params off the URL AND sends them to the data plane — profile stays behind", () => {
    // Until 2026-09-04 this leg pinned the opposite: the params were parsed
    // but NOT forwarded, because the Worker honoured none of them and a
    // request that looked filtered while the payload was not put identical
    // trays under distinct TanStack keys. The Worker filters on all five now.
    const c = readPlpCondition(
      new URLSearchParams(
        "n=240&page=3&cache=cold&genre=Jazz&style=Modal&sort=year-desc&q=miles&profile=slow-4g-mid-phone&junk=x",
      ),
    );
    expect(c).toEqual({
      n: 240,
      page: 3,
      cache: "cold",
      run: "",
      profile: "slow-4g-mid-phone",
      genre: "Jazz",
      style: "Modal",
      format: null,
      sort: "year-desc",
      q: "miles",
    });
    expect(plpApiPath(c)).toBe(
      "/api/plp?n=240&page=3&genre=Jazz&style=Modal&sort=year-desc&q=miles&cache=cold",
    );
    // `profile` is the chrome's knob: in the condition, in every href and
    // push, in sameCondition — and NEVER in the data-plane path or the
    // client-cache key, or two visits differing only by profile would hold
    // two copies of one identical tray and a revisit would measure a miss.
    expect(plpApiPath(c)).not.toContain("profile");
    expect(plpHistoryUrl(c, PER_PAGE)).toContain("profile=slow-4g-mid-phone");
    expect(plpHistoryUrl(c, PER_PAGE)).toContain("genre=Jazz");
    expect(PLP_FACET_PARAMS).toEqual(["genre", "style", "format"]);
    expect(PLP_SORTS).toEqual(["year-desc", "year-asc", "price-asc", "price-desc", "title"]);
    // Empty values are ABSENT — what an untouched GET form submits.
    const empty = readPlpCondition(new URLSearchParams("sort=&q=&genre=&style=&format="));
    expect(empty).toEqual(condition({ cache: "default" }));
  });

  it("the data plane honours the five: the real Worker returns a FILTERED tray for the forwarded request", async () => {
    // The `plp-params-not-yet-honoured` tripwire lived here until 2026-09-04
    // — it read the Worker's source and failed the day a param was wired
    // through without the UI coming back. Both halves landed together; this
    // is its honest inverse, proven by request rather than by grep.
    const all = await servedTray("fixture", condition({ n: 240 }));
    const { genre } = restoredConditions((await loadReference()).lib.loadSnapshot("fixture").summaries)[0]!.over;
    const filtered = await servedTray("fixture", condition({ n: 240, genre }));
    expect(filtered.total).toBeLessThan(all.total);
    expect(filtered.total).toBeGreaterThan(0);
    for (const item of filtered.items) expect(item.genres).toContain(genre);
    expect(filtered.applied.genre).toBe(genre);
    const sorted = await servedTray("fixture", condition({ n: 240, sort: "year-asc" }));
    expect(sorted.items.map((s) => s.id)).not.toEqual(all.items.map((s) => s.id));
    expect(sorted.applied.sort).toBe("year-asc");
    // And junk is a 400 from the plane, which loadPlp turns into the route's 404.
    const res = await (edgeWorker as { fetch: (r: Request, e: unknown) => Promise<Response> }).fetch(
      new Request(`https://pm-edge${plpApiPath(condition({ genre: "Junk" }))}`),
      stubEnv(SNAPSHOT_DIRS.fixture),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("x-pm-cache-state")).toBe("none");
  });

  it("normalizePlpQ and plpHistoryUrl are the reference's own rules, re-typed — pinned equal over a table", async () => {
    // Two re-typings a paradigm may not import (ADR-0004 §2). Without this
    // leg a raw "  miles   davis " in the island's condition would never
    // equal the tray's applied "miles davis" and `settled` would stay false
    // for the life of the page — the grid moving, the address bar not.
    const { normalizeQ } = await loadReferenceQuery();
    for (const raw of [null, undefined, "", "   ", "miles", "  Miles   Davis  ", "a".repeat(70), " x ".repeat(30), "tab\tsep", "nbsp\u00a0here"]) {
      expect(normalizePlpQ(raw), JSON.stringify(raw)).toBe(normalizeQ(raw));
    }
    // And the ROUTE applies it: conditionFromSearchParams must hand the island
    // the normalized form, not the raw query. Pinning the function was not
    // pinning its use \u2014 the 2026-09-18 sabotage table swapped the call for a
    // bare `=== "" ? null : raw` and this leg stayed green.
    for (const raw of ["  Miles   Davis  ", "a".repeat(70), "   ", "tab\tsep", "nbsp\u00a0here"]) {
      expect(conditionFromSearchParams({ q: raw }).q, JSON.stringify(raw)).toBe(normalizeQ(raw));
    }
    const { conditionHref } = await loadReferenceHref();
    const cases: PlpCondition[] = [
      condition({ cache: "default" }),
      condition(),
      condition({ page: 2 }),
      condition({ n: 240, page: 4, cache: "default" }),
      condition({ genre: "Folk, World, & Country", style: '12"', q: "a b&c", cache: "default" }),
      condition({ page: 3, genre: "Jazz", sort: "title", run: "bench-1", profile: "slow-4g-mid-phone" }),
      condition({ run: "<script>", profile: "x".repeat(70), cache: "default" }),
    ];
    for (const c of cases) {
      // The reference takes the same flat shape (undefined/"" and null both mean absent).
      expect(plpHistoryUrl(c, PER_PAGE), JSON.stringify(c)).toBe(conditionHref(c));
    }
  });

  it("appliedMatches is what settles a cache arm: the tray's applied query against the requested condition", async () => {
    const { genre } = restoredConditions((await loadReference()).lib.loadSnapshot("fixture").summaries)[0]!.over;
    const cond = condition({ genre, q: "quiet" });
    const tray = await servedTray("fixture", cond);
    expect(appliedMatches(tray, cond)).toBe(true);
    // The previous page's tray under keepPreviousData: NOT settled, even though page matches.
    const previous = await servedTray("fixture", condition({ q: "quiet" }));
    expect(previous.page).toBe(cond.page);
    expect(appliedMatches(previous, cond)).toBe(false);
    // n is compared through perPage.
    expect(appliedMatches(tray, { ...cond, n: 240 })).toBe(false);
  });

  it("defaults collapse to the bare edge-cached condition", () => {
    const c = readPlpCondition(new URLSearchParams(""));
    expect(c).toEqual({
      n: PER_PAGE,
      page: 1,
      cache: "default",
      run: "",
      profile: "",
      genre: null,
      style: null,
      format: null,
      sort: null,
      q: null,
    });
    expect(plpApiPath(c)).toBe("/api/plp?n=24&page=1");
    // The "Edge cache — KV" preset IS the bare URL (no query); the bare
    // condition's own spelling is `?page=1` — the ONE href rule's rule that
    // no link is ever a bare `?`.
    expect(plpHistoryUrl(c, PER_PAGE)).toBe("?page=1");
  });

  it("a client-side page change keeps the whole condition in the address bar", () => {
    // URL-as-receipt (ADR-0004 §5). The reference's own pagination hrefs drop
    // `?cache=`, which is reported as a contract defect; a client-side change
    // must not repeat it, because the strategy islands are the code the
    // revisit cells will be measured through.
    const c = condition({ n: 240, page: 4, cache: "cold" });
    expect(plpHistoryUrl(c, PER_PAGE)).toBe("?page=4&n=240&cache=cold");
    expect(clampPlpPage("0")).toBe(1);
    expect(clampPlpPage("abc")).toBe(1);
    expect(clampPlpPage("7")).toBe(7);
  });

  it("clampPlpPage is the reference's own clampPage, re-typed — pinned equal over a table, the overflow included", async () => {
    // The fourth rule a paradigm cannot import (with the n clamp, the q
    // normalizer and the href rule). `parseInt` of 309+ digits is Infinity:
    // the first draft let it through, so the island held page Infinity while
    // the Worker read `page=Infinity` as page 1 and `settled` could never be
    // true (verify-slice, 2026-09-18). Both sides now cap at MAX_SAFE_INTEGER.
    const { clampPage } = (await loadReferenceQuery()) as unknown as {
      clampPage: (raw: string | null | undefined) => number;
    };
    for (const raw of [null, undefined, "", "0", "-3", "abc", "7", "1e15", "24.9", "99999999999999999999", "9".repeat(400)]) {
      expect(clampPlpPage(raw), JSON.stringify(raw)).toBe(clampPage(raw));
      expect(Number.isSafeInteger(clampPlpPage(raw)), JSON.stringify(raw)).toBe(true);
    }
    expect(clampPlpPage("9".repeat(400))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("Next's own searchParams shape reaches the condition — arrays, undefined and all", () => {
    // Next hands a route an already-parsed object, not a query string, and all
    // three PLP routes go through this one function. Without it the conversion
    // was three copies of an inline expression that nothing could test.
    expect(
      conditionFromSearchParams({ n: "240", cache: "cold", page: "3", genre: "Jazz" }),
    ).toEqual(condition({ n: 240, page: 3, genre: "Jazz" }));
    // A repeated param takes the FIRST value, matching URLSearchParams.get, so
    // `?n=24&n=240` resolves the same way in the route and in the beacon tag.
    expect(conditionFromSearchParams({ n: ["24", "240"] }).n).toBe(24);
    // Absent and empty are the default condition, not a crash.
    expect(conditionFromSearchParams({})).toEqual(condition({ cache: "default" }));
    expect(conditionFromSearchParams({ n: undefined, genre: undefined }).n).toBe(PER_PAGE);
  });

  it("all three ROUTES read their query — a page that ignored ?n= would publish a false beacon tag", () => {
    // The sixth instance of this unit's vacuity shape, closed before it could
    // be found: every leg above tests the CONDITION machinery, and none of them
    // connected it to a route. A page that never read `searchParams` would
    // serve n=24 while the chrome tagged the visit `n=240|cache=cold` — the tag
    // is derived from the URL and never from what was served
    // (`packages/measurement/src/beacon.ts:47-58`), so the receipt would be
    // false with nothing red.
    //
    // Structural, with the call-not-name lesson applied: imports are stripped
    // and the match requires a call site.
    const withoutImports = (src: string) =>
      src.replace(/^import[\s\S]*?from\s+"[^"]+";$/gm, "");
    const pages = [
      ["(plp)", "plp", "plain"],
      ["(plp)", "plp", "tanstack"],
      ["(plp-apollo)", "plp", "apollo"],
    ] as const;
    for (const [group, ...rest] of pages) {
      const file = join(import.meta.dirname, "..", "src", "app", group, ...rest, "page.tsx");
      const src = withoutImports(readFileSync(file, "utf8"));
      expect(src, `${group}/${rest.join("/")} never reads its query`).toMatch(
        /conditionFromSearchParams\(await searchParams\)/,
      );
      expect(src, `${group}/${rest.join("/")} never fetches for that condition`).toMatch(
        /loadPlp\(condition\)/,
      );
      // And it must stay request-time, or `?cache=` means nothing: a cached
      // render would serve one warmth under both presets.
      expect(src, `${group}/${rest.join("/")} is not force-dynamic`).toContain(
        'export const dynamic = "force-dynamic"',
      );
    }
  });

  it("the harness nonce `?run=` survives into BOTH the tray URL and the address bar", async () => {
    // The bench runner sets `run` on every measured URL
    // (`tools/bench-runner/src/batch.ts:79`) and the edge Worker folds a
    // well-formed value into the KV key (`workers/edge/src/index.js:51-53,127`).
    // This build dropped it: `run` was not a field of `PlpCondition`, so the
    // SSR tray fetch hit the SHARED, infinite-TTL, visitor-facing warm entry
    // and a batch could not mint isolated cache state at all — on the one
    // surface whose entire subject is measurement. The round-trip leg above
    // could not see it, because a round-trip over a type that lacks the field
    // is closed under its loss. That is this repo's vacuity shape in a new
    // place, and this is the leg that closes it.
    const c = conditionFromSearchParams({ n: "240", cache: "cold", run: "bench-xyz.1" });
    expect(c.run).toBe("bench-xyz.1");
    expect(plpApiPath(c)).toContain("run=bench-xyz.1");
    expect(plpHistoryUrl(c, PER_PAGE)).toContain("run=bench-xyz.1");
    expect(readPlpCondition(new URLSearchParams(plpHistoryUrl(c, PER_PAGE).slice(1)))).toEqual(c);

    // Malformed values are IGNORED, exactly as the Worker ignores them — the
    // page and the plane must agree about which key was served, or the tag and
    // the tray disagree with nothing red.
    for (const bad of ["", "has space", "a".repeat(65), "semi;colon", "sl/ash"]) {
      expect(conditionFromSearchParams({ run: bad }).run, `"${bad}" should be ignored`).toBe(
        "",
      );
      expect(plpApiPath(conditionFromSearchParams({ run: bad }))).not.toContain("run=");
    }
    for (const good of ["a", "bench-xyz.1", "A_9", "a".repeat(64)]) {
      expect(conditionFromSearchParams({ run: good }).run, `"${good}" should survive`).toBe(
        good,
      );
    }

    // The rule is the WORKER's, not a second opinion: same regex, read from
    // its source this session.
    const workerSrc = readFileSync(
      join(repoRoot, "workers", "edge", "src", "index.js"),
      "utf8",
    );
    expect(workerSrc).toContain(PLP_RUN_RE.source);

    // And it really reaches the plane: drive the Worker and confirm the nonced
    // request does NOT read the un-nonced warm entry.
    const primed = new Map<string, string>();
    const files: Record<string, string> = {
      "snapshot/summaries.json": readFileSync(
        join(repoRoot, "tools", "snapshot-fixture", "snapshot", "summaries.json"),
        "utf8",
      ),
    };
    const env = {
      SNAPSHOT: {
        get: (k: string) =>
          Promise.resolve(
            files[k] === undefined
              ? null
              : { json: () => Promise.resolve(JSON.parse(files[k]!) as unknown) },
          ),
      },
      WARM: {
        get: (k: string) => Promise.resolve(primed.get(k) ?? null),
        put: (k: string, v: string) => {
          primed.set(k, v);
          return Promise.resolve();
        },
      },
    };
    const worker = edgeWorker as { fetch: (r: Request, e: unknown) => Promise<Response> };
    // Prime the un-nonced key (a "visitor").
    await worker.fetch(new Request("https://pm-edge/api/plp?n=24&page=1"), env);
    const keys = [...primed.keys()];
    expect(keys).toEqual(["v2:/api/plp?n=24&page=1"]);
    // A nonced request must MISS that entry and mint its own.
    const nonced = conditionFromSearchParams({ run: "bench-xyz.1" });
    const res = await worker.fetch(
      new Request(`https://pm-edge${plpApiPath(nonced)}`),
      env,
    );
    expect(res.headers.get("x-pm-cache-state"), "the nonced request reused the shared entry").toBe(
      "miss",
    );
    expect([...primed.keys()].sort()).toEqual([
      "v2:/api/plp?n=24&page=1",
      "v2:/api/plp?n=24&page=1&run=bench-xyz.1",
    ]);
  });

  it("sameCondition is order-independent and default-insensitive — string equality is not", () => {
    // The comparator the history hooks use. A URL is not a canonical spelling
    // of its condition: the SERVED `?n=24&run=abc&cache=cold` and this
    // module's `?cache=cold&run=abc` are the same state written two ways.
    // String-comparing them says "different", which is what made the first
    // draft of `usePushWhenSettled` rewrite its own URL on every measured
    // load — a spurious history entry, and a second architectural difference
    // between the cache arms and the cold baseline.
    const served = conditionFromSearchParams({ n: "24", run: "abc", cache: "cold" });
    const derived = readPlpCondition(new URLSearchParams(plpHistoryUrl(served, PER_PAGE).slice(1)));
    expect(sameCondition(served, derived)).toBe(true);
    // ...and the two spellings really are different strings, or this leg is
    // testing nothing.
    expect(plpHistoryUrl(served, PER_PAGE)).not.toBe("?n=24&run=abc&cache=cold");

    // Every field must matter, or the comparator would suppress a real change.
    const base = condition();
    for (const other of [
      condition({ n: 240 }),
      condition({ page: 2 }),
      condition({ cache: "default" }),
      condition({ run: "x" }),
      condition({ profile: "slow-4g-mid-phone" }),
      condition({ genre: "Jazz" }),
      condition({ style: "Modal" }),
      condition({ format: '12"' }),
      condition({ sort: "title" }),
      condition({ q: "miles" }),
    ]) {
      expect(sameCondition(base, other), JSON.stringify(other)).toBe(false);
    }
    // Named fields, so two spellings of one filter set are ONE condition —
    // and one KV key, since plpApiPath spells them in a fixed order.
    expect(
      plpApiPath(readPlpCondition(new URLSearchParams("style=Modal&genre=Jazz"))),
    ).toBe(plpApiPath(readPlpCondition(new URLSearchParams("genre=Jazz&style=Modal"))));
  });

  it("the published client-cache window is ADR-0005 §4's five minutes", () => {
    expect(PLP_STALE_TIME_MS).toBe(5 * 60 * 1000);
  });
});
