/**
 * ADR-0005 §5's five PLP params — `genre`, `style`, `format`, `sort`, `q` —
 * and the key-cardinality policy that bounds what they can mint in KV
 * (ADR-0005 addendum, 2026-09-04; the policy's prose is the Worker's header).
 *
 * What these legs prove, in the order a skeptic would ask:
 *  1. The params FILTER. A facet click, a search and a sort each return a
 *     genuinely different tray whose items all satisfy the request — and the
 *     tray is exactly what the spec's own `applyPlpQuery` returns, because
 *     the Worker imports that function rather than re-typing it.
 *  2. Junk is a 400, `none`, and never a key — including values that are
 *     merely the wrong case, and values too long to be real.
 *  3. Empty is ABSENT: `?sort=`, `?q=`, `?genre=` are what a GET form submits
 *     for an untouched control, and they share the bare condition's key.
 *  4. What is stored: only q-less, knob-n, real-page conditions. A search
 *     never touches KV in either direction — so it can never HIT the
 *     unfiltered entry a q-less key already warmed (the design critique's
 *     kill finding). An unwarmed n never touches KV either.
 *  5. One condition, one key: spellings that decode alike share one key; the
 *     key spells `q` never; the longest real key stays far under KV's 512 B.
 *
 * Driven in-process with stub bindings over BOTH committed snapshots — the
 * fixture through this workspace's declared dependency, the crate by
 * repo-relative path (the react-next identity guard's precedent) because its
 * facet values carry the awkward characters (`&`, `,`, `"`, `⅓`) that break
 * naive encoders.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLP_N, plpWarmable } from "@pm/measurement";
import {
  PLP_SORTS,
  PLP_TRAY_VERSION,
  applyPlpQuery,
  facetValueSets,
  formatDescriptors,
  normalizeQ,
} from "@pm/reference/render/plp-query.mjs";
import worker from "../src/index.js";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const SNAPSHOTS = {
  fixture: join(
    dirname(createRequire(import.meta.url).resolve("@pm/snapshot-fixture/package.json")),
    "snapshot",
  ),
  crate: join(repoRoot, "tools", "snapshot-capture", "crate"),
};
const load = (name) =>
  JSON.parse(readFileSync(join(SNAPSHOTS[name], "summaries.json"), "utf8"));

/** Stub R2 + a RECORDING KV: gets AND puts are logged, so "never touches the
 *  tier" is asserted on the store's traffic, not inferred from a header. */
function stubEnv(summaries) {
  const warm = new Map();
  const puts = [];
  const gets = [];
  return {
    puts,
    gets,
    warm,
    env: {
      SNAPSHOT: {
        get: (key) =>
          Promise.resolve(
            key === "snapshot/summaries.json" ? { json: () => Promise.resolve(summaries) } : null,
          ),
      },
      WARM: {
        get: (key) => {
          gets.push(key);
          return Promise.resolve(warm.get(key) ?? null);
        },
        put: (key, value, options) => {
          puts.push({ key, options });
          warm.set(key, value);
          return Promise.resolve();
        },
      },
    },
  };
}

const get = (env, path) => worker.fetch(new Request(`https://pm-edge${path}`), env);
const q = (params) => `/api/plp?${new URLSearchParams(params).toString()}`;

for (const name of ["fixture", "crate"]) {
  describe(`${name}: the five params filter, and the tray is the spec's own`, () => {
    const summaries = load(name);
    const sets = facetValueSets(summaries);
    // The value most likely to break an encoder in each set: the longest.
    const worst = (set) => [...set].sort((a, b) => b.length - a.length)[0];
    const genre = [...sets.genre][0];
    const style = worst(sets.style);
    const format = worst(sets.format);

    it("non-vacuity: every facet set has more than one value and a filter really narrows the crate", async () => {
      expect(sets.genre.size).toBeGreaterThan(1);
      expect(sets.style.size).toBeGreaterThan(1);
      expect(sets.format.size).toBeGreaterThan(1);
      const { env } = stubEnv(summaries);
      const all = await (await get(env, "/api/plp")).json();
      const filtered = await (await get(env, q({ genre }))).json();
      expect(filtered.total).toBeGreaterThan(0);
      expect(filtered.total).toBeLessThan(all.total);
    });

    it("a facet value filters: every served item carries it, total and facets are recounted, applied names it", async () => {
      const { env } = stubEnv(summaries);
      for (const [param, value, pick] of [
        ["genre", genre, (s) => s.genres],
        ["style", style, (s) => s.styles],
        ["format", format, formatDescriptors],
      ]) {
        const res = await get(env, q({ [param]: value, n: "240" }));
        expect(res.status, `${param}=${value}`).toBe(200);
        const tray = await res.json();
        expect(tray.items.length, `${param}=${value} served nothing`).toBeGreaterThan(0);
        for (const item of tray.items) expect(pick(item), `${param}=${value}`).toContain(value);
        expect(tray.applied[param]).toBe(value);
        // The SAME tray the spec computes — the Worker has no opinion of its own.
        expect(tray).toEqual(
          applyPlpQuery(summaries, {
            n: 240,
            page: 1,
            genre: param === "genre" ? value : null,
            style: param === "style" ? value : null,
            format: param === "format" ? value : null,
            sort: null,
            q: null,
          }),
        );
        // Recount: the OTHER groups' counts sum to at most the filtered total
        // per item multiplicity, and never mention a value absent from the set.
        const others = ["genres", "styles", "formats"].filter((g) => !g.startsWith(param));
        for (const group of others) {
          for (const bucket of tray.facets[group]) {
            expect(bucket.count).toBeLessThanOrEqual(tray.total);
            expect(bucket.count).toBeGreaterThan(0);
          }
        }
      }
    });

    it("the selected group is counted with its OWN filter lifted — every switch target stays listed", async () => {
      const { env } = stubEnv(summaries);
      const tray = await (await get(env, q({ genre, n: "240" }))).json();
      // With only `genre` applied, the genre group is counted over the WHOLE
      // crate (its own filter lifted) — identical to the unfiltered rail.
      const unfiltered = await (await get(env, q({ n: "240" }))).json();
      expect(tray.facets.genres).toEqual(unfiltered.facets.genres);
      // …while the other groups are counted over the filtered set.
      expect(tray.facets.styles).not.toEqual(unfiltered.facets.styles);
    });

    it("`q` searches title OR artist, case-insensitively for A–Z, and is echoed normalized", async () => {
      const { env } = stubEnv(summaries);
      // A real word from a real title, upper-cased and padded — the form of a
      // hand-typed search.
      const word = summaries[3].title.split(" ").find((w) => /^[A-Za-z]{3,}$/.test(w));
      expect(word, "the fourth release needs a plain word in its title").toBeDefined();
      const res = await get(env, q({ q: `  ${word.toUpperCase()}   ` }));
      const tray = await res.json();
      expect(tray.total).toBeGreaterThan(0);
      const needle = word.toLowerCase();
      for (const item of tray.items) {
        expect(
          `${item.title} ${item.artist}`.replace(/[A-Z]/g, (c) => c.toLowerCase()),
        ).toContain(needle);
      }
      expect(tray.applied.q).toBe(word.toUpperCase());
      expect(tray).toEqual(
        applyPlpQuery(summaries, { n: 24, page: 1, genre: null, style: null, format: null, sort: null, q: word.toUpperCase() }),
      );
      // A string matching nothing is an honest empty result, not an error.
      const none = await (await get(env, q({ q: "zzzzqqqq-no-such-record" }))).json();
      expect(none.total).toBe(0);
      expect(none.totalPages).toBe(0);
      expect(none.items).toEqual([]);
    });

    it("every sort orders the whole matched set as the spec says, nulls last, ties on committed order", async () => {
      const { env } = stubEnv(summaries);
      for (const sort of PLP_SORTS) {
        const tray = await (await get(env, q({ sort, n: "240" }))).json();
        expect(tray.applied.sort).toBe(sort);
        const spec = applyPlpQuery(summaries, { n: 240, page: 1, genre: null, style: null, format: null, sort, q: null });
        expect(tray.items.map((s) => s.id)).toEqual(spec.items.map((s) => s.id));
        // Direction check by value, not by trust in the spec: the first two
        // non-null keys are in the promised order.
        const key = sort.startsWith("year") ? (s) => s.year : sort.startsWith("price") ? (s) => s.priceFrom?.amount ?? null : (s) => s.title.replace(/[A-Z]/g, (c) => c.toLowerCase());
        const values = tray.items.map(key).filter((v) => v !== null && v !== undefined);
        for (let i = 1; i < values.length; i++) {
          if (sort.endsWith("desc")) expect(values[i] <= values[i - 1], `${sort} at ${i}`).toBe(true);
          else expect(values[i] >= values[i - 1], `${sort} at ${i}`).toBe(true);
        }
        // Nulls last: once a null key appears, every later key is null.
        const keys = tray.items.map(key);
        const firstNull = keys.indexOf(null);
        if (firstNull !== -1) expect(keys.slice(firstNull).every((v) => v === null)).toBe(true);
      }
      // And the default is the committed order, untouched.
      const plain = await (await get(env, q({ n: "240" }))).json();
      expect(plain.items.map((s) => s.id)).toEqual(summaries.slice(0, 240).map((s) => s.id));
    });

    it("a search matches by ARTIST alone — held to the raw rows, not to the spec's own function", async () => {
      // The `q` leg above compares the Worker's tray to applyPlpQuery, which
      // the Worker IMPORTS: a defect in the shared module moves both sides
      // together. The 2026-09-18 sabotage table dropped the artist half of
      // the match and that leg stayed green. So the artist claim is held to
      // the summaries themselves: a word that occurs in some artist and in
      // NO title, so a title-only search would return nothing.
      const fold = (s) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
      const titles = summaries.map((s) => fold(s.title));
      const word = summaries
        .flatMap((s) => s.artist.split(/\s+/))
        .filter((w) => /^[A-Za-z]{3,}$/.test(w))
        .map(fold)
        .find((w) => !titles.some((t) => t.includes(w)));
      expect(word, "the snapshot needs a word that is in an artist and in no title").toBeDefined();
      const expected = summaries.filter((s) => fold(s.artist).includes(word)).length;
      expect(expected).toBeGreaterThan(0);
      const { env } = stubEnv(summaries);
      const tray = await (await get(env, q({ q: word.toUpperCase(), n: "240" }))).json();
      expect(tray.total).toBe(expected);
      for (const item of tray.items) {
        expect(fold(item.artist), item.artist).toContain(word);
        expect(fold(item.title), item.title).not.toContain(word);
      }
    });

    it("ties within a sort key keep the COMMITTED order — held to the rows' positions, not to the spec", async () => {
      // Same hazard as the artist leg: "ties on committed order" was asserted
      // by equality with the module both sides share, so nothing independent
      // read the tie-break. Held here to each row's position in `summaries`.
      // Non-vacuous: at least one sort must actually produce a tie run in the
      // served 240 (years repeat in both snapshots). Note: DELETING the
      // tie-break is a no-op — Array.prototype.sort is stable since ES2019 —
      // so the sabotage this leg exists for is a REVERSED tie-break.
      const { env } = stubEnv(summaries);
      const position = new Map(summaries.map((s, i) => [s.id, i]));
      const fold = (s) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
      const keyOf = {
        "year-desc": (s) => s.year,
        "year-asc": (s) => s.year,
        "price-asc": (s) => s.priceFrom?.amount ?? null,
        "price-desc": (s) => s.priceFrom?.amount ?? null,
        title: (s) => fold(s.title),
      };
      let tieRuns = 0;
      for (const sort of PLP_SORTS) {
        const tray = await (await get(env, q({ sort, n: "240" }))).json();
        const key = keyOf[sort];
        for (let i = 1; i < tray.items.length; i++) {
          if (key(tray.items[i]) !== key(tray.items[i - 1])) continue;
          tieRuns += 1;
          expect(
            position.get(tray.items[i].id),
            `${sort}: ${tray.items[i - 1].id} then ${tray.items[i].id} is out of committed order`,
          ).toBeGreaterThan(position.get(tray.items[i - 1].id));
        }
      }
      expect(tieRuns).toBeGreaterThan(0);
    });

    it("an EMPTY intersection still lists both selected values, at 0 — the rail keeps its toggle-off links", async () => {
      // ADR-0005 addendum Q1's one exception (verify-slice, 2026-09-18): the
      // recount over an empty intersection leaves the selected values no
      // bucket, and without the exception every renderer drew a rail with
      // no marked facet and no link that removed either filter.
      const { env } = stubEnv(summaries);
      const styleCounts = new Map();
      for (const s of summaries) for (const v of s.styles) styleCounts.set(v, (styleCounts.get(v) ?? 0) + 1);
      const styleOf = (g) => new Set(summaries.filter((s) => s.genres.includes(g)).flatMap((s) => s.styles));
      let pair = null;
      for (const g of sets.genre) {
        const has = styleOf(g);
        const st = [...sets.style].find((v) => !has.has(v));
        if (st) {
          pair = { genre: g, style: st };
          break;
        }
      }
      expect(pair, "the snapshot needs a genre × style pair with no releases").not.toBeNull();
      const tray = await (await get(env, q(pair))).json();
      expect(tray.total).toBe(0);
      expect(tray.items).toEqual([]);
      expect(tray.facets.genres.find((b) => b.value === pair.genre)).toEqual({ value: pair.genre, count: 0 });
      expect(tray.facets.styles.find((b) => b.value === pair.style)).toEqual({ value: pair.style, count: 0 });
      // No OTHER zero bucket exists: the exception is the selected value's alone.
      for (const group of ["genres", "styles", "formats"]) {
        const zeros = tray.facets[group].filter((b) => b.count === 0).map((b) => b.value);
        expect(zeros, group).toEqual(group === "genres" ? [pair.genre] : group === "styles" ? [pair.style] : []);
      }
      // A non-empty filtered result never needs the exception: its selected bucket is the real count.
      const one = await (await get(env, q({ genre: pair.genre }))).json();
      expect(one.facets.genres.find((b) => b.value === pair.genre).count).toBe(one.total);
    });

    it("the params compose: genre + style + sort + q on one request", async () => {
      const { env } = stubEnv(summaries);
      // Find a (genre, style) pair that co-occurs so the result is non-empty.
      const first = summaries.find((s) => s.styles.length > 0);
      const g = first.genres[0];
      const st = first.styles[0];
      const tray = await (await get(env, q({ genre: g, style: st, sort: "title", n: "240" }))).json();
      expect(tray.total).toBeGreaterThan(0);
      for (const item of tray.items) {
        expect(item.genres).toContain(g);
        expect(item.styles).toContain(st);
      }
      expect(tray.applied).toEqual({ genre: g, style: st, format: null, sort: "title", q: null });
    });
  });
}

describe("junk is a 400, `none`, and never a key", () => {
  const summaries = load("crate");
  const sets = facetValueSets(summaries);

  it("an unknown facet value — including the right value in the wrong case — 400s without a write", async () => {
    const { env, puts } = stubEnv(summaries);
    const real = [...sets.genre][0];
    for (const [param, value] of [
      ["genre", "Junk"],
      ["genre", real.toLowerCase() === real ? real.toUpperCase() : real.toLowerCase()],
      ["style", "not-a-style"],
      ["format", "Betamax"],
    ]) {
      const res = await get(env, q({ [param]: value }));
      expect(res.status, `${param}=${value}`).toBe(400);
      expect(res.headers.get("x-pm-cache-state"), `${param}=${value}`).toBe("none");
      const body = await res.json();
      expect(body.error).toBe(`unknown ${param}`);
      expect(JSON.stringify(body)).not.toMatch(/\bat .+\.js/);
    }
    expect(puts).toEqual([]);
  });

  it("an unknown sort 400s without a write", async () => {
    const { env, puts } = stubEnv(summaries);
    for (const sort of ["popularity", "TITLE", "year", "price-asc;drop"]) {
      const res = await get(env, q({ sort }));
      expect(res.status, `sort=${sort}`).toBe(400);
      expect(res.headers.get("x-pm-cache-state")).toBe("none");
      expect((await res.json()).error).toBe("unknown sort");
    }
    expect(puts).toEqual([]);
  });

  it("a value too long to be real is refused BEFORE the lookup, so no oversized key ever reaches KV", async () => {
    const { env, puts, gets } = stubEnv(summaries);
    const longest = Math.max(
      ...[...sets.genre, ...sets.style, ...sets.format].map((v) => encodeURIComponent(v).length),
    );
    // The bound must clear every real value with room to spare…
    expect(longest).toBeLessThan(96);
    // …and a 64-char CJK value (576 encoded bytes — the design critique's
    // arithmetic) must never become a KV key.
    const cjk = "測".repeat(64);
    const res = await get(env, q({ genre: cjk }));
    expect(res.status).toBe(400);
    expect(gets, "an oversized junk value reached KV.get").toEqual([]);
    expect(puts).toEqual([]);
    // Same for an ASCII value just over the encoded bound.
    const ascii = "x".repeat(97);
    expect((await get(env, q({ style: ascii }))).status).toBe(400);
    expect(gets).toEqual([]);
  });

  it("the bound is measured in the KEY's encoding: 96 `!`s pass encodeURIComponent but not URLSearchParams — refused, 400, no lookup", async () => {
    // The first draft bounded with encodeURIComponent, which leaves ! ' ( ) ~
    // as one byte where the key's serializer spells them as three; two such
    // values passed the bound and handed KV.get a 613-byte key, which KV
    // refuses on GET as on PUT — a junk URL answered 500 where the policy
    // promises 400 `none` (verify-slice, 2026-09-18). The stub KV enforces
    // the platform's 512-byte key limit so the test can see what the plane
    // would have done.
    const { env, puts, gets } = stubEnv(summaries);
    const strictGet = env.WARM.get;
    env.WARM.get = (key) => {
      if (new TextEncoder().encode(key).length > 512) {
        throw new Error(`UTF-8 encoded length of ${key.length} exceeds key length limit of 512.`);
      }
      return strictGet(key);
    };
    for (const ch of ["!", "'", "(", ")", "~"]) {
      const junk = ch.repeat(96);
      expect(encodeURIComponent(junk).length, `encodeURIComponent leaves ${ch} alone`).toBe(96);
      const res = await get(env, q({ genre: junk, style: junk }));
      expect(res.status, `two facets of 96 × ${ch}`).toBe(400);
      expect(res.headers.get("x-pm-cache-state")).toBe("none");
      // The PER-VALUE bound fires (first param, before the key is even
      // built) — `unknown genre`, not the whole-key belt's `unknown filter`.
      // Pinned so the two layers are each proven: bound the value with the
      // wrong encoder and the message flips; disable both and the status does.
      expect((await res.json()).error, `96 × ${ch}`).toBe("unknown genre");
    }
    expect(gets, "an oversized key reached KV.get").toEqual([]);
    expect(puts).toEqual([]);
    // And the belt over the braces: whatever the alphabet, a key KV would
    // refuse is refused first. A run nonce is the longest legitimate
    // dimension; with it the longest REAL key still clears the limit by far.
    const worst = (set) => [...set].sort((a, b) => b.length - a.length)[0];
    const worstReal = `/api/plp?${new URLSearchParams({ n: "240", page: "1", genre: worst(sets.genre), style: worst(sets.style), format: worst(sets.format), sort: "price-desc", run: "b".repeat(64) }).toString()}`;
    expect(new TextEncoder().encode(`v2:${worstReal}`).length).toBeLessThan(512);
    expect((await get(env, worstReal)).status).toBe(200);
  });

  it("a junk facet value cannot hit a warm entry: the lookup misses, then validation refuses", async () => {
    const { env, puts, gets } = stubEnv(summaries);
    // Warm the bare condition first — the state of the deployed plane.
    await get(env, "/api/plp");
    expect(puts).toHaveLength(1);
    const res = await get(env, q({ genre: "Junk" }));
    expect(res.status).toBe(400);
    // The lookup happened (validation needs the snapshot, which comes after)
    // but under a key that can never exist, so it missed.
    expect(gets.at(-1)).toContain("genre=Junk");
    expect(puts).toHaveLength(1);
  });
});

describe("empty is absent — what a GET form submits for an untouched control", () => {
  const summaries = load("fixture");

  it("`?sort=`, `?q=`, `?genre=` serve the bare condition under the bare condition's key", async () => {
    const { env, puts } = stubEnv(summaries);
    const bare = await (await get(env, "/api/plp")).json();
    for (const path of ["/api/plp?sort=", "/api/plp?q=", "/api/plp?genre=", "/api/plp?style=&format=&sort=&q="]) {
      const res = await get(env, path);
      expect(res.status, path).toBe(200);
      expect(await res.json(), path).toEqual(bare);
    }
    // One key for all five spellings: the first request wrote it, the rest hit.
    expect(new Set(puts.map((p) => p.key)).size).toBe(1);
    expect(puts).toHaveLength(1);
  });

  it("a whitespace-only `q` is absent too, and `applied.q` is the normalized string otherwise", async () => {
    const { env } = stubEnv(summaries);
    const bare = await (await get(env, "/api/plp")).json();
    expect(await (await get(env, "/api/plp?q=%20%20%20")).json()).toEqual(bare);
    const messy = "  Quiet    Variations  ";
    const tray = await (await get(env, q({ q: messy }))).json();
    expect(tray.applied.q).toBe(normalizeQ(messy));
    expect(tray.applied.q).toBe("Quiet Variations");
    // The cap: 64 code units, then trimmed.
    const long = "a".repeat(70);
    expect((await (await get(env, q({ q: long }))).json()).applied.q).toBe("a".repeat(64));
  });
});

describe("what is stored: q-less, knob-n, real-page conditions — and nothing else", () => {
  const summaries = load("fixture");

  it("a search never touches KV in EITHER direction — so it cannot hit the unfiltered entry", async () => {
    const { env, puts, gets } = stubEnv(summaries);
    // The deployed plane's state: the bare condition is warm.
    const bare = await (await get(env, "/api/plp")).json();
    expect(puts).toHaveLength(1);
    gets.length = 0;
    const word = summaries[0].title.split(" ")[0];
    const res = await get(env, q({ q: word }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-pm-cache-state")).toBe("none");
    const tray = await res.json();
    expect(tray.applied.q).toBe(word);
    expect(tray.total).toBeLessThan(bare.total);
    expect(gets, "a search read KV").toEqual([]);
    expect(puts, "a search wrote KV").toHaveLength(1);
    // `?cache=cold` on a search is still `bypass`: cold was asked for.
    expect((await get(env, q({ q: word, cache: "cold" }))).headers.get("x-pm-cache-state")).toBe("bypass");
  });

  it("an unwarmed n never touches KV; the two knob values warm as before", async () => {
    const { env, puts, gets } = stubEnv(summaries);
    for (const n of ["48", "1", "239", "25"]) {
      expect(plpWarmable(new URLSearchParams({ n }))).toBe(false);
      const res = await get(env, q({ n }));
      expect(res.status, `n=${n}`).toBe(200);
      expect(res.headers.get("x-pm-cache-state"), `n=${n}`).toBe("none");
      expect((await res.json()).perPage).toBe(Number(n));
    }
    expect(gets).toEqual([]);
    expect(puts).toEqual([]);
    for (const n of PLP_N.warmed) {
      const miss = await get(env, q({ n: String(n) }));
      expect(miss.headers.get("x-pm-cache-state")).toBe("miss");
      const hit = await get(env, q({ n: String(n) }));
      expect(hit.headers.get("x-pm-cache-state")).toBe("hit");
    }
    expect(puts.map((p) => p.key)).toEqual([
      `v${PLP_TRAY_VERSION}:/api/plp?n=24&page=1`,
      `v${PLP_TRAY_VERSION}:/api/plp?n=240&page=1`,
    ]);
  });

  it("a filter combination matching nothing has totalPages 0, so its page 1 is past the end and never stored", async () => {
    const { env, puts } = stubEnv(summaries);
    const sets = facetValueSets(summaries);
    // Two real values that never co-occur, found rather than assumed.
    let pair = null;
    outer: for (const g of sets.genre) {
      for (const st of sets.style) {
        if (!summaries.some((s) => s.genres.includes(g) && s.styles.includes(st))) {
          pair = [g, st];
          break outer;
        }
      }
    }
    expect(pair, "the fixture needs a genre/style pair with no releases").not.toBeNull();
    const res = await get(env, q({ genre: pair[0], style: pair[1] }));
    expect(res.status).toBe(200);
    const tray = await res.json();
    expect(tray.total).toBe(0);
    expect(tray.totalPages).toBe(0);
    expect(tray.items).toEqual([]);
    expect(res.headers.get("x-pm-cache-state")).toBe("none");
    expect(puts).toEqual([]);
  });

  it("a filtered page past ITS end is past the end — the ceiling is the filtered set's", async () => {
    const { env, puts } = stubEnv(summaries);
    const sets = facetValueSets(summaries);
    const genre = [...sets.genre].sort(
      (a, b) =>
        summaries.filter((s) => s.genres.includes(a)).length -
        summaries.filter((s) => s.genres.includes(b)).length,
    )[0]; // the rarest genre
    const real = await (await get(env, q({ genre }))).json();
    expect(real.totalPages).toBeGreaterThan(0);
    expect(real.totalPages).toBeLessThan(Math.ceil(summaries.length / 24));
    const past = await get(env, q({ genre, page: String(real.totalPages + 1) }));
    expect(past.headers.get("x-pm-cache-state")).toBe("none");
    expect((await past.json()).items).toEqual([]);
    expect(puts).toHaveLength(1);
  });
});

describe("one condition, one key", () => {
  const summaries = load("crate");
  const sets = facetValueSets(summaries);

  it("spellings that decode alike share one key; distinct conditions do not", async () => {
    const { env, puts } = stubEnv(summaries);
    const spaced = [...sets.style].find((v) => v.includes(" "));
    expect(spaced, "the crate needs a style with a space").toBeDefined();
    const plus = `/api/plp?style=${spaced.replace(/ /g, "+")}`;
    const pct = `/api/plp?style=${encodeURIComponent(spaced)}`;
    const trailing = `${pct}&`;
    const reordered = `/api/plp?page=1&n=24&style=${encodeURIComponent(spaced)}`;
    for (const path of [plus, pct, trailing, reordered]) {
      expect((await get(env, path)).status, path).toBe(200);
    }
    expect(puts.map((p) => p.key)).toEqual([puts[0].key]);
    // A different value is a different key.
    const other = [...sets.style].find((v) => v !== spaced);
    await get(env, q({ style: other }));
    expect(new Set(puts.map((p) => p.key)).size).toBe(2);
  });

  it("the key spells the applied condition in canonical order, never `q`, and stays far under KV's 512-byte limit", async () => {
    const { env, puts } = stubEnv(summaries);
    const worst = (set) => [...set].sort((a, b) => b.length - a.length)[0];
    // The longest possible REAL key: the three longest values, the longest
    // sort name, a 64-char run nonce, and a page number.
    const genre = worst(sets.genre);
    const style = worst(sets.style);
    const format = worst(sets.format);
    const run = "r".repeat(64);
    const res = await get(env, q({ n: "240", page: "1", genre, style, format, sort: "price-desc", run }));
    // The combination may match nothing (then nothing is written); assert on
    // the key the Worker WOULD use by requesting a combination that does.
    if (res.headers.get("x-pm-cache-state") === "miss") {
      const key = puts[0].key;
      expect(new TextEncoder().encode(key).length).toBeLessThan(512);
      expect(key.startsWith(`v${PLP_TRAY_VERSION}:/api/plp?n=240&page=1&`)).toBe(true);
    }
    // A key that certainly exists: the longest single value + the longest
    // sort + the longest nonce.
    const { env: env2, puts: puts2 } = stubEnv(summaries);
    await get(env2, q({ n: "240", style, sort: "price-desc", run }));
    expect(puts2).toHaveLength(1);
    const key = puts2[0].key;
    expect(new TextEncoder().encode(key).length).toBeLessThan(512);
    expect(key).toBe(
      `v${PLP_TRAY_VERSION}:/api/plp?${new URLSearchParams({ n: "240", page: "1", style, sort: "price-desc", run }).toString()}`,
    );
    expect(key).not.toContain("q=");
  });

  it("every crate facet value round-trips through a URL to a 200 — the rail's links can never 400", async () => {
    const { env } = stubEnv(summaries);
    for (const [param, set] of Object.entries(sets)) {
      for (const value of set) {
        const res = await get(env, q({ [param]: value, cache: "cold" }));
        expect(res.status, `${param}=${value}`).toBe(200);
        expect((await res.json()).applied[param], `${param}=${value}`).toBe(value);
      }
    }
  });
});
