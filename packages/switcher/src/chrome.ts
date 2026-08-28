/**
 * The chrome renderer (ADR-0004 §5–§7; redesigned by the surface-design
 * session, 2026-07-17): the instrument strip + panel the front Worker injects
 * into `div#pm-chrome-slot` of every HTML response.
 *
 * Design constraints, all load-bearing:
 *  - The switcher core is PLAIN ANCHORS — a swap is a hard navigation onto
 *    the same measurement condition (ADR-0004 §4–§5). Works JS-off. On the
 *    render axis the anchor rewrites only the {variant} path segment; on the
 *    PLP's data-strategy axis anchors carry full (path, query) presets
 *    (strategy is identity → path, ADR-0005 §2).
 *  - The strip is GEOMETRICALLY INERT (panel kill, hostile lens): fixed
 *    collapsed block-size in chrome.css, fixed-width live-value slots — no
 *    post-load mutation may change the strip's box, or the instrument
 *    manufactures the CLS it reports.
 *  - `?profile=` is a SNAPSHOT SELECTOR (ADR-0004 §6): it marks which
 *    published lab snapshot the reading displays — it never re-throttles the
 *    page. The selector lives in the reading section, beside what it selects.
 *  - C2 (ADR-0007): a lab value cannot render without its receipt — the cell
 *    renderer takes a `PublishedReading` whose receipt is a required field.
 *    No published runs exist in this build; every slot shows its designed
 *    empty state. Singleton surfaces get no reading table at all (ADR-0007
 *    §5: no lab snapshot will ever exist off the benchmarked matrix).
 *  - Styling comes from /_pm/chrome.css (head-appended by the front Worker so
 *    the in-body blocking/FOUC path is dead) consuming the page's SEMANTIC
 *    tokens plus the chrome-owned instrument mono served from /_pm/fonts/ —
 *    both on the excluded path (ADR-0001 §6).
 *  - Every interpolated value is HTML-escaped: pathname and query are
 *    client-controlled and flow into markup.
 */
import { PROFILE_IDS, PROFILES, getProfile, knobTags, clampN } from "@pm/measurement";
import { SURFACE_CONTROLS, type SurfaceControls, type StrategyPreset } from "./config";
import { READING_METRICS, type SurfaceLabBundle, type PublishedReading } from "./lab";

export interface ChromeContext {
  /** First path segment — the variant serving this page. */
  variant: string;
  /** Second path segment — the surface. */
  surface: string;
  /** Full request pathname (used to build swap hrefs). */
  pathname: string;
  /** Raw query string including leading `?`, or empty. */
  search: string;
  /** Where this response was served from (e.g. CF colo), for beacon tags. */
  location: string;
  /** Published-runs bundle for this surface, when one exists (front build). */
  lab?: SurfaceLabBundle;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Swap href: rewrite ONLY the variant segment, keep surface/entity/query. */
function swapHref(pathname: string, search: string, targetVariant: string): string {
  const parts = pathname.split("/");
  parts[1] = targetVariant;
  return `${parts.join("/")}${search}`;
}

/** Same path/query with only the profile param replaced. */
function profileHref(pathname: string, search: string, profileId: string): string {
  const params = new URLSearchParams(search);
  params.set("profile", profileId);
  return `${pathname}?${params.toString()}`;
}

/** Same path/query with only the n knob replaced. */
function nHref(pathname: string, search: string, n: number): string {
  const params = new URLSearchParams(search);
  params.set("n", String(n));
  return `${pathname}?${params.toString()}`;
}

/** A strategy preset is live iff the variant its path targets serves it. */
function presetVariant(preset: StrategyPreset): string {
  return preset.path.split("/")[1] ?? "";
}

/** Current preset: path AND serving condition must match — the cold and edge
 *  presets share a path and differ only in `?cache=` (ADR-0005 §2). */
function presetIsCurrent(ctx: ChromeContext, preset: StrategyPreset): boolean {
  if (!ctx.pathname.startsWith(preset.path)) return false;
  const want = new URLSearchParams(preset.query).get("cache") === "cold" ? "cold" : "default";
  const have = new URLSearchParams(ctx.search).get("cache") === "cold" ? "cold" : "default";
  return want === have;
}

/* ── Cells ────────────────────────────────────────────────────────────────── */

/** C2 structural rule: this is the ONLY way a lab value enters the markup —
 *  the receipt is not optional. Empty cells are a bare em-dash; the table's
 *  caption carries the one "no published run" explanation (per-cell SR text
 *  ×30 was pure repetition and blew the byte budget). */
function labCell(reading: PublishedReading | undefined): string {
  // Runtime-defensive, not just type-safe: bundles arrive as JSON and the
  // types erase — a malformed cell renders the em-dash instead of throwing
  // mid-stream, and every field is escaped (verify-slice, skeptic lens).
  const r = reading?.receipt;
  if (
    !reading ||
    typeof reading.value !== "number" ||
    !Number.isFinite(reading.value) ||
    !r ||
    typeof r.url !== "string" ||
    typeof r.profile !== "string" ||
    typeof r.date !== "string" ||
    typeof r.commitSha !== "string" ||
    typeof r.location !== "string"
  ) {
    return `<td class="pm-chrome__td pm-chrome__none">—</td>`;
  }
  const label = `${esc(String(reading.value))}${reading.unit ? `&nbsp;${esc(String(reading.unit))}` : ""}`;
  // The min–max band rides beside the median (ADR-0001 addendum C). It sits
  // OUTSIDE the anchor so the link text stays the number itself, and the
  // caption — not 30 repetitions of per-cell SR text — explains what the
  // second figure is. Runtime-defensive like the value above: a malformed
  // band renders nothing rather than throwing mid-stream.
  const b = reading.band;
  const band =
    b && typeof b.min === "number" && typeof b.max === "number" &&
    Number.isFinite(b.min) && Number.isFinite(b.max)
      // <small>, not <span>: it is the element for fine print qualifying the
      // value beside it, and it costs 11 bytes less per cell against the
      // fragment budget — 23 cells of it on this surface.
      ? `<small class="pm-chrome__band">${esc(String(b.min))}–${esc(String(b.max))}</small>`
      : "";
  // No per-cell title tooltip: the href IS the receipt (profile, date,
  // commit, location live at the linked artifact) — 24 tooltips cost ~2.4 KB
  // against the fragment budget for data one click away (skeptic lens).
  return `<td class="pm-chrome__td"><a class="pm-chrome__reading" href="${esc(r.url)}">${label}</a>${band}</td>`;
}

function switcherCells(ctx: ChromeContext, controls: SurfaceControls): string {
  const strategies = controls.strategies;
  if (strategies) {
    // Data-strategy axis (PLP): live presets are anchors; fenced ones are
    // labeled in the Controls section, never counted as cells (ADR-0005 §7).
    const cells = strategies
      .filter((s) => !s.fenced && controls.variants.includes(presetVariant(s)))
      .map((s) => {
        const href = `${s.path}${s.query}`;
        return presetIsCurrent(ctx, s)
          ? `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="page">${esc(s.label)}</span>`
          : `<a class="pm-chrome__cell" href="${esc(href)}">${esc(s.label)}</a>`;
      })
      .join("");
    if (cells) return cells;
    // No preset live yet: name the CURRENT condition honestly (the preset
    // this URL matches), never a variant name under a "strategy" key.
    const current = strategies.find((s) => presetIsCurrent(ctx, s));
    return `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="page">${esc(current?.label ?? ctx.variant)}</span>`;
  }
  const liveCells = controls.variants.map((v) =>
    v === ctx.variant
      ? `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="page">${esc(v)}</span>`
      : `<a class="pm-chrome__cell" href="${esc(swapHref(ctx.pathname, ctx.search, v))}">${esc(v)}</a>`,
  );
  // Fenced variant exhibits (editorial-build slice F): a live anchor IN the
  // control, tag attached — the offer itself carries the boundary
  // (FINDINGS §7(c)2) — but never a plain cell a visitor could mistake for
  // a benchmarked variant, and never counted anywhere (ADR-0005 §7).
  const fencedCells = (controls.fencedExhibits ?? []).map((f) => {
    // &nbsp;, not a plain space: the cell starts an inline formatting
    // context, so a leading collapsible space renders flush
    // ("remix3pre-release…" — caught on a real screenshot).
    const tag = `<span class="pm-chrome__note">&nbsp;${esc(f.tag)}</span>`;
    return f.variant === ctx.variant
      ? `<span class="pm-chrome__cell pm-chrome__cell--current pm-chrome__cell--fenced" aria-current="page">${esc(f.variant)}${tag}</span>`
      : `<a class="pm-chrome__cell pm-chrome__cell--fenced" href="${esc(swapHref(ctx.pathname, ctx.search, f.variant))}">${esc(f.variant)}${tag}</a>`;
  });
  return [...liveCells, ...fencedCells].join("");
}

/* ── Panel sections (pinned on-page headings: This surface · The reading ·
      Fit · Your visit · The condition · Controls) ─────────────────────────── */

function surfaceSection(controls: SurfaceControls): string {
  const live = controls.variants.length;
  const planned = live + (controls.plannedVariants?.length ?? 0);
  // Counts render from the config's own arrays — never typed (panel kill).
  const count =
    controls.singleton || planned === 0
      ? ""
      : ` <span class="pm-chrome__note">Served by ${live} of ${planned} planned variants today.</span>`;
  return [
    `<section class="pm-chrome__section">`,
    `<h3 class="pm-chrome__h">This surface</h3>`,
    `<p>${esc(controls.proves)}${count}</p>`,
    `</section>`,
  ].join("");
}

function readingSection(
  ctx: ChromeContext,
  controls: SurfaceControls,
  lab: SurfaceLabBundle | undefined,
): string {
  if (controls.singleton) {
    return [
      `<section class="pm-chrome__section">`,
      `<h3 class="pm-chrome__h">The reading</h3>`,
      `<p data-pm-hud-lab>No lab snapshot will exist for this page — it sits off the benchmarked matrix, by design. The live readout below is still real.</p>`,
      `</section>`,
    ].join("");
  }

  const params = new URLSearchParams(ctx.search);
  const selectedProfile = getProfile(params.get("profile") ?? "") ?? PROFILES["avg-broadband-desktop"];
  const profileCells = PROFILE_IDS.map((id) => {
    const label = esc(PROFILES[id].label);
    return selectedProfile.id === id
      ? `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="true">${label}</span>`
      : `<a class="pm-chrome__cell" href="${esc(profileHref(ctx.pathname, ctx.search, id))}">${label}</a>`;
  }).join("");

  // Columns: the surface's comparison axis — data strategies on the PLP
  // (fenced exhibits excluded from cells, ADR-0005 §7), variants elsewhere.
  // Planned-but-unbuilt columns render as dead labeled headers: a disclosure,
  // not an offer (sparse honesty, ADR-0004 §7).
  const columns: { key: string; live: boolean }[] = controls.strategies
    ? controls.strategies
        .filter((s) => !s.fenced)
        .map((s) => ({ key: s.label, live: controls.variants.includes(presetVariant(s)) }))
    : [
        ...controls.variants.map((v) => ({ key: v, live: true })),
        ...(controls.plannedVariants ?? []).map((v) => ({ key: v, live: false })),
      ];

  const head = columns
    .map(
      (c) =>
        `<th scope="col" class="pm-chrome__th${c.live ? "" : " pm-chrome__th--planned"}">${esc(c.key)}${
          c.live ? "" : `<span class="pm-chrome__note"> not built yet</span>`
        }</th>`,
    )
    .join("");

  const rows = READING_METRICS.map((metric) => {
    const cells = columns
      .map((c) => labCell(lab?.columns[c.key]?.[metric]))
      .join("");
    // The INP row IS this table's interaction cell — there is no
    // interaction-bytes row — so it names the interaction it was driven by.
    // Without that, two surfaces' INP rows look identical while measuring
    // different clicks, and the reader's only recourse is the raw receipt.
    //
    // And where the surface WITHHOLDS the metric (ADR-0001 addendum T: the
    // entry closes before a resumed handler paints, so the cell is not
    // measuring the same thing in every column), the row says why rather than
    // showing four unexplained em-dashes. Withheld loudly, never quietly.
    let label = esc(metric);
    if (metric === "INP (scripted)") {
      const note =
        lab?.interactionTiming?.published === false
          ? lab.interactionTiming.reason
          : lab?.interactionId;
      if (note) label = `${metric}<span class="pm-chrome__note"> ${esc(note)}</span>`;
    }
    return `<tr><th scope="row" class="pm-chrome__th">${label}</th>${cells}</tr>`;
  }).join("");

  // Serving a fenced exhibit: the table still reads the BENCHMARKED
  // variants (fenced ones structurally have no column — the `columns`
  // builder above never sees them), and this line says why this page's own
  // numbers are absent (FINDINGS §7(c)2: the HUD on a fenced variant shows
  // the visitor's RUM but no lab snapshot — none exists, by policy).
  const fencedHere = (controls.fencedExhibits ?? []).find((f) => f.variant === ctx.variant);
  const fencedNote = fencedHere
    ? `<p class="pm-chrome__note" data-pm-hud-fenced>This variant (${esc(fencedHere.variant)}, ${esc(fencedHere.tag)}) is a fenced exhibit — no lab snapshot exists for it, by policy. The table reads the benchmarked variants; the live readout below is still your real visit.</p>`
    : "";

  // The populated state flips the designed empty-state line to the receipt
  // framing plus the ADR-0001 §9 inline limits-of-data affordance — the
  // methodology page sits one click from the numbers it qualifies.
  const hudLab = lab
    ? `<p data-pm-hud-lab>Every number above links its receipt — profile, date, commit, location. <a href="/methodology/">How these numbers are made — and what they can't say</a>.</p>`
    : `<p data-pm-hud-lab>No published runs yet. When a number lands here it carries its receipt — profile, date, commit, location — or it doesn't land at all.</p>`;

  return [
    `<section class="pm-chrome__section">`,
    `<h3 class="pm-chrome__h">The reading</h3>`,
    fencedNote,
    `<p class="pm-chrome__row"><span class="pm-chrome__key">lab profile</span>${profileCells}<span class="pm-chrome__note">selects the displayed snapshot — never re-throttles this page</span></p>`,
    `<div class="pm-chrome__scroll" role="region" aria-label="Published lab readings" tabindex="0">`,
    `<table class="pm-chrome__table">`,
    `<caption class="pm-chrome__sr">Published lab readings under the selected profile: each cell is the median of the batch's runs, followed by that metric's min–max band across those runs — where two bands overlap the difference is inside the noise. Values are the WARM (steady-state edge) column regardless of this page's own cache knob; the linked receipt carries the cold column beside it. An em-dash is a cell with no published run — or, where a row says so, a metric this surface withholds because it does not measure the same thing in every column. Lab compares; the live readout below is your reality check.</caption>`,
    `<thead><tr><td></td>${head}</tr></thead>`,
    `<tbody>${rows}</tbody>`,
    `</table>`,
    `</div>`,
    hudLab,
    `</section>`,
  ].join("");
}

function fitSection(lab: SurfaceLabBundle | undefined): string {
  let line: string;
  // bandsOverlap FIRST: a bundle carrying both a stale fit sentence and
  // bandsOverlap must render the indistinguishable state — ADR-0001 addendum
  // C forbids the verdict (verify-slice, conformance lens).
  if (lab?.bandsOverlap) {
    // The overlap rule forbids the comparative VERDICT, not every fact. A
    // cross-variant interaction constant is not a ranking — it is the same
    // number in every column — so it survives here rather than vanishing with
    // the sentence. Without this, a surface whose bands overlapped AND whose
    // INP row is withheld would publish nothing at all about its own click,
    // which on the PDP is the surface's entire headline (verify-slice,
    // conformance lens).
    const bytes = lab.interactionFetch?.bytes;
    const clickLine =
      typeof bytes === "number" && bytes > 0
        ? ` The scripted click costs <span class="num">${esc(String(Math.round((bytes / 1024) * 100) / 100))}</span>&nbsp;KB in every column — the same bytes, not a ranking.`
        : ``;
    line = `Indistinguishable at this sample size.${clickLine}`;
  } else if (lab?.fit) {
    const r = lab.fit.receipt;
    line = `${esc(lab.fit.sentence)} <a class="pm-chrome__reading" href="${esc(r.url)}">receipt</a>`;
  } else {
    line = `No verdict — nothing is published for this page yet.`;
  }
  return [
    `<section class="pm-chrome__section">`,
    `<h3 class="pm-chrome__h">Fit</h3>`,
    `<p data-pm-hud-fit>${line} <span class="pm-chrome__note">A fit line reads one surface under one condition — never a global ranking.</span></p>`,
    `</section>`,
  ].join("");
}

const LIVE_METRICS = ["TTFB", "FCP", "LCP", "CLS", "INP"] as const;

function liveVital(metric: string): string {
  return `<span class="pm-chrome__vital"><span class="pm-chrome__vital-name">${metric}</span><span class="pm-chrome__vital-value" data-pm-hud-live="${metric}">–</span></span>`;
}

function visitSection(): string {
  return [
    `<section class="pm-chrome__section">`,
    `<h3 class="pm-chrome__h">Your visit</h3>`,
    `<p class="pm-chrome__vitals">${LIVE_METRICS.map(liveVital).join("")}</p>`,
    `<p class="pm-chrome__note">These numbers are your visit — your device, your network — measured by the same pinned ruler every page gets. TTFB and first paint land right away; layout-shift and interaction metrics settle as you use or leave the page.</p>`,
    `<noscript><p class="pm-chrome__note">JavaScript is off, so the live readout stays blank — the switcher and everything else here works without it.</p></noscript>`,
    `<p class="pm-chrome__vow">When a published number and yours disagree, trust yours — then <a href="https://github.com/Robert-Lark/project-matrix/issues" rel="noopener">send me the URL</a>.</p>`,
    `</section>`,
  ].join("");
}

function conditionSection(ctx: ChromeContext): string {
  const params = new URLSearchParams(ctx.search);
  const { cacheState } = knobTags(ctx.search);
  const profile = getProfile(params.get("profile") ?? "");
  const entry = (dt: string, dd: string) =>
    `<div class="pm-chrome__cond-item"><dt>${dt}</dt><dd>${dd}</dd></div>`;
  return [
    `<section class="pm-chrome__section">`,
    `<h3 class="pm-chrome__h">The condition</h3>`,
    `<dl class="pm-chrome__cond">`,
    entry("variant", esc(ctx.variant)),
    entry("surface", esc(ctx.surface)),
    entry("n", String(clampN(params.get("n")))),
    entry("cache", esc(cacheState)),
    entry("profile", profile ? esc(profile.id) : "—"),
    entry("served from", esc(ctx.location)),
    entry("snapshot", `<a href="/api/snapshot">manifest</a>`),
    `</dl>`,
    `<p class="pm-chrome__note">The URL is the whole measurement condition — share it and you share the experiment.</p>`,
    `</section>`,
  ].join("");
}

function controlsSection(ctx: ChromeContext, controls: SurfaceControls): string {
  const parts: string[] = [];
  if (controls.nKnob) {
    const n = clampN(new URLSearchParams(ctx.search).get("n"));
    const cells = controls.nKnob
      .map((value) =>
        value === n
          ? `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="true">n=${value}</span>`
          : `<a class="pm-chrome__cell" href="${esc(nHref(ctx.pathname, ctx.search, value))}">n=${value}</a>`,
      )
      .join("");
    parts.push(`<p class="pm-chrome__row"><span class="pm-chrome__key">data volume</span>${cells}</p>`);
  }
  const fenced = controls.strategies?.filter((s) => s.fenced) ?? [];
  for (const f of fenced) {
    parts.push(
      `<p class="pm-chrome__row"><span class="pm-chrome__key">fenced</span><a class="pm-chrome__cell pm-chrome__cell--fenced" href="${esc(`${f.path}${f.query}`)}">${esc(f.label)}</a><span class="pm-chrome__note">measured with the same harness, excluded from every benchmark number</span></p>`,
    );
  }
  if (controls.nKnob) {
    parts.push(
      `<p class="pm-chrome__row"><span class="pm-chrome__key">last interaction</span><span data-pm-hud-interaction>—</span><span class="pm-chrome__note">per-interaction byte readout lands with the store's PLP build</span></p>`,
    );
    parts.push(
      `<p class="pm-chrome__row"><span class="pm-chrome__key">replay</span><span data-pm-hud-replay>—</span><span class="pm-chrome__note">the published sequence, runnable in-page, lands with the store's PLP build</span></p>`,
    );
  }
  if (ctx.surface === "checkout") {
    parts.push(
      `<p class="pm-chrome__note">Device and CPU are the lab profile's axis — pick a profile in the reading above. A live CPU knob would fake slowness at you; the profiles never do.</p>`,
    );
  }
  if (parts.length === 0) return "";
  return [
    `<section class="pm-chrome__section">`,
    `<h3 class="pm-chrome__h">Controls</h3>`,
    parts.join(""),
    `</section>`,
  ].join("");
}

/* ── The chrome ───────────────────────────────────────────────────────────── */

export function renderChrome(ctx: ChromeContext): string {
  const { environment, cacheState } = knobTags(ctx.search);
  // Lockstep guard: the Worker passes the bundle for the profile IT
  // resolved; honor it only when it matches the profile THIS renderer
  // resolves for the same query — otherwise one profile's numbers would
  // render under another profile's selected cell. The two resolutions share
  // one algorithm (getProfile ?? default); this guard turns any future
  // drift into visible em-dashes, never mislabeled data.
  const selectedProfile =
    getProfile(new URLSearchParams(ctx.search).get("profile") ?? "") ??
    PROFILES["avg-broadband-desktop"];
  const lab = ctx.lab && ctx.lab.profile === selectedProfile.id ? ctx.lab : undefined;
  // Object.hasOwn: the surface segment is client-controlled; a prototype key
  // ("constructor") would resolve to an inherited truthy value, skip the
  // fallback, and crash on .variants (verify-slice correctness lens).
  const controls: SurfaceControls =
    (Object.hasOwn(SURFACE_CONTROLS, ctx.surface)
      ? SURFACE_CONTROLS[ctx.surface]
      : undefined) ?? {
      variants: [],
      singleton: true,
      proves: "An unregistered surface — the measurement contract still applies; the switcher has nothing to offer here.",
    };

  const cells = switcherCells(ctx, controls);
  const switchRow = cells
    ? `<nav class="pm-chrome__switch" aria-label="Variant switcher" data-pm-switcher><span class="pm-chrome__key">${
        controls.strategies ? "strategy" : "variant"
      }</span>${cells}</nav>`
    : `<span class="pm-chrome__switch" data-pm-switcher><span class="pm-chrome__key">${esc(ctx.surface)}</span><span class="pm-chrome__cell pm-chrome__cell--current" aria-current="page">${esc(ctx.variant)}</span></span>`;

  return [
    `<aside id="pm-chrome" data-pm-chrome="1"`,
    ` data-pm-variant="${esc(ctx.variant)}" data-pm-surface="${esc(ctx.surface)}"`,
    ` data-pm-environment="${esc(environment)}" data-pm-cache-state="${esc(cacheState)}"`,
    ` data-pm-location="${esc(ctx.location)}" aria-label="Project Matrix instrument">`,
    `<div class="pm-chrome__bar">`,
    `<span class="pm-chrome__mark" aria-hidden="true">PM</span>`,
    switchRow,
    `<span class="pm-chrome__mini">${["LCP", "CLS"].map(liveVital).join("")}</span>`,
    `<details class="pm-chrome__instrument">`,
    `<summary class="pm-chrome__summary">Instrument<span class="pm-chrome__sr"> — lab readings and your visit</span></summary>`,
    `<div class="pm-chrome__panel" data-pm-hud>`,
    surfaceSection(controls),
    readingSection(ctx, controls, lab),
    fitSection(lab),
    visitSection(),
    conditionSection(ctx),
    controlsSection(ctx, controls),
    `</div>`,
    `</details>`,
    `</div>`,
    `</aside>`,
    `<script src="/_pm/measure.js" defer></script>`,
  ].join("");
}
