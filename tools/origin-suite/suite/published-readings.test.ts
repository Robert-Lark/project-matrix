/**
 * The published readings at the composed-origin seam (first editorial bench
 * batch; ADR-0008 §3 owner obligations, ADR-0001 §9 / addendum C). What this
 * file pins, outside-in over plain HTTP:
 *
 *  - /_pm/lab/editorial.json serves the committed publication: every reading
 *    carries a COMPLETE receipt (C2 as data, not just as type), every
 *    receipt URL it names dereferences to a clean, SHA-pinned v1 bench
 *    receipt, and the served values EQUAL what those receipts derive (warm
 *    median — the served bundle is generated from the receipts at build, so
 *    a mismatch means the pipeline lied);
 *  - the chrome renders the SAME numbers the bundle carries — under the
 *    default profile and under an explicit ?profile= — with the receipt
 *    framing + methodology link replacing the empty state ONLY where a
 *    bundle exists (the placeholder sample surface keeps its empty state,
 *    asserted in chrome.test.ts);
 *  - the fit line's copy discipline: the derived sentence with its receipt
 *    link, or bandsOverlap's designed state — never a bare verdict;
 *  - /methodology/ is a chrome-free static singleton whose stated chrome
 *    constant equals the served probe artifact (numbers substituted from
 *    committed artifacts, never typed — the home-receipts rule);
 *  - home's publication flips render values derived from the served bundle.
 */
import { describe, expect, it } from "vitest";
import { PROFILE_IDS } from "@pm/measurement";
import { SURFACE_CONTROLS } from "@pm/switcher";
import { loadServedSnapshot } from "./snapshot";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const get = (path: string) => fetch(`${ORIGIN}${path}`);

const READING_METRICS = ["initial JS", "TTFB", "FCP", "LCP", "CLS", "INP (scripted)"];
const DEFAULT_PROFILE = "avg-broadband-desktop";

type Reading = {
  value: number;
  unit: string;
  receipt: { profile: string; date: string; commitSha: string; location: string; url: string };
};
type Bundle = {
  surface: string;
  profile: string;
  columns: Record<string, Record<string, Reading>>;
  fit?: { sentence: string; receipt: Reading["receipt"] };
  bandsOverlap?: boolean;
};

async function servedLabFile(): Promise<{ surface: string; profiles: Record<string, Bundle> }> {
  const res = await get("/_pm/lab/editorial.json");
  expect(res.status).toBe(200);
  return res.json();
}

/**
 * Whether the plane is serving a PUBLICATION at all. "No published runs" is
 * a legitimate served state — it is what every unbuilt surface shows, and
 * what this surface shows between a code change and the batch that
 * re-measures it — so the assertions about published values gate on it
 * rather than encoding "a publication must exist" as a repo invariant. The
 * bundle's own presence is asserted unconditionally below, and the
 * chrome-side empty state is covered by chrome.test.ts.
 */
// Resolved at COLLECTION time (top-level await), because `it.skipIf` reads
// its condition while collecting — a value set in beforeAll would always
// still be false here.
const hasPublication = await (async () => {
  const res = await fetch(`${ORIGIN}/_pm/lab/editorial.json`);
  if (!res.ok) return false;
  const file = (await res.json()) as { profiles?: Record<string, unknown> };
  return Object.keys(file.profiles ?? {}).length > 0;
})();

/** The chrome's own escaping (a value like 26.83 has no metacharacters, but
 *  the sentence may carry &-escapes). */
const esc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * The publication pipeline is PER SURFACE (the generalisation off the
 * `editorial-` filename gate). `labBundle` in SURFACE_CONTROLS is the whole
 * registration: the front build emits /_pm/lab/{surface}.json for every
 * flagged surface and the Worker embeds it, so these legs are the
 * registry-completeness tie — flag a surface without wiring the pipeline and
 * they fail, exactly as PDP_SERVING ties the serving floor.
 */
const LAB_SURFACES = Object.entries(SURFACE_CONTROLS)
  .filter(([, controls]) => controls.labBundle === true)
  .map(([surface]) => surface);
const UNFLAGGED_SURFACES = Object.keys(SURFACE_CONTROLS).filter(
  (surface) => !LAB_SURFACES.includes(surface),
);

/**
 * Where each lab surface's own page lives, so an EMPTY publication can be
 * proven to render the chrome's designed empty state rather than a hole or a
 * crash. A flagged surface with no entry FAILS the completeness leg below —
 * a row is a runtime requirement, not an honor-system edit.
 */
const SURFACE_PAGE: Record<string, (snap: Awaited<ReturnType<typeof loadServedSnapshot>>) => string> = {
  editorial: () => "/vanilla/editorial/",
  pdp: (snap) => `/vanilla/pdp/${snap.pdpDetail.slug}/`,
};

describe("the lab pipeline is per-surface, driven by the SURFACE_CONTROLS registry", () => {
  it("registers at least the editorial surface (this suite is not vacuous)", () => {
    expect(LAB_SURFACES).toContain("editorial");
    expect(LAB_SURFACES.length).toBeGreaterThan(0);
  });

  it.each(LAB_SURFACES)(
    "%s serves its own bundle at /_pm/lab/{surface}.json, self-identifying",
    async (surface) => {
      const res = await get(`/_pm/lab/${surface}.json`);
      expect(res.status, `/_pm/lab/${surface}.json`).toBe(200);
      const file = await res.json();
      // The bundle names the surface it belongs to — the Worker keys
      // LAB_BUNDLES off this field, so a mislabeled artifact would serve one
      // surface's numbers under another's table.
      expect(file.surface).toBe(surface);
      expect(typeof file.profiles).toBe("object");
      expect(file.profiles).not.toBeNull();
      // Every profile key is a real profile, and each bundle self-identifies
      // with BOTH its surface and its profile (published or empty).
      for (const [id, bundle] of Object.entries(file.profiles as Record<string, Bundle>)) {
        expect(PROFILE_IDS).toContain(id);
        expect(bundle.surface).toBe(surface);
        expect(bundle.profile).toBe(id);
      }
    },
  );

  it.each(UNFLAGGED_SURFACES)(
    "%s carries no labBundle flag, so no bundle is served for it",
    async (surface) => {
      // The reverse tie: unflagging a surface must remove its artifact, not
      // leave a stale one served. Without this, the flag could be dropped
      // while the old bundle kept feeding the chrome.
      const res = await get(`/_pm/lab/${surface}.json`);
      expect(res.status, `/_pm/lab/${surface}.json`).toBe(404);
    },
  );

  it("every lab surface has a page entry here (completeness — no unproven surface)", () => {
    for (const surface of LAB_SURFACES) {
      // Object.hasOwn, not a bare index: surface keys index a plain object,
      // and the repo's recurring prototype-key class ("constructor" 502'd
      // instead of 404ing) is why every registry lookup here uses it.
      expect(
        Object.hasOwn(SURFACE_PAGE, surface),
        `no SURFACE_PAGE entry for "${surface}" — add its page path so its empty/published state is proven`,
      ).toBe(true);
    }
  });

  /**
   * BOTH directions, every surface, every run — replacing an empty-only leg
   * that verify-slice caught reproducing the DESCRIBED_VARIANTS anti-pattern
   * this repo already removed once (pdp.test.ts:44-50). That leg skipped any
   * PUBLISHED surface, so `SURFACE_PAGE.editorial` was never dereferenced on
   * any run and a typo'd path passed; and it would have fallen to ZERO
   * assertions the day the PDP batch lands and both surfaces are published,
   * while still counting among the green legs. Its "non-vacuity" line was
   * `expect(Array.isArray(empties)).toBe(true)` — true for every possible
   * value, including the empty array it was meant to catch.
   *
   * Here every registered surface is fetched on every run and asserted
   * against whatever its own served bundle carries, so the leg cannot go
   * quiet: today editorial exercises the published branch and pdp the empty
   * one, proving both on the same run.
   */
  it.each(LAB_SURFACES)(
    "%s's page renders exactly the state its own served bundle carries",
    async (surface) => {
      const file = await (await get(`/_pm/lab/${surface}.json`)).json();
      const snap = await loadServedSnapshot();
      const res = await get(SURFACE_PAGE[surface]!(snap));
      expect(res.status, `${surface} page`).toBe(200);
      const body = await res.text();
      const bundle = (file.profiles as Record<string, Bundle>)[DEFAULT_PROFILE];
      if (!bundle) {
        // Registering a surface must not POPULATE it: an empty bundle renders
        // the same empty state an unregistered surface does, so a surface's
        // pages are byte-for-byte what they were before it was flagged.
        expect(body, `${surface} page (empty bundle)`).toContain("No published runs yet");
        expect(body, `${surface} page (empty bundle)`).not.toContain(
          'class="pm-chrome__reading"',
        );
        return;
      }
      // The EMBED half of the registry tie, which serving alone cannot prove:
      // a surface whose bundle is served but not embedded in the Worker
      // renders this same empty state over fully published numbers. Asserting
      // the page carries the bundle's own values is what distinguishes them.
      expect(body, `${surface} page (published bundle)`).not.toContain("No published runs yet");
      for (const [variant, cell] of Object.entries(bundle.columns)) {
        const js = cell["initial JS"];
        if (!js) continue;
        expect(body, `${surface} ${variant} initial JS`).toContain(
          `<a class="pm-chrome__reading" href="${js.receipt.url}">${js.value}&nbsp;${js.unit}</a>`,
        );
      }
    },
  );
});

describe("/_pm/lab/editorial.json — the publication is complete and receipt-backed", () => {
  it("is served on the instrumentation path in either state — published or not", async () => {
    const res = await get("/_pm/lab/editorial.json");
    expect(res.status).toBe(200);
    const file = await res.json();
    expect(file.surface).toBe("editorial");
    expect(typeof file.profiles).toBe("object");
  });

  it.skipIf(!hasPublication)("carries a bundle per published profile, every reading with a complete receipt", async () => {
    const file = await servedLabFile();
    expect(file.surface).toBe("editorial");
    const profiles = Object.keys(file.profiles);
    expect(profiles.length).toBeGreaterThanOrEqual(1);
    for (const id of profiles) {
      expect(PROFILE_IDS).toContain(id);
      const bundle = file.profiles[id]!;
      expect(bundle.profile).toBe(id);
      // Columns are exactly the surface's live variants (never a fenced
      // exhibit, never a planned cell) — derived, not typed.
      expect(Object.keys(bundle.columns).sort()).toEqual(
        [...SURFACE_CONTROLS.editorial!.variants].sort(),
      );
      for (const [variant, cell] of Object.entries(bundle.columns)) {
        for (const metric of Object.keys(cell)) {
          expect(READING_METRICS).toContain(metric);
          const reading = cell[metric]!;
          expect(typeof reading.value, `${variant} ${metric}`).toBe("number");
          expect(Number.isFinite(reading.value)).toBe(true);
          for (const field of ["profile", "date", "commitSha", "location", "url"] as const) {
            expect(typeof reading.receipt[field]).toBe("string");
            expect(reading.receipt[field].length).toBeGreaterThan(0);
          }
          expect(reading.receipt.profile).toBe(id);
        }
      }
      // The fit discipline: a sentence with a receipt, or the overlap flag.
      expect(Boolean(bundle.fit) || bundle.bandsOverlap === true).toBe(true);
    }
  });

  it.skipIf(!hasPublication)("every receipt URL dereferences to a clean, SHA-pinned v1 bench receipt whose warm medians derive the served values", async () => {
    const file = await servedLabFile();
    for (const bundle of Object.values(file.profiles)) {
      const urls = new Set<string>();
      for (const cell of Object.values(bundle.columns)) {
        for (const reading of Object.values(cell)) urls.add(reading.receipt.url);
      }
      if (bundle.fit) urls.add(bundle.fit.receipt.url);
      for (const url of urls) {
        const res = await get(url);
        expect(res.status, url).toBe(200);
        const receipt = await res.json();
        expect(receipt.kind).toBe("pm-bench-receipt");
        expect(receipt.receiptVersion).toBe(1);
        // A published receipt from a dirty tree is not publishable.
        expect(receipt.commit.dirty).toBe(false);
        expect(receipt.profile.id).toBe(bundle.profile);
        // The served bundle equals what the receipt derives: warm-median
        // initial JS, rounded exactly as the build rounds (the bundle is
        // GENERATED from this receipt — a mismatch is a lying pipeline).
        for (const target of receipt.targets) {
          const med = target.columns.warm.medians;
          const cell = bundle.columns[target.variant]!;
          expect(cell, `${bundle.profile} ${target.variant}`).toBeDefined();
          if (med.initialJsBytes !== null) {
            expect(cell["initial JS"]!.value).toBe(
              Math.round((med.initialJsBytes / 1024) * 100) / 100,
            );
          }
          if (med.webVitals.LCP !== null) {
            expect(cell["LCP"]!.value).toBe(Math.round(med.webVitals.LCP));
          }
        }
      }
    }
  });

  it.skipIf(!hasPublication)("all published receipts pin ONE commit SHA — one publication, one batch discipline", async () => {
    const file = await servedLabFile();
    const shas = new Set<string>();
    for (const bundle of Object.values(file.profiles)) {
      for (const cell of Object.values(bundle.columns)) {
        for (const reading of Object.values(cell)) shas.add(reading.receipt.commitSha);
      }
    }
    expect(shas.size).toBe(1);
  });
});

describe("the chrome renders the published readings (C2 populated, end to end)", () => {
  it.skipIf(!hasPublication)("editorial pages carry receipt-linked values equal to the default-profile bundle", async () => {
    const file = await servedLabFile();
    const bundle = file.profiles[DEFAULT_PROFILE];
    expect(bundle).toBeDefined();
    const body = await (await get("/vanilla/editorial/")).text();
    for (const [variant, cell] of Object.entries(bundle!.columns)) {
      const js = cell["initial JS"]!;
      expect(body, `${variant} initial JS`).toContain(
        `<a class="pm-chrome__reading" href="${js.receipt.url}">${js.value}&nbsp;${js.unit}</a>`,
      );
    }
    // The empty state is gone from THIS surface; the receipt framing + the
    // ADR-0001 §9 limits link replace it.
    expect(body).not.toContain("No published runs yet");
    expect(body).toContain('href="/methodology/"');
    // The fit line renders the derived sentence with its receipt link.
    if (bundle!.fit) {
      expect(body).toContain(esc(bundle!.fit.sentence));
      expect(body).toContain(`href="${bundle!.fit.receipt.url}">receipt</a>`);
    } else {
      expect(bundle!.bandsOverlap).toBe(true);
      expect(body).toContain("Indistinguishable at this sample size.");
    }
  });

  it.skipIf(!hasPublication)("?profile= selects that profile's bundle — numbers switch with the snapshot selector", async () => {
    const file = await servedLabFile();
    for (const [id, bundle] of Object.entries(file.profiles)) {
      const body = await (await get(`/vanilla/editorial/?profile=${id}`)).text();
      const lcp = bundle.columns["react-next"]!["LCP"];
      if (!lcp) continue;
      expect(body, `profile ${id}`).toContain(`>${lcp.value}&nbsp;${lcp.unit}</a>`);
    }
  });

  it.skipIf(!hasPublication)("the POPULATED fragment stays inside the 13 KiB byte budget on every profile (ADR-0008 §5 addendum)", async () => {
    // The switcher package asserts the budget on fixtures; this is the REAL
    // bundle through the REAL injection path. remix3's page renders the
    // largest fragment (the fenced note + tagged cell ride along).
    for (const id of PROFILE_IDS) {
      for (const variant of ["vanilla", "remix3"]) {
        const body = await (await get(`/${variant}/editorial/?profile=${id}`)).text();
        const fragment = body.match(
          /<aside id="pm-chrome"[\s\S]*?<\/aside><script src="\/_pm\/measure\.js" defer><\/script>/,
        )?.[0];
        expect(fragment, `${variant} ?profile=${id}`).toBeDefined();
        expect(new TextEncoder().encode(fragment!).length).toBeLessThan(13312);
      }
    }
  });

  it.skipIf(!hasPublication)("the fenced exhibit's page reads the benchmarked variants' numbers, never its own column", async () => {
    const body = await (await get("/remix3/editorial/")).text();
    const file = await servedLabFile();
    const js = file.profiles[DEFAULT_PROFILE]!.columns["vanilla"]!["initial JS"]!;
    expect(body).toContain(`${js.value}&nbsp;${js.unit}`);
    // No remix3 reading-table column (slice F's pin, restated here against
    // the POPULATED table).
    expect(body).not.toMatch(/<th scope="col"[^>]*>remix3/);
  });
});

describe("/methodology/ — the ADR-0001 §9 page, chrome-free, numbers from artifacts", () => {
  it("serves the page with the limits-of-data framing and no injected chrome", async () => {
    const res = await get("/methodology/");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("How the numbers are made");
    expect(body).toContain("Limits of this data");
    expect(body).toContain("indistinguishable at this sample size");
    // The serialization caveat (ADR-0001 addendum M) is stated where the
    // numbers are read.
    expect(body).toContain("counts as JavaScript");
    // The dilution correction (ADR-0001 §3 addendum, 2026-08-15) is stated
    // the same way: the estimator by name, and the record that the batch
    // re-ran on the fixed ruler (the floors caveat left the page in the
    // same commit as the re-run's receipts — this pin moved with it).
    expect(body).toContain("leave-one-out");
    expect(body).toContain("re-ran on the fixed ruler");
    expect(body).not.toContain("data-pm-chrome");
    expect(body).not.toContain('id="pm-chrome-slot"');
  });

  it("states the chrome constant, or states plainly that none is published — both directions", async () => {
    // BOTH directions, on every run. An absent constant is a LEGAL state (the
    // front build's own existsSync guard makes it one) and it is the state the
    // tree is in for exactly one commit whenever the chrome fragment changes:
    // the addendum-N-hole-1 identity gate refuses a constant that describes a
    // fragment the build no longer ships, so re-measuring means publishing
    // nothing in between. A leg that only checked the populated direction went
    // red on that legal state and said nothing at all about the empty one —
    // the same shape as the DESCRIBED_VARIANTS anti-pattern this suite already
    // retired once (publication-pipeline unit).
    const res = await get("/_pm/lab/chrome-constant.json");
    const body = await (await get("/methodology/")).text();
    if (res.status === 404) {
      expect(body).toContain("has not been published for the current chrome yet");
      // Non-vacuity: the page must not ALSO be carrying a stale figure.
      expect(body).not.toContain("&nbsp;ms first paint");
      return;
    }
    expect(res.status).toBe(200);
    const artifact = await res.json();
    expect(artifact.kind).toBe("pm-chrome-constant");
    expect(artifact.commit.dirty).toBe(false);
    const signed = (v: number) =>
      v === 0 ? "0" : v > 0 ? `+${Math.round(v * 10) / 10}` : `−${Math.round(-v * 10) / 10}`;
    expect(body).toContain(
      `${signed(artifact.deltaMedians.FCP)}&nbsp;ms first paint`,
    );
    expect(body).toContain(
      `${signed(artifact.deltaMedians.LCP)}&nbsp;ms largest paint`,
    );
    expect(body).toContain(artifact.commit.sha.slice(0, 7));
  });
});

describe("home's publication flips render served-bundle-derived values (ADR-0007 §4/§5)", () => {
  it.skipIf(!hasPublication)("the editorial row's measured spread equals the default bundle's min–max initial JS", async () => {
    const file = await servedLabFile();
    const values = Object.values(file.profiles[DEFAULT_PROFILE]!.columns).map(
      (cell) => cell["initial JS"]!.value,
    );
    const body = await (await get("/")).text();
    expect(body).toContain(
      `${Math.min(...values)}–${Math.max(...values)}&nbsp;KB`,
    );
    // The band's empty-state copy flipped to the published state.
    expect(body).not.toContain("No published runs yet");
    expect(body).toContain('href="/methodology/"');
  });
});
