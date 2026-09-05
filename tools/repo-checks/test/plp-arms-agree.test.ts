/**
 * The two PLP arms must serve the SAME DOM for the same URL — including the
 * pages the reference master could not render when they were written, and
 * since 2026-09-04 every FILTERED, SORTED and SEARCHED condition too.
 *
 * WHY THIS FILE EXISTS. `renderPlp` took no `page` argument: it rendered
 * page 1 and hardcoded "1" as current, while emitting links to `?page=2..5`
 * on every visit. So the contract described one page and shipped invitations
 * to pages it could not describe, and each arm generalized the rest alone —
 * and they generalized it differently:
 *
 *   react-next   empty page reads "0–0"   `rel="next"` emitted unconditionally
 *   htmx         empty page reads "0"     `rel="next"` gated on a real page
 *
 * Two arms serving structurally different DOM for one URL is exactly what a
 * canonical markup contract exists to prevent, and both suites PINNED their
 * own answer, so neither would ever drift into agreement. Nothing could see
 * it: the browser drift gate opens a committed STATIC master file, which
 * cannot express `?page=2` at any condition, and both identity suites loop
 * over `n` with no `page` axis at all.
 *
 * The reference is condition-aware now (`renderPlp(snapshot, { page, genre,
 * style, format, sort, q, cache, run, profile })`), so all three agree by
 * construction. This guard is what makes that a checked fact rather than a
 * hope — it is the ONLY place both implementations are rendered in the same
 * process, which is why it lives here rather than in either variant's own
 * workspace. Since the data plane landed, each arm is ALSO held to the
 * reference's own block for the same payload, so a divergence names the
 * arm that moved rather than reporting two arms as merely "different".
 *
 * The `totalPages + 1` case is the one that matters: it is the degenerate
 * state each arm had to invent an answer for, it is reachable in one click
 * from the last real page's own Next link, and it is where they disagreed.
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PAGE_NORMALIZE, PERMITTED_NOISE, type NoiseSpec } from "@pm/drift-gate";
import type { PlpPage } from "@pm/data-contract";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface Summary {
  id: number;
  title: string;
  genres: string[];
  styles: string[];
  format: string;
  [key: string]: unknown;
}

interface PlpQuery {
  n: number;
  page: number;
  genre?: string | null;
  style?: string | null;
  format?: string | null;
  sort?: string | null;
  q?: string | null;
}

interface Carry {
  cache?: "cold" | "default";
  run?: string;
  profile?: string;
}

/** A real browser's HTML tokenizer lowercases attribute names during parsing
 *  (the spec's tokenization algorithm); linkedom's parser does not. React
 *  emits `fetchPriority` as JSX requires and a real browser sees
 *  `fetchpriority` — so without this, the two arms "disagree" on every card
 *  image over a linkedom parsing gap that no visitor could ever observe.
 *  Corrected once, pre-normalize, exactly as the sibling identity guard
 *  does — never by mangling correct JSX. */
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

/** Same normalizer policy as the sibling identity guards: PAGE_NORMALIZE is
 *  written to run inside a driven browser, so linkedom's document/Node are
 *  installed as globals for the one synchronous call and then restored. */
function normalizeHtml(html: string, noise: NoiseSpec): string {
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
    });
  } finally {
    g.document = prevDocument;
    g.Node = prevNode;
  }
}

/** Both arms normalized under BOTH registrations, so neither paradigm's own
 *  mechanism attributes count as a difference: htmx's `hx-*` swap contract
 *  and react-next's streaming residue are each admitted by their own entry.
 *  Everything else is compared. */
const BOTH_NOISE: NoiseSpec = {
  attrPatterns: [
    ...PERMITTED_NOISE["htmx"]!.attrPatterns,
    ...PERMITTED_NOISE["react-next"]!.attrPatterns,
  ],
  classPatterns: [
    ...PERMITTED_NOISE["htmx"]!.classPatterns,
    ...PERMITTED_NOISE["react-next"]!.classPatterns,
  ],
  behaviorAttrPatterns: [
    ...PERMITTED_NOISE["htmx"]!.behaviorAttrPatterns,
    ...PERMITTED_NOISE["react-next"]!.behaviorAttrPatterns,
  ],
  dropElementSelectors: [
    ...(PERMITTED_NOISE["htmx"]!.dropElementSelectors ?? []),
    ...(PERMITTED_NOISE["react-next"]!.dropElementSelectors ?? []),
  ],
};

/** First differing line, so a failure names the divergence instead of
 *  printing two multi-kilobyte blobs at each other. */
function firstDivergence(a: string, b: string, aName: string, bName: string): string {
  const as = a.split("\n");
  const bs = b.split("\n");
  for (let i = 0; i < Math.max(as.length, bs.length); i += 1) {
    if (as[i] !== bs[i]) {
      return [
        `first divergence at normalized line ${i + 1}:`,
        `--- ${aName.padEnd(11)} ${as[i] ?? "(end of document)"}`,
        `+++ ${bName.padEnd(11)} ${bs[i] ?? "(end of document)"}`,
      ].join("\n");
    }
  }
  return "(identical)";
}

describe("the two PLP arms agree on every page, including the ones past the end", () => {
  const load = async () => {
    const lib = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
    );
    const plp = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "plp.mjs")).href
    );
    // The spec's OWN query module — the function the edge Worker serves from
    // — so the payload under test is the served tray by construction, not a
    // third re-typing of the slice arithmetic (this file carried one until
    // 2026-09-04, and it would have needed filtering/sorting copied too).
    const query = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "plp-query.mjs")).href
    );
    const htmx = await import(
      pathToFileURL(join(repoRoot, "variants", "htmx", "src", "render.mjs")).href
    );
    const reactNext = await import(
      pathToFileURL(join(repoRoot, "variants", "react-next", "src", "lib", "plp.tsx")).href
    );
    return { lib, plp, query, htmx, reactNext };
  };

  const plpPayload = (
    query: { applyPlpQuery: (s: Summary[], q: Record<string, unknown>) => PlpPage },
    summaries: Summary[],
    q: PlpQuery,
  ): PlpPage =>
    query.applyPlpQuery(summaries, {
      genre: null,
      style: null,
      format: null,
      sort: null,
      q: null,
      ...q,
    });

  /** Each arm reduced to the one thing they both own: the `div.pm-plp`
   *  subtree. htmx's `renderPlpFragment` IS that subtree (it is the hx-swap
   *  target); react-next's `PlpArticle` is its component for the same; the
   *  reference's `renderPlpBlock` is the CONTRACT for it. The shells around
   *  them are each paradigm's own and are compared against the MASTER by the
   *  two identity suites, not against each other. All three get the identical
   *  wrapper so the normalizer sees the same document shape. */
  const wrap = (subtree: string) =>
    `<!doctype html><html lang="en"><head></head><body>${subtree}</body></html>`;

  const render = {
    reference: (
      mod: { renderPlpBlock: (d: unknown, c: Carry) => string },
      payload: PlpPage,
      carry: Carry,
    ) => wrap(mod.renderPlpBlock(payload, carry)),
    htmx: (
      mod: { renderPlpFragment: (d: unknown, c: Carry) => string },
      payload: PlpPage,
      carry: Carry,
    ) => wrap(mod.renderPlpFragment(payload, carry)),
    reactNext: (mod: { PlpArticle: unknown }, payload: PlpPage, carry: Carry) =>
      wrap(
        renderToStaticMarkup(
          createElement(mod.PlpArticle as never, { payload, carry } as never),
        ),
      ),
  };

  /** Render all three for one payload and assert pairwise equality, naming
   *  the arm that moved. */
  async function expectAllThreeAgree(label: string, payload: PlpPage, carry: Carry = {}) {
    const { plp, htmx, reactNext } = await load();
    const ref = normalizeHtml(render.reference(plp as never, payload, carry), BOTH_NOISE);
    const h = normalizeHtml(render.htmx(htmx as never, payload, carry), BOTH_NOISE);
    const r = normalizeHtml(render.reactNext(reactNext as never, payload, carry), BOTH_NOISE);
    expect(ref, `${label}: the reference rendered nothing`).toContain("pm-plp");
    expect(h, `${label}: htmx rendered nothing`).toContain("pm-plp");
    expect(r, `${label}: react-next rendered nothing`).toContain("pm-plp");
    if (h !== ref) console.error(`${label}\n${firstDivergence(ref, h, "reference", "htmx")}`);
    expect(h, `htmx diverges from the reference at ${label} — see above`).toBe(ref);
    if (r !== ref) console.error(`${label}\n${firstDivergence(ref, r, "reference", "react-next")}`);
    expect(r, `react-next diverges from the reference at ${label} — see above`).toBe(ref);
  }

  for (const name of ["fixture", "crate"] as const) {
    for (const n of [24, 240]) {
      it(`${name} at n=${n}: identical DOM on page 1, the last page, and one past the end`, async () => {
        const { lib, query } = await load();
        const snapshot = lib.loadSnapshot(name);
        const summaries = snapshot.summaries as Summary[];
        const totalPages = Math.ceil(summaries.length / n);

        // The three that matter: the pinned one, the boundary, and the
        // degenerate state neither arm's contract could describe.
        const pages = [...new Set([1, totalPages, totalPages + 1])];
        expect(pages.length, `n=${n} on ${name} collapses every page case`).toBeGreaterThan(1);

        for (const page of pages) {
          await expectAllThreeAgree(
            `${name} n=${n} page=${page}`,
            plpPayload(query as never, summaries, { n, page }),
          );
        }
      });
    }

    it(`${name}: identical DOM under every RESTORED control — a facet, a rare style, a search, a sort, a deep page with every knob`, async () => {
      // The conditions the committed master cannot express, one per control
      // that came back on 2026-09-04. Values are found in the snapshot rather
      // than typed, so both snapshots exercise real ones.
      const { lib, query, plp } = await load();
      const snapshot = lib.loadSnapshot(name);
      const summaries = snapshot.summaries as Summary[];
      const genre = summaries[0]!.genres[0]!;
      const styleCounts = new Map<string, number>();
      for (const s of summaries) for (const v of s.styles) styleCounts.set(v, (styleCounts.get(v) ?? 0) + 1);
      const ranked = [...styleCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      // A style OUTSIDE the top-12 cut: the "selected facet is always listed"
      // rule has three renderers to agree on where it lands.
      const rareStyle = ranked[ranked.length - 1]![0];
      expect(ranked.length, `${name} has no style outside the cut`).toBeGreaterThan(12);
      const word = summaries[3]!.title.split(" ").find((w) => /^[A-Za-z]{3,}$/.test(w))!;
      // A style no release of `genre` carries: the EMPTY intersection, where
      // Q1's one exception (the selected value is always listed, at 0) is the
      // only thing that keeps a toggle-off link on the rail.
      const emptyStyle = ranked
        .map(([v]) => v)
        .find((v) => !summaries.some((s) => s.genres.includes(genre) && s.styles.includes(v)))!;
      expect(emptyStyle, `${name}: every style co-occurs with ${genre}`).toBeDefined();
      const cases: [string, PlpQuery, Carry][] = [
        ["genre", { n: 24, page: 1, genre }, {}],
        ["rare style", { n: 24, page: 1, style: rareStyle }, {}],
        ["search", { n: 24, page: 1, q: word }, {}],
        ["sort", { n: 240, page: 1, sort: "price-desc" }, {}],
        ["genre + sort, page 2, every knob", { n: 24, page: 2, genre, sort: "title" }, { cache: "cold", run: "bench-abc", profile: "slow-4g-mid-phone" }],
        ["empty result", { n: 24, page: 1, q: "zzzz-no-such-record-zzzz" }, {}],
        ["empty intersection", { n: 24, page: 1, genre, style: emptyStyle }, {}],
        // A junk carry: every renderer must DROP it from the forms' hidden
        // inputs (the reference's CARRY_RE; react-next re-emitted it
        // unbounded until 2026-09-18 — the one place the three disagreed).
        ["junk carry dropped", { n: 24, page: 1, genre }, { run: "has space", profile: "x".repeat(70) }],
      ];
      for (const [label, q, carry] of cases) {
        const payload = plpPayload(query as never, summaries, q);
        // Non-vacuity per case: the control's state is really in the payload.
        if (q.genre) expect(payload.applied.genre).toBe(genre);
        if (q.style) expect(payload.applied.style).toBe(q.style);
        if (label.startsWith("empty")) expect(payload.total).toBe(0);
        else expect(payload.items.length, `${name}/${label} served nothing`).toBeGreaterThan(0);
        await expectAllThreeAgree(`${name}/${label}`, payload, carry);
        if (label === "junk carry dropped") {
          const html = (plp as { renderPlpBlock: (d: unknown, c: Carry) => string }).renderPlpBlock(payload, carry);
          expect(html).not.toContain('name="run"');
          expect(html).not.toContain('name="profile"');
        }
        if (label === "empty intersection") {
          // Agreement proved above; this is what the agreed markup must SAY:
          // both selected values marked, both at 0, each href dropping its
          // own param (verify-slice, 2026-09-18 — before the exception every
          // renderer drew a rail with no marked facet and no way out).
          const { document } = parseHTML(
            (plp as { renderPlpBlock: (d: unknown, c: Carry) => string }).renderPlpBlock(payload, carry),
          );
          const current = [...document.querySelectorAll('.pm-facets__facet[aria-current="true"]')];
          expect(current.map((a) => a.querySelector(".pm-facets__value")!.textContent)).toEqual([genre, emptyStyle]);
          expect(current.map((a) => a.querySelector(".pm-facets__count")!.textContent)).toEqual(["0", "0"]);
          expect(current[0]!.getAttribute("href")).toBe(`?${new URLSearchParams({ style: emptyStyle }).toString()}`);
          expect(current[1]!.getAttribute("href")).toBe(`?${new URLSearchParams({ genre }).toString()}`);
        }
      }
    });
  }

  it("one past the end is genuinely degenerate — otherwise this guard proves nothing", async () => {
    // Non-vacuity. If `totalPages + 1` quietly served a full grid, every
    // assertion above would be comparing two ordinary pages and the case
    // that actually broke would be untested.
    const { lib, query } = await load();
    const summaries = lib.loadSnapshot("fixture").summaries as Summary[];
    const n = 24;
    const totalPages = Math.ceil(summaries.length / n);
    const past = plpPayload(query as never, summaries, { n, page: totalPages + 1 });
    expect(past.items.length, "the page past the end still holds releases").toBe(0);
    const last = plpPayload(query as never, summaries, { n, page: totalPages });
    expect(last.items.length, "the last real page is empty").toBeGreaterThan(0);
  });

  it("both arms render the empty page as `0`, and neither offers a Next from it", async () => {
    // The specific two things they disagreed about, asserted by value rather
    // than only by equality — so a future change that made BOTH arms wrong
    // in the same way still fails here.
    const { lib, query, htmx, reactNext } = await load();
    const summaries = lib.loadSnapshot("fixture").summaries as Summary[];
    const n = 24;
    const totalPages = Math.ceil(summaries.length / n);
    const payload = plpPayload(query as never, summaries, { n, page: totalPages + 1 });

    for (const [arm, html] of [
      ["htmx", render.htmx(htmx as never, payload, {})],
      ["react-next", render.reactNext(reactNext as never, payload, {})],
    ] as const) {
      expect(html, `${arm} renders a fabricated range on an empty page`).toContain(
        '<span class="pm-toolbar__n">0</span>',
      );
      expect(html, `${arm} still renders 0–0`).not.toContain("0–0");
      expect(html, `${arm} offers Next from past the end`).not.toContain('rel="next"');
    }
  });

  it("both arms render the restored controls' STATE by value: selected facet, chosen sort, search value, toggle-off href", async () => {
    // Equality with the reference proves agreement; this proves the agreed
    // markup says what the visitor needs it to say.
    const { lib, query, plp, htmx, reactNext } = await load();
    const summaries = lib.loadSnapshot("crate").summaries as Summary[];
    const genre = summaries[0]!.genres[0]!;
    const payload = plpPayload(query as never, summaries, { n: 24, page: 1, genre, sort: "title", q: "the" });
    const carry: Carry = { cache: "cold", run: "r1" };
    for (const [arm, html] of [
      ["htmx", render.htmx(htmx as never, payload, carry)],
      ["react-next", render.reactNext(reactNext as never, payload, carry)],
    ] as const) {
      // Parsed, so `&amp;` and React's `selected=""` compare as a browser sees them.
      const { document } = parseHTML(html);
      const selected = document.querySelector('.pm-facets__facet[aria-current="true"]');
      expect(selected, `${arm}: no selected facet`).not.toBeNull();
      expect(selected!.querySelector(".pm-facets__value")!.textContent).toBe(genre);
      // Toggle-off: the selected facet's href drops `genre` and keeps the rest.
      const off = new URLSearchParams(selected!.getAttribute("href")!.slice(1));
      expect(off.get("genre")).toBeNull();
      expect(off.get("sort")).toBe("title");
      expect(off.get("q")).toBe("the");
      expect(off.get("cache")).toBe("cold");
      expect(off.get("run")).toBe("r1");
      expect(off.get("page")).toBeNull();
      // Another facet's href ADDS itself and keeps the genre.
      const other = document.querySelector('.pm-facets__group:nth-of-type(2) .pm-facets__facet');
      expect(new URLSearchParams(other!.getAttribute("href")!.slice(1)).get("genre")).toBe(genre);
      // The chosen sort is the selected option; the search box holds the query.
      const option = document.querySelector("#plp-sort option[selected]");
      expect(option, `${arm}: no selected sort option`).not.toBeNull();
      expect(option!.getAttribute("value")).toBe("title");
      expect(document.querySelector("#plp-q")!.getAttribute("value")).toBe("the");
      // The forms carry the OTHER knobs as hidden inputs, never `page`.
      const searchHidden = [...document.querySelectorAll('.pm-toolbar__search input[type="hidden"]')].map(
        (i) => `${i.getAttribute("name")}=${i.getAttribute("value")}`,
      );
      expect(searchHidden).toEqual(["cache=cold", `run=r1`, `genre=${genre}`, "sort=title"]);
      const sortHidden = [...document.querySelectorAll('.pm-toolbar__sort input[type="hidden"]')].map(
        (i) => i.getAttribute("name"),
      );
      expect(sortHidden).toEqual(["cache", "run", "genre", "q"]);
      // …and both forms SERIALIZE canonically: walking a form's controls in
      // tree order — what a browser does on a JS-off submit — spells the URL
      // the href rule spells (page reset to 1). The first draft put the sort
      // form's hidden `q` BEFORE the select, so a JS-off sort with a search
      // applied spelled `…&q=the&sort=title`: a third spelling of one
      // condition, contradicting the code comment that claimed canonical
      // order (verify-slice, 2026-09-18). The name list above cannot see
      // position relative to the control; this can.
      const canonical = (plp as { conditionHref: (c: unknown) => string }).conditionHref({
        n: 24,
        page: 1,
        cache: "cold",
        run: "r1",
        genre,
        sort: "title",
        q: "the",
      });
      for (const form of ["search", "sort"]) {
        const params = new URLSearchParams();
        for (const el of document.querySelectorAll(
          `.pm-toolbar__${form} input[name], .pm-toolbar__${form} select[name]`,
        )) {
          const value =
            el.tagName.toLowerCase() === "select"
              ? ((el.querySelector("option[selected]") ?? el.querySelector("option"))?.getAttribute("value") ?? "")
              : (el.getAttribute("value") ?? "");
          params.append(el.getAttribute("name")!, value);
        }
        expect(`?${params.toString()}`, `${arm}: the ${form} form's JS-off spelling`).toBe(canonical);
      }
    }
  });
});
