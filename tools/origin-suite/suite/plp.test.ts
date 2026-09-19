/**
 * The PLP data plane through the COMPOSED origin (ADR-0005 §5 + its
 * 2026-09-04 addendum): a facet, a search and a sort each return a genuinely
 * filtered grid on both arms; junk 400s at the tray and 404s on the pages;
 * the key policy holds at the seam; the front Worker passes htmx's partials
 * through untouched. Plain HTTP at PM_ORIGIN, snapshot-aware (values are
 * found in the served snapshot's committed summaries, never typed), and every
 * request that could reach the warm tier carries `cache=cold` — these legs
 * must plant nothing on the deployed plane (the warm-tier guard's rule; the
 * PLP page paths are in its scope since this unit).
 *
 * DOM parity between the arms at filtered conditions is proven in-process by
 * `tools/repo-checks/test/plp-arms-agree.test.ts` and in a real browser by
 * `plp.browser.test.ts`; here the assertions are by VALUE at the seam: the
 * count a page states equals the total its tray reports, the first card is
 * the tray's first item, the selected facet is marked.
 */
import { describe, expect, it } from "vitest";
import { PlpPage } from "@pm/data-contract";
import { loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const RUN_NONCE = `suite-plp-${Date.now()}`;

const snap = await loadServedSnapshot();
/** Every request in this file goes through here. The repo-checks warm-tier
 *  guard now sees the `${arm.path}?…` lines below (2026-09-18), but a helper
 *  that REFUSES an undisciplined path is the belt over that brace: a line
 *  the guard's regex never learns still cannot plant a key on the deployed
 *  plane, because this file runs in the origin job before merge. */
const get = (path: string, init?: RequestInit) => {
  if (!/[?&](cache=cold|run=)/.test(path)) {
    throw new Error(`warm-tier discipline: ${path} carries neither cache=cold nor run=`);
  }
  return fetch(`${ORIGIN}${path}`, init);
};

const ARMS = [
  // kv-exempt: a path constant — every request built from it below carries cache=cold or run= on its own line
  { name: "htmx", path: "/htmx/plp/" }, // kv-exempt: path constant, see above
  { name: "react-next", path: "/react-next/plp/plain/" }, // kv-exempt: path constant, see above
] as const;

/** Real values from the served snapshot: the first release's genre, a style
 *  that co-occurs with it, and a plain word from a title. */
const genre = snap.summaries[0]!.genres[0]!;
const style = snap.summaries.find((s) => s.genres.includes(genre) && s.styles.length > 0)!.styles[0]!;
const word = snap.summaries[3]!.title.split(" ").find((w) => /^[A-Za-z]{3,}$/.test(w))!;

/** Every request line below spells `cache=cold` or `run=` LITERALLY — the
 *  repo-checks warm-tier guard reads lines, not helpers, and a helper that
 *  hid the discipline would have passed a future un-nonced line with it. */
const enc = (params: Record<string, string>) => new URLSearchParams(params).toString();

/** Next's streaming renderer separates adjacent text nodes with `<!-- -->`
 *  (React's SSR text boundary); a browser parses them away, and so does this,
 *  so a regex over the count line sees the same bytes from both arms. */
const noTextBoundaries = (body: string) => body.replace(/<!-- -->/g, "");

/** The "Showing A–B of N releases" line's N. */
function statedTotal(body: string): number {
  const m = noTextBoundaries(body).match(
    /<p class="pm-toolbar__count">Showing <span class="pm-toolbar__n">[^<]*<\/span> of <span class="pm-toolbar__n">(\d+)<\/span> releases<\/p>/,
  );
  if (!m) throw new Error("no toolbar count line in the page");
  return Number(m[1]);
}

/** The first card's linked title. */
function firstCardTitle(body: string): string | null {
  const m = body.match(/<a class="pm-release-card__link" href="[^"]+">([^<]+)<\/a>/);
  return m ? m[1]!.replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"') : null;
}

async function tray(params: Record<string, string>): Promise<PlpPage> {
  const res = await get(`/api/plp?cache=cold&${enc(params)}`);
  expect(res.status, `/api/plp?cache=cold&${enc(params)}`).toBe(200);
  return PlpPage.parse(await res.json());
}

describe("the five params filter through the composed origin (ADR-0005 §5)", () => {
  it("a facet narrows the tray, recounts the OTHER groups over the filtered set, and lifts its own", async () => {
    const all = await tray({ n: "240" });
    const filtered = await tray({ n: "240", genre });
    expect(filtered.total).toBeGreaterThan(0);
    expect(filtered.total).toBeLessThan(all.total);
    for (const item of filtered.items) expect(item.genres).toContain(genre);
    expect(filtered.applied).toEqual({ genre, style: null, format: null, sort: null, q: null });
    // Own group lifted: the genre buckets equal the unfiltered rail's.
    expect(filtered.facets.genres).toEqual(all.facets.genres);
    // The other groups are recounted: a style bucket's count is exactly what
    // clicking it returns — the rule the recount exists for.
    const bucket = filtered.facets.styles.find((b) => b.value === style)!;
    expect(bucket, `style ${style} missing from the recounted rail`).toBeDefined();
    const narrowed = await tray({ n: "240", genre, style });
    expect(narrowed.total).toBe(bucket.count);
  });

  it("a search matches title or artist, ASCII-case-insensitively; a sort reorders; both are echoed in `applied`", async () => {
    const searched = await tray({ q: `  ${word.toUpperCase()}  ` });
    expect(searched.total).toBeGreaterThan(0);
    const needle = word.toLowerCase();
    for (const item of searched.items) {
      expect(`${item.title} ${item.artist}`.toLowerCase()).toContain(needle);
    }
    expect(searched.applied.q).toBe(word.toUpperCase());
    const plain = await tray({ n: "240" });
    const sorted = await tray({ n: "240", sort: "year-asc" });
    expect(sorted.applied.sort).toBe("year-asc");
    expect(sorted.items.map((s) => s.id)).not.toEqual(plain.items.map((s) => s.id));
    const years = sorted.items.map((s) => s.year).filter((y): y is number => y !== null);
    for (let i = 1; i < years.length; i++) expect(years[i]! >= years[i - 1]!).toBe(true);
  });

  it("junk is a 400 with `none` at the tray — a value in the wrong case included", async () => {
    // kv-exempt: a 400 is refused before or without any write; cache=cold besides
    const junk: Record<string, string>[] = [
      { genre: "Junk" },
      { genre: genre.toLowerCase() === genre ? genre.toUpperCase() : genre.toLowerCase() },
      { sort: "popularity" },
    ];
    for (const params of junk) {
      const res = await get(`/api/plp?cache=cold&${enc(params)}`);
      expect(res.status, JSON.stringify(params)).toBe(400);
      expect(res.headers.get("x-pm-cache-state")).toBe("none");
      const body = JSON.stringify(await res.json());
      expect(body).not.toMatch(/\bat .+\.js/);
    }
  });

  it("the key policy at the seam: a search and an unwarmed n are `none`, never a warm-tier resource", async () => {
    // Nonced AND observed twice: a condition the tier never holds must not
    // come back as a hit on the second ask.
    const uncacheable: Record<string, string>[] = [{ q: word }, { n: "48" }];
    for (const params of uncacheable) {
      const path = `/api/plp?run=${RUN_NONCE}&${enc(params)}`;
      const first = await get(path);
      expect(first.status, path).toBe(200);
      expect(first.headers.get("x-pm-cache-state"), path).toBe("none");
      const second = await get(path);
      expect(second.headers.get("x-pm-cache-state"), path).toBe("none");
    }
    // …while a knob-n, filtered, real page warms as before (nonced, so it expires).
    const path = `/api/plp?run=${RUN_NONCE}&${enc({ n: "240", genre })}`;
    expect((await get(path)).headers.get("x-pm-cache-state")).toBe("miss");
  });
});

describe("both arms serve the filtered grid, by value", () => {
  for (const arm of ARMS) {
    it(`${arm.name}: a facet click's URL serves the filtered grid — count, cards and selected facet all agree with the tray`, async () => {
      const t = await tray({ genre });
      const res = await get(`${arm.path}?cache=cold&${enc({ genre })}`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(statedTotal(body)).toBe(t.total);
      expect(firstCardTitle(body)).toBe(t.items[0]!.title);
      // The selected facet is marked and its href toggles it OFF, keeping the column.
      expect(body).toMatch(
        new RegExp(`<a class="pm-facets__facet" href="\\?cache=cold" aria-current="true">\\s*<span class="pm-facets__value">${genre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</span>`),
      );
      // Every other in-surface href carries the column and the filter.
      expect(body).toMatch(/<a class="pm-pagination__link" href="\?page=2&amp;cache=cold&amp;genre=/);
      // The chrome rides the page exactly once, stamped for this surface.
      expect((body.match(/data-pm-chrome="1"/g) ?? []).length).toBe(1);
      expect(body).toContain('data-pm-surface="plp"');
    });

    it(`${arm.name}: a search URL and a sort URL each serve what the tray says`, async () => {
      const searched = await tray({ q: word });
      const s = await (await get(`${arm.path}?cache=cold&${enc({ q: word })}`)).text();
      expect(statedTotal(s)).toBe(searched.total);
      // Attribute ORDER differs by renderer (React puts `type` before `name`),
      // so match the two attributes that matter, in either order.
      expect(s).toMatch(new RegExp(`<input [^>]*id="plp-q"[^>]*value="${word}"|<input [^>]*value="${word}"[^>]*id="plp-q"`));
      const sorted = await tray({ sort: "year-asc" });
      const o = await (await get(`${arm.path}?cache=cold&${enc({ sort: "year-asc" })}`)).text();
      expect(firstCardTitle(o)).toBe(sorted.items[0]!.title);
      expect(o).toMatch(/<option value="year-asc" selected(="")?>Year — oldest first<\/option>/);
    });

    it(`${arm.name}: a junk filter is a branded 404 — "No such filter" — not the data-plane-down page`, async () => {
      const res = await get(`${arm.path}?cache=cold&${enc({ genre: "Junk" })}`);
      expect(res.status).toBe(404);
      const body = await res.text();
      expect(body).toContain("No such filter");
      expect(body).not.toContain("didn&#39;t answer");
      expect(body).not.toContain("didn&#x27;t answer");
      if (arm.name === "react-next") {
        // A thrown notFound() under multiple root layouts SSRs Next's own
        // `__next_error__` document; the branded boundary — and the chrome
        // slot inside its Shell — rides the RSC payload and renders at
        // hydration. That is the PDP 404's recorded shape (DIFF-TO-STARTER.md
        // item 25; pdp.test.ts "a non-canonical slug is a 404"), read off the
        // served body 2026-09-18: `<html id="__next_error__">`, no slot, the
        // front Worker logging `chrome-slot-count` 0 exactly as it does for
        // the PDP 404. So the sentence above is in the payload, not the
        // rendered HTML, and the chrome count is not a contract on this
        // path. The shell shape IS pinned: a Next release that starts
        // SSR-ing the boundary fails here, and this leg tightens to the
        // chrome count like htmx's.
        expect(body).toContain('<html id="__next_error__">');
      } else {
        // Still a shell page: the chrome slot is present, so the instrument frames it.
        expect((body.match(/data-pm-chrome="1"/g) ?? []).length).toBe(1);
      }
    });

    it(`${arm.name}: an empty result is honest — "Showing 0 of 0", no pagination landmark, no error`, async () => {
      const res = await get(`${arm.path}?cache=cold&${enc({ q: "zzzz-no-such-record-zzzz" })}`);
      expect(res.status).toBe(200);
      const body = noTextBoundaries(await res.text());
      expect(body).toContain('Showing <span class="pm-toolbar__n">0</span> of <span class="pm-toolbar__n">0</span> releases');
      expect(body).not.toContain('class="pm-pagination"');
      expect(body).not.toContain("pm-release-card");
    });
  }

  it("the htmx document passes the tray's cache-state through — `none` for a search, `bypass` for cold", async () => {
    // ADR-0005's one named obligation on the htmx Worker, at the seam.
    const cold = await get(`/htmx/plp/?cache=cold&${enc({ genre })}`);
    expect(cold.headers.get("x-pm-cache-state")).toBe("bypass");
    const search = await get(`/htmx/plp/?run=${RUN_NONCE}&${enc({ q: word })}`);
    expect(search.headers.get("x-pm-cache-state")).toBe("none");
  });
});

describe("the front Worker honours `x-pm-partial` (PLP handoff §6.1)", () => {
  it("an htmx partial passes through the composed origin with no chrome injected — and the full document still gets it once", async () => {
    const partial = await get(`/htmx/plp/?cache=cold&${enc({ genre })}`, { headers: { "HX-Request": "true" } });
    expect(partial.status).toBe(200);
    expect(partial.headers.get("x-pm-partial")).toBe("1");
    const body = await partial.text();
    expect(body.startsWith('<div class="pm-plp"'), body.slice(0, 80)).toBe(true);
    expect(body).not.toContain("data-pm-chrome");
    expect(body).not.toContain("/_pm/chrome.css");
    expect(body).not.toContain("<!doctype");
    // The whole document, same URL: chrome exactly once, head stylesheet present.
    const doc = await (await get(`/htmx/plp/?cache=cold&${enc({ genre })}`)).text();
    expect((doc.match(/data-pm-chrome="1"/g) ?? []).length).toBe(1);
    expect(doc).toContain("/_pm/chrome.css");
    // A history-restore re-fetch (both htmx headers) is a WHOLE document with chrome.
    const restore = await (
      await get(`/htmx/plp/?cache=cold&${enc({ genre })}`, {
        headers: { "HX-Request": "true", "HX-History-Restore-Request": "true" },
      })
    ).text();
    expect(restore).toContain("<!doctype html>");
    expect((restore.match(/data-pm-chrome="1"/g) ?? []).length).toBe(1);
  });
});
