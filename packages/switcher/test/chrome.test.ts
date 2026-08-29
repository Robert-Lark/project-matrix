/**
 * Unit-level guards on the chrome MARKUP CONTRACT (the composed-origin suite
 * owns the injected end-to-end behavior): swap hrefs rewrite only the variant
 * segment, the control-set stays sparse, planned cells are disclosures never
 * offers, C2 empty states render everywhere a number could, the fragment
 * stays inside its byte budget, and client-controlled input cannot break out
 * of attributes.
 */
import { describe, expect, it } from "vitest";
import { PROFILE_IDS } from "@pm/measurement";
import { renderChrome } from "../src/chrome";
import { SURFACE_CONTROLS, type SurfaceControls } from "../src/config";

const ctx = {
  variant: "placeholder-static",
  surface: "sample",
  pathname: "/placeholder-static/sample/",
  search: "?n=240&cache=cold",
  location: "local",
};

describe("switcher anchors (ADR-0004 §4–§5, §7)", () => {
  it("rewrites only the variant segment, preserving surface and query", () => {
    const html = renderChrome(ctx);
    expect(html).toContain('href="/placeholder-ssr/sample/?n=240&amp;cache=cold"');
    // Current variant is marked, not linked — the SWITCHER row has no
    // self-link (profile links elsewhere legitimately keep the current path).
    const switcherRow = html.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(switcherRow).toContain('aria-current="page">placeholder-static<');
    expect(switcherRow).not.toContain('href="/placeholder-static/');
  });

  it("offers only the variants the surface's control-set maps (sparse)", () => {
    const html = renderChrome(ctx);
    expect(html).not.toContain("vanilla");
  });

  it("an unregistered surface renders honestly — no switcher offer, no lab table", () => {
    const html = renderChrome({ ...ctx, surface: "nope" });
    expect(html).not.toContain("placeholder-ssr");
    expect(html).toContain("An unregistered surface");
    // Singleton reading branch (ADR-0007 §5): no table, the plain sentence.
    expect(html).toContain("No lab snapshot will exist for this page");
    expect(html).not.toContain("<table");
  });

  it("a planned matrix cell is a disclosure, never an offer (no anchor)", () => {
    // checkout, not editorial: slice E completed the editorial surface, so
    // it no longer HAS planned cells to disclose — this guard follows the
    // sparse frontier. Checkout is now PARTLY built (the checkout-vanilla
    // unit moved `vanilla` into `variants` and left `react-next`/`htmx`
    // planned), which is why it still works here and is in fact the better
    // fixture it was before: the row now carries a live cell AND planned
    // ones, so the assertion below proves the disclosure is scoped to the
    // planned columns rather than to a surface with nothing live at all.
    // When the last checkout variant lands, retarget again or synthesize a
    // config.
    const html = renderChrome({
      ...ctx,
      variant: "vanilla",
      surface: "checkout",
      pathname: "/vanilla/checkout/",
    });
    // checkout's planned variants render as dead table headers…
    expect(html).toContain("not built yet");
    // …and never as switcher anchors.
    const switcherRow = html.match(/data-pm-switcher>[\s\S]*?<\/(nav|span)>/)?.[0] ?? "";
    expect(switcherRow).not.toContain("<a ");
  });

  it("live anchors and planned disclosures coexist in one reading table (synthetic mixed surface)", () => {
    // No REAL surface is mid-build right now — slice E completed editorial,
    // and pdp/plp/checkout have no live cells yet — so the mixed state the
    // per-variant suite blocks covered until slice E (live anchors BESIDE
    // dead planned headers) would otherwise be exercised nowhere until
    // PDP's first slice re-enters it (verify-slice finding, seams lens).
    // SURFACE_CONTROLS is a plain module object; the synthetic registration
    // is test-local and removed in finally.
    const controls = SURFACE_CONTROLS as unknown as Record<string, SurfaceControls>;
    controls["__test-mixed"] = {
      variants: ["vanilla", "qwik"],
      plannedVariants: ["htmx"],
      proves: "synthetic mixed fixture — never shipped",
    };
    try {
      const html = renderChrome({
        ...ctx,
        variant: "vanilla",
        surface: "__test-mixed",
        pathname: "/vanilla/__test-mixed/",
      });
      // The planned cell is a dead labeled header in the table…
      expect(html).toContain(`htmx<span class="pm-chrome__note"> not built yet</span>`);
      // …while the live sibling anchors (query preserved — the swap is a
      // pure variant-segment rewrite) and the current cell is marked.
      const switcherRow = html.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
      expect(switcherRow).toContain('aria-current="page">vanilla<');
      expect(switcherRow).toContain('href="/qwik/__test-mixed/?n=240&amp;cache=cold"');
      expect(switcherRow).not.toContain("htmx");
      expect(html).toContain("Served by 2 of 3 planned variants today.");
    } finally {
      delete controls["__test-mixed"];
    }
  });

  it("anchors carry no script payload", () => {
    const html = renderChrome(ctx);
    expect(html).not.toMatch(/<a [^>]*on[a-z]+=/i);
    expect(html).not.toContain('href="javascript:');
  });
});

describe("the reading (ADR-0004 §6; C2)", () => {
  it("marks each spec profile selected under its ?profile= id", () => {
    for (const id of PROFILE_IDS) {
      const html = renderChrome({ ...ctx, search: `?profile=${id}` });
      const selected = html.match(/pm-chrome__cell--current" aria-current="true">([^<]+)</g) ?? [];
      expect(html).toContain("No published runs yet");
      expect(selected.join(" ")).not.toBe("");
    }
  });

  it("unknown ?profile= falls back without breaking the empty state", () => {
    const html = renderChrome({ ...ctx, search: "?profile=warp-speed" });
    expect(html).toContain("No published runs yet");
  });

  it("every lab cell without a published reading is an em-dash with SR text — never a bare number slot", () => {
    const html = renderChrome(ctx);
    const cells = html.match(/pm-chrome__none/g) ?? [];
    expect(cells.length).toBeGreaterThan(0);
    expect(html).toContain("no published run"); // caption-level, not per-cell
    // The fit line ships its designed empty state (no verdict without receipt).
    expect(html).toContain("No verdict — nothing is published for this page yet.");
  });

  it("the profile selector states what it is — a snapshot selector, never a throttle", () => {
    const html = renderChrome(ctx);
    expect(html).toContain("never re-throttles this page");
  });
});

describe("fenced variant exhibit (editorial-build slice F; ADR-0005 §7 / ADR-0008 §3)", () => {
  const editorialCtx = {
    variant: "vanilla",
    surface: "editorial",
    pathname: "/vanilla/editorial/",
    search: "",
    location: "local",
  };

  it("the switcher lists the exhibit as a tagged fenced anchor — the offer carries the boundary", () => {
    const html = renderChrome(editorialCtx);
    const switcherRow = html.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(switcherRow).toContain('class="pm-chrome__cell pm-chrome__cell--fenced"');
    expect(switcherRow).toContain('href="/remix3/editorial/"');
    expect(switcherRow).toContain("pre-release 3.0.0-beta.5");
  });

  it("the exhibit is never a reading-table column and never counted in Served-by", () => {
    const html = renderChrome(editorialCtx);
    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? "";
    expect(table).not.toContain("remix3");
    // Counts derive from variants/plannedVariants alone: five live, five
    // planned — the fenced exhibit moves neither number.
    expect(html).toContain("Served by 5 of 5 planned variants today.");
  });

  it("serving the exhibit marks its own fenced cell current and explains the missing lab column", () => {
    const html = renderChrome({
      ...editorialCtx,
      variant: "remix3",
      pathname: "/remix3/editorial/",
    });
    const switcherRow = html.match(/data-pm-switcher>[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(switcherRow).toContain(
      'class="pm-chrome__cell pm-chrome__cell--current pm-chrome__cell--fenced" aria-current="page">remix3<',
    );
    expect(switcherRow).not.toContain('href="/remix3/');
    // The RUM-only statement (FINDINGS §7(c)2): the note names the policy,
    // the table still reads the benchmarked five, the live slots remain.
    expect(html).toContain("data-pm-hud-fenced");
    expect(html).toContain("no lab snapshot exists for it, by policy");
    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? "";
    expect(table).not.toContain("remix3");
    expect(html).toContain('data-pm-hud-live="LCP"');
  });

  it("a core variant's page still swaps TO the exhibit with the query preserved", () => {
    const html = renderChrome({ ...editorialCtx, search: "?profile=slow-4g-mid-phone" });
    expect(html).toContain('href="/remix3/editorial/?profile=slow-4g-mid-phone"');
  });
});

describe("data-strategy surface (ADR-0005 §2/§8)", () => {
  const plpCtx = {
    variant: "react-next",
    surface: "plp",
    pathname: "/react-next/plp/plain/",
    search: "?cache=cold",
    location: "local",
  };

  it("strategy columns come from the presets; the fenced exhibit is never a column", () => {
    const html = renderChrome(plpCtx);
    expect(html).toContain("No caching (cold)");
    expect(html).toContain("Edge cache — KV");
    // Fenced Apollo exhibit: labeled in Controls, excluded from the cells.
    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? "";
    expect(table).not.toContain("Apollo");
    expect(html).toContain("excluded from every benchmark number");
  });

  it("the n knob preserves the rest of the condition", () => {
    const html = renderChrome(plpCtx);
    expect(html).toContain('aria-current="true">n=24<');
    expect(html).toMatch(/href="\/react-next\/plp\/plain\/\?cache=cold&amp;n=240"/);
  });

  it("readout and replay slots ship their designed empty states", () => {
    const html = renderChrome(plpCtx);
    expect(html).toContain("data-pm-hud-interaction");
    expect(html).toContain("lands with the store's PLP build");
  });
});

describe("beacon tag stamping", () => {
  it("the environment tag is canonicalized — aliases collapse to the served condition", () => {
    const html = renderChrome({ ...ctx, search: "?n=0240&cache=cold" });
    expect(html).toContain('data-pm-environment="n=240|cache=cold"');
    expect(html).toContain('data-pm-cache-state="cold"');
    const defaults = renderChrome({ ...ctx, search: "" });
    expect(defaults).toContain('data-pm-environment="n=24|cache=default"');
  });

  it("carries the full dataset contract measure.js reads", () => {
    const html = renderChrome(ctx);
    for (const attr of [
      'data-pm-chrome="1"',
      'data-pm-variant="placeholder-static"',
      'data-pm-surface="sample"',
      'data-pm-location="local"',
    ]) {
      expect(html).toContain(attr);
    }
  });
});

describe("geometry + budget (panel findings, hostile lens)", () => {
  it("live vitals render in both the bar mini and the panel — measure.js updates all slots", () => {
    const html = renderChrome(ctx);
    const lcpSlots = html.match(/data-pm-hud-live="LCP"/g) ?? [];
    expect(lcpSlots.length).toBe(2);
    const clsSlots = html.match(/data-pm-hud-live="CLS"/g) ?? [];
    expect(clsSlots.length).toBe(2);
  });

  it("the fragment stays inside its byte budget (ADR-0001 addendum F discipline)", () => {
    // The chrome rides every measured page's HTML; its size is a stated
    // constant, not a creeping variable (its wall-clock cost is re-measured
    // per ADR-0001 addendum F before any publication). Budget: 13 KiB —
    // raised from 12 by the first editorial publication, when the populated
    // state stopped being an estimate: a receipt anchor per cell PLUS the
    // min-max band ADR-0001 addendum C requires took the largest real
    // fragment (remix3, whose fenced note is extra) to 12,396 bytes. The
    // fragment's measured wire cost is 1,907 bytes brotli, so the raise is
    // bounded and cheap; the budget exists to catch creep, not to force
    // markup golf. Recorded in the ADR-0008 addendum.
    const plp = renderChrome({
      variant: "react-next",
      surface: "plp",
      pathname: "/react-next/plp/plain/",
      search: "?cache=cold&n=240&profile=slow-4g-mid-phone",
      location: "local",
    });
    expect(plp.length).toBeLessThan(13312);
  });

  it("the budget holds for a FULLY populated bundle, measured in bytes", () => {
    // Types erase and the empty state is the smallest render — the budget
    // must hold when every cell carries a receipt (verify-slice, skeptic
    // lens). Worst-case realistic receipt URLs, byte-measured (not UTF-16
    // code units — the fragment carries em-dashes and interpuncts).
    const receipt = {
      profile: "slow-4g-mid-phone" as const,
      date: "2026-08-01",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      location: "PDX",
      url: "/how-it-was-built/receipts/2026-08-01/plp/slow-4g-mid-phone/plain.json",
    };
    const metrics = ["initial JS", "TTFB", "FCP", "LCP", "CLS", "INP (scripted)"] as const;
    const columns: Record<string, Record<string, { value: number; unit: "ms" | "KB" | ""; receipt: typeof receipt }>> = {};
    for (const col of [
      "No caching (cold)",
      "Client cache — TanStack Query",
      "Server-rendered — loaders + PE",
      "Edge cache — KV",
    ]) {
      columns[col] = {};
      for (const m of metrics) columns[col][m] = { value: 12345.6789, unit: "ms", receipt };
    }
    const populated = renderChrome({
      variant: "react-next",
      surface: "plp",
      pathname: "/react-next/plp/plain/",
      search: "?cache=cold&n=240&profile=slow-4g-mid-phone",
      location: "PDX",
      lab: {
        surface: "plp",
        profile: "slow-4g-mid-phone",
        columns,
        fit: { sentence: "Under this profile the loaders build reaches first paint in one round trip where the client-cache build needs two.", receipt },
      },
    });
    expect(new TextEncoder().encode(populated).length).toBeLessThan(13312);
  });
});

describe("published readings (first editorial batch; C2 populated states)", () => {
  const receipt = {
    profile: "avg-broadband-desktop" as const,
    date: "2026-08-14",
    commitSha: "23a0e7ef4bf54bbad669778e1a4135fe00f82682",
    location: "local-dev",
    url: "/_pm/lab/receipts/editorial-avg-broadband-desktop.json",
  };
  const editorialCtx = {
    variant: "vanilla",
    surface: "editorial",
    pathname: "/vanilla/editorial/",
    search: "",
    location: "local",
  };
  const lab = {
    surface: "editorial",
    profile: "avg-broadband-desktop" as const,
    columns: {
      vanilla: { "initial JS": { value: 1.69, unit: "KB" as const, receipt } },
      "react-next": { "initial JS": { value: 154.85, unit: "KB" as const, receipt } },
    },
    fit: {
      sentence: "Identical prose, one interaction: the costs differ.",
      receipt,
    },
  };

  it("a populated cell is a receipt-linked value; unpublished cells stay em-dashes", () => {
    const html = renderChrome({ ...editorialCtx, lab });
    expect(html).toContain(
      `<a class="pm-chrome__reading" href="${receipt.url}">1.69&nbsp;KB</a>`,
    );
    expect(html).toContain("154.85&nbsp;KB");
    // Metrics without a published reading (TTFB…, and all of astro/qwik/htmx)
    // still render the designed em-dash — a partial bundle publishes nothing
    // it doesn't carry.
    expect(html).toContain("pm-chrome__none");
  });

  it("the reading's closing line flips to the receipt framing + the §9 limits link ONLY when populated", () => {
    const populated = renderChrome({ ...editorialCtx, lab });
    expect(populated).toContain('href="/methodology/"');
    expect(populated).toContain("How these numbers are made");
    expect(populated).not.toContain("No published runs yet");
    const empty = renderChrome(editorialCtx);
    expect(empty).toContain("No published runs yet");
    expect(empty).not.toContain('href="/methodology/"');
  });

  it("the fit line renders the sentence with its receipt link", () => {
    const html = renderChrome({ ...editorialCtx, lab });
    expect(html).toContain("Identical prose, one interaction: the costs differ.");
    expect(html).toContain(`href="${receipt.url}">receipt</a>`);
  });

  it("bandsOverlap forces the indistinguishable state even over a stale fit sentence (ADR-0001 addendum C)", () => {
    const html = renderChrome({
      ...editorialCtx,
      lab: { ...lab, bandsOverlap: true },
    });
    expect(html).toContain("Indistinguishable at this sample size.");
    expect(html).not.toContain("the costs differ");
  });

  it("a bundle for a profile the URL did not select renders NOTHING — the lockstep guard", () => {
    // The Worker resolves ?profile= with the same algorithm as this renderer;
    // if they ever drift, the failure must be visible em-dashes, never one
    // profile's numbers under another profile's selected cell.
    const html = renderChrome({
      ...editorialCtx,
      search: "?profile=slow-4g-mid-phone",
      lab, // an avg-broadband-desktop bundle
    });
    expect(html).not.toContain("1.69");
    expect(html).toContain("No published runs yet");
    expect(html).toContain("No verdict — nothing is published for this page yet.");
  });
});

describe("injection safety", () => {
  it("prototype keys in client-controlled segments cannot crash the renderer", () => {
    // verify-slice correctness lens: bare record lookups resolved inherited
    // Object.prototype members — ?profile=constructor 502'd every page.
    for (const evil of ["constructor", "__proto__", "toString"]) {
      const byProfile = renderChrome({ ...ctx, search: `?profile=${evil}` });
      expect(byProfile).toContain("No published runs yet");
      const bySurface = renderChrome({ ...ctx, surface: evil });
      expect(bySurface).toContain("An unregistered surface");
    }
  });

  it("client-controlled query cannot break out of attributes", () => {
    const html = renderChrome({
      ...ctx,
      search: '?n=24&x="/><script>alert(1)</script>',
      pathname: '/placeholder-static/sample/"><img src=x>/',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x>");
  });
});

describe("the interaction cell's three new render branches (ADR-0001 addendum T)", () => {
  // These branches carry the PDP's ENTIRE published headline — its INP row is
  // withheld and its byte figure can be deleted by the band-overlap rule — and
  // none of them was reachable from the origin suite until a post-merge batch
  // exists. A typo in any of the three would have shipped uncaught
  // (verify-slice, skeptic lens). Unit-tested here, where it blocks a merge.
  const receipt = {
    profile: "avg-broadband-desktop" as const,
    date: "2026-08-28",
    commitSha: "0000000000000000000000000000000000000000",
    location: "local-dev",
    url: "/_pm/lab/receipts/pdp-avg-broadband-desktop.json",
  };
  const pdpCtx = {
    variant: "vanilla",
    surface: "pdp",
    pathname: "/vanilla/pdp/some-release/",
    search: "",
    location: "local",
  };
  const columns = {
    vanilla: { "initial JS": { value: 4.32, unit: "KB" as const, receipt } },
    "react-next": { "initial JS": { value: 151.82, unit: "KB" as const, receipt } },
    astro: { "initial JS": { value: 1.6, unit: "KB" as const, receipt } },
    qwik: { "initial JS": { value: 32.86, unit: "KB" as const, receipt } },
  };

  it("a PUBLISHED INP row names the interaction it was driven by, in prose case", () => {
    const html = renderChrome({
      ...pdpCtx,
      lab: {
        surface: "pdp",
        profile: "avg-broadband-desktop" as const,
        columns: {
          ...columns,
          vanilla: { ...columns.vanilla, "INP (scripted)": { value: 24, unit: "ms" as const, receipt } },
        },
        interactionId: "pdp-gallery-switch",
        interactionTiming: { published: true },
        fit: { sentence: "A sentence.", receipt },
      },
    });
    expect(html).toContain("pdp-gallery-switch");
    // The row header must opt out of `.pm-chrome__th`'s uppercase + 0.14em
    // tracking, or the note ships SHOUTED.
    expect(html).toContain("pm-chrome__th--noted");
  });

  it("a WITHHELD INP row renders the reason and no reading, and says so in the caption", () => {
    const html = renderChrome({
      ...pdpCtx,
      lab: {
        surface: "pdp",
        profile: "avg-broadband-desktop" as const,
        columns,
        interactionId: "pdp-gallery-switch",
        interactionTiming: { published: false, reason: "not comparable on this surface" },
        fit: { sentence: "A sentence.", receipt },
      },
    });
    expect(html).toContain("not comparable on this surface");
    expect(html).toContain("pm-chrome__th--noted");
    // The withheld row must NOT fall back to naming the interaction — that is
    // the quiet failure: the row looks fine and says the wrong thing.
    expect(html).not.toContain("pdp-gallery-switch");
    // And four em-dashed cells, not a reading.
    expect(html).toContain("pm-chrome__none");
  });

  it("bandsOverlap deletes the VERDICT but not the cross-variant interaction constant", () => {
    const overlapping = renderChrome({
      ...pdpCtx,
      lab: {
        surface: "pdp",
        profile: "avg-broadband-desktop" as const,
        columns,
        interactionId: "pdp-gallery-switch",
        interactionTiming: { published: false, reason: "not comparable on this surface" },
        interactionFetch: { bytes: 25194, toleranceBytes: 64 },
        bandsOverlap: true,
      },
    });
    expect(overlapping).toContain("Indistinguishable at this sample size.");
    // 25194 / 1024 = 24.6 KB — the same number in every column, which is not a
    // ranking, so the overlap rule does not reach it.
    expect(overlapping).toContain("24.6");
    expect(overlapping).toContain("the same bytes, not a ranking");
    // A zero-byte constant states nothing extra: "the click costs 0 KB" is the
    // fit sentence's own claim, and the overlap state must not invent a verdict.
    const zero = renderChrome({
      ...pdpCtx,
      lab: {
        surface: "editorial",
        profile: "avg-broadband-desktop" as const,
        columns,
        interactionTiming: { published: true },
        interactionFetch: { bytes: 0 },
        bandsOverlap: true,
      },
    });
    expect(zero).toContain("Indistinguishable at this sample size.");
    expect(zero).not.toContain("the same bytes, not a ranking");
  });
});
