/**
 * The chrome renderer (ADR-0004 §5–§7): the switcher + HUD markup the front
 * Worker injects into `div#pm-chrome-slot` of every HTML response.
 *
 * Design constraints, all load-bearing:
 *  - The switcher core is PLAIN ANCHORS that rewrite only the {variant} path
 *    segment, preserving surface/entity/query — a swap is a hard navigation
 *    onto the same measurement condition (ADR-0004 §4–§5). Works JS-off.
 *  - `?profile=` is a SNAPSHOT SELECTOR (ADR-0004 §6): it marks which
 *    published lab snapshot the HUD displays — it never re-throttles the
 *    page. No published runs exist yet, so the HUD shows an explicit empty
 *    state; the visitor's own live web-vitals populate via /_pm/measure.js
 *    (the only JS, an enhancement — HUD text works without it).
 *  - Styling comes from /_pm/chrome.css consuming the page's SEMANTIC tokens
 *    (every variant loads the shared tokens by contract), so HUD metrics get
 *    the tabular-figures treatment without chrome shipping fonts.
 *  - Every interpolated value is HTML-escaped: pathname and query are
 *    client-controlled and flow into markup.
 */
import { PROFILE_IDS, PROFILES, getProfile, knobTags } from "@pm/measurement";
import { SURFACE_CONTROLS } from "./config";

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

export function renderChrome(ctx: ChromeContext): string {
  const { environment, cacheState } = knobTags(ctx.search);
  const controls = SURFACE_CONTROLS[ctx.surface];
  const params = new URLSearchParams(ctx.search);
  const selectedProfile = getProfile(params.get("profile") ?? "");

  const switcherCells = (controls?.variants ?? [])
    .map((v) =>
      v === ctx.variant
        ? `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="true">${esc(v)}</span>`
        : `<a class="pm-chrome__cell" href="${esc(swapHref(ctx.pathname, ctx.search, v))}">${esc(v)}</a>`,
    )
    .join("");

  const profileCells = PROFILE_IDS.map((id) => {
    const selected = selectedProfile?.id === id;
    const label = esc(PROFILES[id].label);
    return selected
      ? `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="true">${label}</span>`
      : `<a class="pm-chrome__cell" href="${esc(profileHref(ctx.pathname, ctx.search, id))}">${label}</a>`;
  }).join("");

  // Lab snapshot panel: no published runs exist in this build (ADR-0001 §9 —
  // numbers ship as dated snapshots; none are published yet).
  const labPanel = `<p class="pm-chrome__empty" data-pm-hud-lab>No published runs yet — lab snapshots land with the first benchmark publication.</p>`;

  const liveSlots = ["TTFB", "FCP", "LCP", "CLS", "INP"]
    .map(
      (m) =>
        `<span class="pm-chrome__metric"><span class="pm-chrome__metric-name">${m}</span> <span class="pm-chrome__metric-value" data-pm-hud-live="${m}">–</span></span>`,
    )
    .join("");

  return [
    `<link rel="stylesheet" href="/_pm/chrome.css">`,
    `<nav id="pm-chrome" data-pm-chrome="1"`,
    ` data-pm-variant="${esc(ctx.variant)}" data-pm-surface="${esc(ctx.surface)}"`,
    ` data-pm-environment="${esc(environment)}" data-pm-cache-state="${esc(cacheState)}"`,
    ` data-pm-location="${esc(ctx.location)}" aria-label="Project Matrix instrumentation">`,
    `<div class="pm-chrome__row" data-pm-switcher>`,
    switcherCells
      ? `<span class="pm-chrome__label">variant</span>${switcherCells}`
      : `<span class="pm-chrome__label">singleton surface</span>`,
    `</div>`,
    `<div class="pm-chrome__row" data-pm-hud>`,
    `<span class="pm-chrome__label">profile</span>${profileCells}`,
    labPanel,
    `<span class="pm-chrome__label">your visit</span>${liveSlots}`,
    `</div>`,
    `</nav>`,
    `<script src="/_pm/measure.js" defer></script>`,
  ].join("");
}
