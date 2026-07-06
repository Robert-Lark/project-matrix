# Project Matrix — Build Log

Running record of how this project is built *with AI* — source material for the "How this was built" page. **Append as we go; don't rewrite history.**

## Phase 0 — Prep / curation

**Origin.** A portfolio that proves depth in an age of democratized coding, feeding a conference talk (~end 2027) + a VentureBeat-tier article + staff-level job applications.

**Prompt → PRD.** Prompted **Gemini Pro** with the raw vision (one product built in many stacks — React / Qwik / vanilla / Svelte / Astro / HTMX / Next — on the Discogs API, with perf meters, CWV failure→repair, forced-colors, and a simple→complex content range). Gemini produced "PRD: The Hyper-Performance Architectural Portfolio" (PDF in `~/Downloads`). Refined to be **site-only** (talk/article deferred).

**PRD critique (Claude).** Treated the Gemini PRD as a *loose idea*, not a spec. Caught two drifts from the original vision: it dropped the simple→complex content *range* (all pages heavy), and hardened "maybe 4 variants" into exactly 4, bundling ~7 named stacks into 4 buckets.

**Grilling (Claude, `/grilling` method — one node at a time).**
1. **Thesis** = architectural judgment as differentiator; *fit, not leaderboard*. Kept as an internal rubric, not on-page copy → **pure-evidence** site.
2. **Consumption** = solo-first (blog / application link, no walkthrough).
3. **Variant axis** = architectural *paradigm*, one exemplar each — not framework-collecting.
4. **Data lib** = TanStack Query (REST-native) replaces Apollo (wrong for Discogs REST). Verified **Remix 3** (non-React, server-HTML, pre-release) and **TanStack** (Query = data axis; Start = conventional React SSR) via a Claude web-research sub-agent against primary sources.
5. **Remix 3** = fenced **frontier** showcase, labeled pre-release.
6. **Pages** reframed from "labs" to one coherent **Discogs vinyl store** with employer-relatable surfaces (editorial, PLP, PDP, checkout) + a meta page.
7. **Sparse matrix** = spine (render axis) + spotlight (data / low-level) surfaces; the villain→contender flip proves the thesis.

**Crystallized** into `decision-map.md`, with the foundations (measurement, data contract, design system, deployment) as the first tickets.

**Skills / tools used so far:** Gemini Pro (PRD draft) · Claude `/grilling` · a Claude web-research sub-agent · Matt Pocock skill suite planned downstream (`/decision-mapping`, `/grill-with-docs`, `/handoff`, `/to-prd`, `/to-issues`, `/implement`) · Claude for UI design.

**Artifacts:** `decision-map.md` (canonical) · this log · the Gemini PRD (`~/Downloads` — archive into `docs/` later).

**Published — building in public.** Crystallized planning pushed to a public repo: `https://github.com/Robert-Lark/project-matrix` (branch `main`, committed with a GitHub noreply address to keep the work email out of public history). The repo history now *is* part of the process record; each future session commits + pushes at handoff.

## Phase 1 — Foundations

### `measurement-methodology` — resolved (2026-07-06)

The credibility-root ticket: how to measure TTFB/FCP/LCP/CLS/INP, KB-transferred,
and infra-cost *comparably and fairly* across paradigms as different as static-edge,
Vercel-Edge SSR, server-HTML/HTMX, and the Remix 3 frontier — so a skeptical staff
engineer can't call it rigged.

**Method.** `/decision-mapping` → `/grilling` + `/domain-modeling`, one question at a
time, nine nodes resolved in dependency order. Metric facts were verified against
**primary sources** (not model recall) via two Claude research sub-agents:
web.dev/developer.chrome.com, W3C/MDN specs, the `GoogleChrome/web-vitals` README,
and the Cloudflare/Vercel/Datadog pricing pages. Key verified facts that shaped the
design: INP replaced FID as a stable CWV on 2024-03-12 and Lighthouse can't measure
it (uses TBT as a non-substitute proxy); CWV are assessed at p75; web-vitals'
recommended reporting is `sendBeacon` on `visibilitychange`→hidden; Cloudflare Pages
static serving is free/unlimited while Workers bill $0.30/1M req + $0.02/1M CPU-ms
and Vercel bills a blended Fluid-compute rate + egress.

**The nine decisions (full rationale + trade-offs in [ADR-0001](adr/0001-benchmark-measurement-methodology.md)):**
lab = the fair comparison engine / field = the reality check + honest INP source;
one Google `web-vitals` ruler injected identically everywhere; KB **bucketed** with
**initial JS as the headline** (a lump total would hide the resumability win) + a
per-interaction byte cost; three published test profiles, cold vs warm separate,
median-of-N / p75, **one variable at a time**; TTFB **decomposed** into travel vs
server-think-time with warm-headline/cold-callout, two locations, framed as a trade
not a race; KB fairness via identical compression + identical assets + stripped
instrumentation; cost model = measured **resource profile × swappable rate card**,
reported architecture-only *and* real-world, actual-charge (≈$0) + grounded
extrapolation, arithmetic published; RUM pipeline web-vitals → tagged beacon →
neutral CF Worker collector → CF Analytics Engine (durable, ~$0) + optional Datadog
mirror; and the anti-rigging wrapper — public harness, a receipt behind every number,
one-command reproduce, a methodology page + inline limits-of-data tooltip, pinned
cloud runner + WebPageTest cross-check, dated snapshots (not live).

**Design principle surfaced (Rob).** Show breadth, but cohesively without
overwhelming — favour more comparisons (3 profiles, 2 locations, both cost views,
two observability sinks) presented in a digestible way, because the range itself
communicates the depth of knowledge. And name the limits of the data in-product (the
tooltip) — pre-empting the skeptic *is* the staff-level signal.

**Skills / tools used:** `/decision-mapping` · `/grilling` · `/domain-modeling` ·
two Claude web-research sub-agents (primary-source verification).

**Artifacts:** [ADR-0001](adr/0001-benchmark-measurement-methodology.md) (new
`docs/adr/`) · ticket answer in `decision-map.md` · this entry.

**Downstream:** building the harness is a to-prd/implement job blocked by
`design-system`, `data-contract`, and `deployment-topology`. No new decision node was
needed — all its dependencies are existing tickets.
