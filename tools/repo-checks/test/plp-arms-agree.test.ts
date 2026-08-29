/**
 * The two PLP arms must serve the SAME DOM for the same URL — including the
 * pages the reference master could not render when they were written.
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
 * The reference is page-aware now, so all three agree by construction. This
 * guard is what makes that a checked fact rather than a hope — it is the
 * ONLY place both implementations are rendered in the same process, which is
 * why it lives here rather than in either variant's own workspace.
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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface Summary {
  id: number;
  genres: string[];
  format: string;
  [key: string]: unknown;
}

/**
 * The `/api/plp` payload, built exactly as `workers/edge` `handlePlp` builds
 * it — same slice arithmetic, same facet comparator (count desc, CODE-UNIT
 * tie-break; `localeCompare` is ICU-version-dependent and disagreed at four
 * positions on the real crate). Re-typed rather than imported because the
 * Worker's copy is a Worker module; the arithmetic is the contract, and if
 * it drifts the identity legs in both variant suites fail first.
 */
function plpPayload(summaries: Summary[], { n, page }: { n: number; page: number }) {
  const count = (pick: (s: Summary) => string[]) => {
    const buckets = new Map<string, number>();
    for (const s of summaries) for (const v of pick(s)) buckets.set(v, (buckets.get(v) ?? 0) + 1);
    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([value, c]) => ({ value, count: c }));
  };
  const start = (page - 1) * n;
  return {
    items: summaries.slice(start, start + n),
    page,
    perPage: n,
    total: summaries.length,
    totalPages: Math.ceil(summaries.length / n),
    facets: {
      genres: count((s) => s.genres),
      styles: count((s) => s.styles as unknown as string[]),
      formats: count((s) => s.format.split(", ").slice(1)),
    },
  };
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
 *  mechanism attributes count as a difference: htmx's `hx-*` paginator
 *  attributes and react-next's streaming residue are each admitted by their
 *  own entry. Everything else is compared. */
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
function firstDivergence(a: string, b: string): string {
  const as = a.split("\n");
  const bs = b.split("\n");
  for (let i = 0; i < Math.max(as.length, bs.length); i += 1) {
    if (as[i] !== bs[i]) {
      return [
        `first divergence at normalized line ${i + 1}:`,
        `--- htmx        ${as[i] ?? "(end of document)"}`,
        `+++ react-next  ${bs[i] ?? "(end of document)"}`,
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
    const htmx = await import(
      pathToFileURL(join(repoRoot, "variants", "htmx", "src", "render.mjs")).href
    );
    const reactNext = await import(
      pathToFileURL(join(repoRoot, "variants", "react-next", "src", "lib", "plp.tsx")).href
    );
    return { lib, plp, htmx, reactNext };
  };

  /** Both arms reduced to the one thing they both own: the `div.pm-plp`
   *  subtree. htmx's `renderPlpFragment` IS that subtree (it is the hx-swap
   *  target); react-next's `PlpArticle` is its component for the same. The
   *  shells around them are each paradigm's own and are compared against the
   *  MASTER by the two identity suites, not against each other — this guard
   *  exists for the part the master could not describe. Both sides get the
   *  identical wrapper so the normalizer sees the same document shape. */
  const wrap = (subtree: string) =>
    `<!doctype html><html lang="en"><head></head><body>${subtree}</body></html>`;

  const render = {
    htmx: (mod: { renderPlpFragment: (d: unknown) => string }, payload: unknown) =>
      wrap(mod.renderPlpFragment(payload)),
    reactNext: (mod: { PlpArticle: unknown }, payload: { perPage: number }) =>
      wrap(
        renderToStaticMarkup(
          createElement(mod.PlpArticle as never, { payload, n: payload.perPage } as never),
        ),
      ),
  };

  for (const name of ["fixture", "crate"] as const) {
    for (const n of [24, 240]) {
      it(`${name} at n=${n}: identical DOM on page 1, the last page, and one past the end`, async () => {
        const { lib, htmx, reactNext } = await load();
        const snapshot = lib.loadSnapshot(name);
        const summaries = snapshot.summaries as Summary[];
        const totalPages = Math.ceil(summaries.length / n);

        // The three that matter: the pinned one, the boundary, and the
        // degenerate state neither arm's contract could describe.
        const pages = [...new Set([1, totalPages, totalPages + 1])];
        expect(pages.length, `n=${n} on ${name} collapses every page case`).toBeGreaterThan(1);

        for (const page of pages) {
          const payload = plpPayload(summaries, { n, page });
          const h = normalizeHtml(render.htmx(htmx as never, payload), BOTH_NOISE);
          const r = normalizeHtml(
            render.reactNext(reactNext as never, payload),
            BOTH_NOISE,
          );
          expect(h, `${name} n=${n} page=${page}: htmx rendered nothing`).toContain("pm-plp");
          expect(r, `${name} n=${n} page=${page}: react-next rendered nothing`).toContain("pm-plp");
          if (h !== r) {
            console.error(`${name} n=${n} page=${page}\n${firstDivergence(h, r)}`);
          }
          expect(
            r,
            `the two PLP arms disagree at ${name} n=${n} page=${page} — see the divergence above`,
          ).toBe(h);
        }
      });
    }
  }

  it("one past the end is genuinely degenerate — otherwise this guard proves nothing", async () => {
    // Non-vacuity. If `totalPages + 1` quietly served a full grid, every
    // assertion above would be comparing two ordinary pages and the case
    // that actually broke would be untested.
    const { lib } = await load();
    const summaries = lib.loadSnapshot("fixture").summaries as Summary[];
    const n = 24;
    const totalPages = Math.ceil(summaries.length / n);
    const past = plpPayload(summaries, { n, page: totalPages + 1 });
    expect(past.items.length, "the page past the end still holds releases").toBe(0);
    const last = plpPayload(summaries, { n, page: totalPages });
    expect(last.items.length, "the last real page is empty").toBeGreaterThan(0);
  });

  it("both arms render the empty page as `0`, and neither offers a Next from it", async () => {
    // The specific two things they disagreed about, asserted by value rather
    // than only by equality — so a future change that made BOTH arms wrong
    // in the same way still fails here.
    const { lib, htmx, reactNext } = await load();
    const summaries = lib.loadSnapshot("fixture").summaries as Summary[];
    const n = 24;
    const totalPages = Math.ceil(summaries.length / n);
    const payload = plpPayload(summaries, { n, page: totalPages + 1 });

    for (const [arm, html] of [
      ["htmx", render.htmx(htmx as never, payload)],
      ["react-next", render.reactNext(reactNext as never, payload)],
    ] as const) {
      expect(html, `${arm} renders a fabricated range on an empty page`).toContain(
        '<span class="pm-toolbar__n">0</span>',
      );
      expect(html, `${arm} still renders 0–0`).not.toContain("0–0");
      expect(html, `${arm} offers Next from past the end`).not.toContain('rel="next"');
    }
  });
});
