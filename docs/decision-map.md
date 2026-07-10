# Project Matrix — Decision Map

> Canonical planning artifact. **Loaded in full into every session.** Keep it compact — link details, don't inline them. Narrative, rationale, and provenance live in `build-log.md`.

## Notes

**Domain.** A live-benchmarking portfolio: one coherent commercial product — a **Discogs-powered vinyl store** — built across several rendering paradigms and instrumented to expose perf/UX/infra-cost tradeoffs. Evidence for **staff-level frontend applications**; later a conference talk (~end 2027) + a VentureBeat-tier article. This phase is **site-only**.

**Thesis (internal rubric — NOT on-page copy).** When anyone can generate working code, the differentiator is architectural judgment — proven by building one product several ways and exposing, in real numbers, what each choice costs in performance, UX, and infra spend. The point is **fit, not a leaderboard**: misapplication is costly, correct application is huge.

**Standing preferences (apply every session).**
- **Pure-evidence site** — no "AI age" manifesto copy; the demos convince.
- **Solo-first** — opened alone via a blog/application link; every surface self-explains (what am I looking at / what it proves / the tradeoff).
- **Sparse matrix** — each cell proves ONE distinct tradeoff; never a full variant×surface cross-product.
- **Variant axis = architectural _paradigm_**, one exemplar each — never framework-collecting.
- **Record the build process** as we go — this map, ADRs, handoffs, PRDs, design steps double as source content for the "How this was built" page. See `build-log.md`.
- Consult `/grilling` + `/domain-modeling` per ticket; `/to-prd` → `/to-issues` → `/implement` downstream.

**Locked axes.**
- *Render (variant switcher):* vanilla → heavy hydration (React/Next) → islands (Astro; **Svelte folded in as an Astro island framework**) → resumability (Qwik) → hypermedia (HTMX). Plus **Remix 3** as a fenced, pre-release **frontier** showcase (non-React server-HTML + "frames"; kept out of core benchmark numbers).
- *Data strategy (technique):* cold → **TanStack Query** (REST-native client cache; the lead — Apollo cut as wrong for Discogs REST, optionally retained as a "misapplication" exhibit) → server loaders + progressive enhancement → edge/KV cache.
- *Environment (flips the winner):* network throttle × data volume × cache warmth.

**Sparse matrix — the store surfaces.**

| Surface | Commercial form | Built in | Also varies | Spotlights |
|---|---|---|---|---|
| Home / gateway | landing: what / who / why + CTA | singleton (vanilla/static — TBD `deployment-topology`) | — | entry point; explains the site, gateway to the rest |
| Editorial (spine) | blog / staff-pick + CTA | all core variants + Remix 3 (frontier) | network, CPU | render baseline; hydration-overkill-for-prose |
| PDP (spine) | product detail, janky→fixed | vanilla, React/Next, Astro, Qwik (HTMX opt) | network | the flip: interactivity earns JS; CLS/LCP; Qwik shines |
| Catalog/PLP (spotlight) | search + faceted filters + sort | React/Next + HTMX | data strategy × cache warmth × network | data axis; edge TTFB 400ms→15ms |
| Checkout (spotlight) | checkout / account form | vanilla, React/Next, HTMX (Qwik opt) | CPU | INP under load |
| A11y section (spotlight) | store surfaces, compliant vs not | singleton (vanilla) | forced-colors, zoom, reduced-motion | ADA craft: DS-on vs DS-off; two-box A/B + mode-toggle demos |
| How it was built | store chrome, editorial | singleton | — | process evidence |

**The flip (thesis proof):** React/Next is the *villain* on Editorial and a *contender* on PDP — same variant, opposite verdict.
**Contextual switcher:** the live control adapts per surface — render-switcher on spine surfaces, data-strategy switcher on PLP, device/CPU controls on Checkout, a11y-mode toggles (forced-colors / zoom / reduced-motion) on the A11y section. HUD constant.

---

## Tickets

Frontier = the foundations below. Everything downstream (the per-surface builds) is deliberately **fog** until the foundations resolve. Each ticket is sized to one ~100K-token session. **Resolve ONE per session, then hand off.**

### thesis-and-curation: Thesis, framing & sparse matrix
Status: resolved
Type: Grilling
**Question:** What is the site's argument, who is it for, and what is the smallest matrix that proves it?
**Answer:** See Notes above and `build-log.md` Phase 0. Staff-level FE audience; pure-evidence, solo-first; one Discogs store, five surfaces; render × data × environment axes; sparse spine/spotlight matrix.

### measurement-methodology: How are metrics captured fairly across paradigms?
Blocked by: —
Status: resolved
Type: Grilling + Research
**Question:** How do we capture TTFB/FCP/LCP/CLS/INP, KB-transferred, and a compute-cost estimate *comparably and fairly* across a static-edge deploy vs Vercel-Edge SSR vs server-HTML/HTMX vs a non-React frontier build — so a skeptical staff engineer can't call the benchmark rigged? Includes the `sendBeacon`→observability (Datadog/New Relic) pipeline and the infra-cost model. This is the thesis's credibility root.
**Answer:** Resolved via `/grilling`, verified against primary sources (web.dev, W3C/MDN, vendor pricing). Rationale + trade-offs in [ADR-0001](adr/0001-benchmark-measurement-methodology.md); session narrative in `build-log.md` Phase 1. Nine decisions:
1. **Lab vs field split.** Lab (synthetic, throttled) is the *comparison engine* — reproducible head-to-head numbers carry the "not rigged" claim. Field/RUM is the *reality check* + the only honest INP source (Lighthouse can't measure INP, only a TBT proxy); field is never used to rank variants (can't control who visits).
2. **One ruler.** Google `web-vitals` lib, identical build injected into every variant, in both lab and field → same metric definitions everywhere. Bytes come from the browser's own network accounting.
3. **KB bucketed, not lumped.** HTML/JS/CSS/fonts/images/data, with **initial JS KB as the headline** (resumability/islands vs heavy-hydration story), plus a **per-interaction byte cost**.
4. **Fairness controls.** Three published test profiles (fast-wifi+laptop, avg-broadband+desktop, slow-4G+mid phone); cold vs warm as separate columns; median-of-N (~7–10) lab runs, p75 for field; **one variable changes at a time**.
5. **TTFB fairness.** Decompose into travel-time vs server think-time; warm as headline + cold-start as labeled callout; two locations (near/far) to show edge reach honestly; framed as a *trade*, not a race.
6. **KB fairness.** Identical compression (Brotli) + identical assets everywhere; strip our own instrumentation; count real compressed bytes-over-wire.
7. **Cost model.** Separate a measured **resource profile** (CPU-ms/bytes/requests per visit) from a dated, swappable **rate card**; report both an *architecture-only* number (same card for all) and a *real-world* number (each on its host); normalize to $/1M visits; show **actual (near-$0) charge + grounded extrapolation**; publish the arithmetic.
8. **Pipeline.** web-vitals → tagged beacon (variant/surface/env/cache/location) fired on tab-hidden → CF Worker collector → CF store (durable, ~$0) + Datadog mirror (observability breadth).
9. **Anti-rigging + execution.** Public harness; a receipt behind every number; one-command reproduce; plain-language methodology page + inline limits-of-data tooltip; pinned cloud runner + WebPageTest cross-check; dated snapshots (not live) tied to commit SHAs; all variants measured in one batch.

**Implementation is downstream** — building the harness (Playwright runner + web-vitals injection + collector Worker + cost calculator + methodology page) is a to-prd/implement job needing `design-system` (identical assets), `data-contract` (payload to render), and `deployment-topology` (variants hosted) first. No new decision node required; existing edges unchanged.

### data-contract: Discogs proxy, payload schema, caching, commerce layer
Blocked by: —
Status: resolved
Type: Grilling + Prototype
**Question:** Which Discogs endpoints; the normalized payload schema shared by all variants (zero-bias); the Cloudflare Worker reverse-proxy design; cold vs edge/KV caching; and how the commerce layer (cart / price / CTA) is handled — real Discogs marketplace data (auth?) vs simulated over catalog data?
**Answer:** Resolved via `/grilling` + `/domain-modeling`; API facts verified against `discogs.com/developers`. Rationale + trade-offs in [ADR-0002](adr/0002-data-contract-and-frozen-snapshot.md); prototype schema at [`prototypes/data-contract/`](prototypes/data-contract/); vocabulary in [CONTEXT.md](../CONTEXT.md); narrative in `build-log.md` Phase 1. Eight decisions:
1. **Provenance = frozen snapshot** is the canonical origin (real data captured once, frozen); makes numbers reproducible, kills rate-limit/uptime risk, collapses auth to capture-time only.
2. **Catalog (immutable, freezable) vs commerce (mutable, dynamic)** is the load-bearing split; freezing catalog is real-world-faithful, only the dynamic slice's request cost is hidden.
3. **Live-origin demonstration** — on-demand PDP action fetching live prices, fenced from all numbers (like Remix 3), presented as a demo **not a "mode"** (a "live" toggle would imply the default is fake); mandatory self-explaining copy.
4. **Commerce is thin** — real frozen price aggregate (`lowest_price`+`num_for_sale`, inline on the release); cart = client state; checkout = simulated (no payment/orders/PII); no per-seller listings table.
5. **Endpoints + scope** — PLP `GET /database/search` (filters), PDP `GET /releases/{id}?curr_abbr=USD` (price inline, one call), images downloaded + self-hosted (auth+rate-limited); heavy curated **crate** (~500 releases); data-volume knob = serve N (24 vs 240) from it.
6. **Zero-bias payload = two trays** normalized once at capture — `ReleaseSummary` (PLP) + `ReleaseDetail` (PDP); **data-not-UI** guardrail (typed primitives, no pre-render work); one Zod schema, validated at capture.
7. **Zero-bias = same data, not same access** — static variants bake the tray in at build; runtime variants fetch via the Worker; the access pattern is the measured variable, matching each paradigm's real production shape.
8. **Serving = R2 origin → Worker (thin read + beacon tagging + live path) → KV warm tier** (global ⇒ reproducible warm); cold = bypass to R2; cache state harness-driven; client-side caching deferred to `data-strategy-lab`.

**Propagated guardrail:** PDP keeps rich *product interactivity* (gallery/zoom, add-to-cart+cart state, quantity, format switch) despite thin commerce — the render-axis "interactivity earns JS" flip depends on it (→ `design-system`, PDP build).
**Standing principle reinforced:** findings must replicate in the real world — no lab artifacts.

### design-system: Shared token + component system replicable across variants
Blocked by: —
Status: resolved
Type: Grilling + Prototype
**Question:** The single CSS Custom Property token system + store component set (PLP grid, PDP, forms, CTAs) that renders visually identical across every variant (the zero-bias guarantee). Stakes are raised because a storefront is a big shared surface. How is it authored so multiple paradigms consume it without drift?
**Answer:** Resolved via `/grilling` + `/domain-modeling`. Rationale + rejected alternatives in [ADR-0003](adr/0003-design-system-and-zero-bias-presentation.md); prototype at [`prototypes/design-system/`](prototypes/design-system/) (two-tier `tokens.css` + 3 component modules + framework-free `reference/` render); vocabulary in [CONTEXT.md](../CONTEXT.md); narrative in `build-log.md` Phase 1. Eight decisions:
1. **Shared artifact = CSS + a canonical markup contract, no shared runtime.** Each paradigm re-implements the DOM (identical elements/nesting/`pm-` classes) + imports identical style rules ⇒ pixels identical *by construction*. Web Components rejected (would force a JS runtime into the no-JS variants). Kills "that variant is slow because its components were written differently." HiFi (React-only) can't be the shared layer.
2. **Presentation zero-bias = same styles, not same delivery** (mirrors data's "same data, not same access"). Declared rules + rendered DOM = control; CSS scoping/splitting/inlining/tree-shaking = the *measured variable* (the paradigm's payoff is part of the verdict). Guardrails: repackage-not-revalue; idiomatic-default-not-hand-tuned. CSS KB flips from noise to signal.
3. **Global token layer + per-component modules; two-tier tokens** (primitive → semantic), components consume semantic only — one auditable theming/forced-colors seam.
4. **Single canonical theme + first-class forced-colors** (semantic remap to CSS system colors; no meaning-by-color-alone; visible focus survives); dark mode deferred (cheap via the seam).
5. **A11y shipped as DS defaults** — focus-visible rings, WCAG target sizes, `rem`/reflow, reduced-motion, forced-colors, accessible forms + skip-link/landmarks. State off native attributes, not JS classes. Every a11y component ships a **matched compliant/stripped pair**; failure→repair = DS-off vs DS-on. Five headline guarantees span WCAG POUR.
6. **Drift proven, not promised** — a framework-free **reference render** is the golden master; CI checks each variant by normalized-DOM equivalence + pixel diff × 3 profiles.
7. **Aesthetic deferred + swappable** — architecture is aesthetic-agnostic (the look = values poured into the primitive tier later); prototype uses a labeled neutral placeholder.
8. **Fonts = controlled constant** (self-hosted, subset, identical everywhere; one sans + tabular figures for metrics).

**Propagated:** matrix reshaped (see Notes — Checkout/A11y splits; a11y becomes its own section; home/gateway surfaced); PDP interactivity is DS-appearance-shared / behavior-per-paradigm.
**Spun out:** `aesthetic-direction`, `a11y-section` (both unblocked), and a `home-surface` candidate (blocked by `deployment-topology`). Resolving this **unblocks `deployment-topology` and `remix3-frontier`**.

### deployment-topology: Monorepo, hosting, contextual switcher
Blocked by: design-system, data-contract
Status: resolved
Type: Grilling
**Question:** Monorepo layout; per-variant hosting (CF Pages static/SSR, Vercel Edge, etc.); and the contextual switcher that swaps architecture on the same route (render-switcher on spine surfaces, data-switcher on PLP). How do route/state sync across a variant swap?
**Answer:** Resolved via `/grilling` + `/domain-modeling`. Rationale + rejected alternatives in [ADR-0004](adr/0004-deployment-topology-and-contextual-switcher.md); vocabulary in [CONTEXT.md](../CONTEXT.md); narrative in `build-log.md` Phase 1. One move throughout: **hold each layer constant so it can't confound the paradigm, unless it genuinely _is_ a paradigm capability.** Seven decisions:
1. **Single canonical plane (Cloudflare); host held constant.** All variants on CF (Pages/Workers), co-located with the R2/KV data plane ⇒ host is a fairness control, not a variable (no cross-cloud data hop; a TTFB gap can only be the paradigm). Idiomatic CF adapter per paradigm, not hand-tuned. Optional native-host deploy (Next→Vercel) as a **fenced** "real-world host" exhibit, out of core numbers.
2. **One monorepo, pinned by one SHA** (ADR-0001 §9 "one batch"). pnpm workspaces + Turborepo; `variants/` · `packages/` (tokens, reference-as-spec, data-contract, switcher, measurement — **no component runtime**) · `workers/edge` · `tools/` · `docs/`. pnpm's strict node_modules = zero-bias asset. Deliberately **deviates from the org 3-repo GitOps standard** (justified: reproducibility-first portfolio, not a production service).
3. **Single origin, path-prefixed** `/{variant}/{surface}/...`, composed by a thin front routing Worker (service bindings + Workers Static Assets); `/api/*` → the ADR-0002 edge Worker. Wins over subdomains: identical transport stack for all (fairness control), cart survives via shared same-origin storage, trivial switcher mapping.
4. **The swap is a hard navigation — forced and honest.** No shared client runtime to soft-swap (ADR-0003 §1); a full document load is the honest cold/warm measure of the target paradigm.
5. **URL is the measurement condition.** Path = identity (variant/surface/id); query = env knobs, split into **live request modifiers** (`n`, `cache`) vs a **snapshot selector** (`profile`, §6); `localStorage` = **cart only**; transient UI micro-state resets on swap. ⇒ a URL is a complete, shareable, reproducible receipt (ADR-0001 §9).
6. **Throttle = snapshot selector, never a live fake.** `?profile=` picks which dated lab snapshot the HUD shows (page not re-throttled); HUD also shows the visitor's real RUM. Synthetic in-browser throttle = lab artifact, rejected for numbers (fenced "feel-it" demo only).
7. **Contextual switcher = per-surface, sparse, near-zero-JS, edge-injected chrome.** Front Worker injects switcher+HUD into a known slot in every variant (HTMLRewriter) ⇒ byte-identical by construction + cleanly stripped from measured KB (ADR-0001 §6). Anchor-link core works JS-off (doesn't bias no-JS variants — ADR-0003 §1 logic). Control-set is a function of surface; options sparse to the variants a surface is actually built in. Drift normalizer ignores the chrome slot.

**Spun out:** `cf-composition-spike` (Research + Prototype, unblocked) to verify the CF composition mechanism + per-paradigm adapters before the monorepo scaffold. **Unblocks `home-surface`** (now partially answered: singleton, served static on the canonical plane, no render-switcher). Monorepo scaffold + switcher build are downstream to-prd/implement jobs.

### cf-composition-spike: Verify the Cloudflare single-origin composition + adapters
Blocked by: deployment-topology
Status: resolved
Type: Research + Prototype
**Question:** Verify (against Cloudflare primary docs + a throwaway spike, not model recall) the single-origin composition mechanism ADR-0004 assumes: a front Worker dispatching by path prefix via **service bindings** + **Workers Static Assets**, and **HTMLRewriter** injecting the switcher/HUD chrome into a known slot. Confirm the per-paradigm CF adapters exist and behave idiomatically: Next (`@cloudflare/next-on-pages` / OpenNext), Qwik CF adapter, and a Remix 3 target (re-verify — pre-release). If any fails, flag the affected ADR-0004 decision for revision before the monorepo is scaffolded.
**Answer:** Resolved via runnable spike + primary-docs research (7 areas, every claim adversarially re-fetched: 73/73 confirmed). Evidence + citations in [`prototypes/cf-composition/FINDINGS.md`](prototypes/cf-composition/FINDINGS.md); spike runnable per its README; ADR-0004 addendum records the refinements. **Verdict: mechanism holds, no ADR-0004 decision reversed.** Five findings:
1. **All composition behaviors pass end-to-end locally** — prefix dispatch via service bindings, prefix-nested assets through a binding, HTMLRewriter injection into the slot (HTML only; non-HTML byte-identical), path/query/header fidelity, trailing-slash 307s, assets-first front, 404 on unknown prefix.
2. **Adapters verified current: "Workers everywhere," not Pages.** Next = OpenNext `@opennextjs/cloudflare` (next-on-pages deprecated, repo archived 2025-09); Qwik = official `cloudflare-workers` adapter (v1 stable, active); Astro = `@astrojs/cloudflare` v14 (Pages dropped), static builds adapter-free. All emit normal Workers ⇒ service-binding targets.
3. **Hardenings adopted:** every static variant ships the one-line `env.ASSETS.fetch(request)` forwarder script (binding→asset-layer without a script is undocumented — works locally, not relied on); switcher slot selector = documented `div#pm-chrome-slot` form; **monorepo dev = one `wrangler dev` per Worker** (multi-`-c` single-process mode is experimental + demonstrably broken: bare 500s on assets-through-bindings).
4. **Remix 3 = 3.0.0-beta.5, not production ready, NO official CF Workers target** (Node ≥24.3 template only; Workers = README claim + sub-package demos) → `remix3-frontier` question narrowed.
5. **Residual risk (accepted):** real-deploy behavior unverified until the monorepo's first deploy — that deploy re-runs the spike's `test.sh` against the deployed origin as a smoke test.

**Propagated:** foundations are now fully resolved — per the build-log judgment call, the `/to-prd` moment for the foundation build (monorepo scaffold + front Worker/switcher + edge Worker + measurement harness) has arrived.

### foundation-build: Monorepo scaffold, composed origin, edge Worker, measurement harness
Blocked by: cf-composition-spike
Status: in build — issues [#2–#8](https://github.com/Robert-Lark/project-matrix/issues); #2–#6 landed 2026-07-09, #7 landed 2026-07-10 (deploy leg gated on Cloudflare secrets — Rob task, see workers/README.md runbook); #8 (cost calculator) last
Type: to-prd → to-issues → implement
**Question:** Turn ADR-0001..0004 + the spike hardenings into the deployed, tested skeleton: monorepo scaffold + front Worker/switcher chrome + edge Worker data plane + measurement harness, with throwaway placeholder stand-in variants, tested outside-in at the composed origin (seam confirmed with Rob).
**Answer:** PRD published 2026-07-07 as [issue #1](https://github.com/Robert-Lark/project-matrix/issues/1); adversarially verified against the ADRs/FINDINGS/glossary before publishing (38-agent workflow: 25 confirmed defects fixed, 6 refuted). Notable scope decisions (all ADR-consistent, made under Rob's standing best-judgment authorization): reserved `/_pm/*` instrumentation path on the front Worker; fixture snapshot expanded to ≥240 synthesized releases so `?n=`/pagination are observable; interim open-license placeholder font (plumbing real now, face stays with `aesthetic-direction`); two-location runs deferred but receipts carry a location label from day one; front Worker serves a throwaway chrome-free index at `/` until `home-surface`. Sliced 2026-07-07 via `/to-issues` into 7 tracer-bullet issues, each verifiable outside-in at the composed origin: #2 scaffold + package lifts → #3 composed origin + deploy/smoke → #4 edge data plane → #5 chrome + measurement package → {#6 drift gate, #7 bench runner} → #8 cost calculator. Verified against the PRD/ADRs/FINDINGS/glossary before publishing, plus a post-publish seams audit (8 defects fixed across both passes; notable: drift gate #6 blocks on chrome #5 so the gate is proven against chrome-injected pages; receipt carries the ADR-0001 §7 resource profile in #7). **#2 (scaffold + package lifts) landed 2026-07-09** — pnpm+Turborepo monorepo, `@pm/data-contract`/`@pm/tokens`/`@pm/reference`/`@pm/measurement` lifted, isolation + no-runtime guards, CI; adversarially verified, 11 findings fixed (narrative: `build-log.md` Phase 2). **Next: #3 (composed origin), then #4–#8 in chain per Rob's continue-through instruction.**

### snapshot-capture: Capture + freeze the crate into R2
Blocked by: data-contract
Status: open
Type: Task
**Question:** Run the one-time capture: pick the crate (genre/era), pull ~500 releases via the verified endpoints respecting the 60/min rate-limit headers with backoff, download + self-host images, normalize to the two trays, Zod-validate against `prototypes/data-contract/schema.ts`, and land it in R2 with a dated `SnapshotManifest` (capture date + commit SHA). Image *derivative* sizing may need a follow-up once `design-system` fixes component dimensions.
**Answer:** _(open)_

### data-strategy-lab: The PLP data-strategy comparison
Blocked by: data-contract, measurement-methodology
Status: open
Type: Prototype + Grilling
**Question:** The PLP comparison of cold / TanStack Query / server-loaders+PE / edge-KV across cache-warmth and network columns. Exact scenarios and what each proves.
**Answer:** _(open)_

### remix3-frontier: Frontier showcase scope
Blocked by: design-system
Status: open
Type: Research + Prototype
**Question:** The minimum Remix 3 (beta) showcase that demonstrates the non-React server-HTML + frames paradigm, clearly labeled pre-release and fenced from core numbers. Re-verify Remix 3 status at build time (fast-moving). _Verified 2026-07-06 (`cf-composition-spike`): 3.0.0-beta.5 (npm `next` tag, "not production ready"); frames/server-HTML direction confirmed; **no official CF Workers deployment target** — official template is Node ≥24.3 `node:http`; Workers exist only as a README portability claim + `fetch-router`/`multipart-parser` demos. Must decide hosting: hand-rolled Workers entry (e.g. via `@remix-run/fetch-router`) vs a fenced off-plane Node host (acceptable — already fenced from core numbers)._
**Answer:** _(open)_

### aesthetic-direction: The visual look, poured into the primitive token tier
Blocked by: design-system
Status: open
Type: Prototype + Grilling
**Question:** The actual aesthetic — palette, typeface pairing, spacing rhythm, density, radii/shadow feel, and overall compositional voice — deliberately deferred from `design-system` (which is aesthetic-agnostic). Explore concrete directions (references/mood, `/prototype` + frontend-design skill), pick one, and pour it into the **primitive** token tier only; semantic tokens and components stay untouched (that swappability is the ADR-0003 payoff). Must clear WCAG contrast at token-definition time and survive the forced-colors remap.
**Answer:** _(open)_

### a11y-section: The dedicated ADA section (hybrid A/B + mode-toggle demos)
Blocked by: design-system
Status: open
Type: Grilling + Prototype
**Question:** The portfolio's ADA section, hosted in the **vanilla** variant (orthogonal to the render/data axes — it compares compliant-vs-not, not paradigm-vs-paradigm). Hybrid structure: **one two-box A/B page** for element-scoped defects (focus, forms, target size, contrast, live regions) + **mode-toggle demos** for global-state defects (forced-colors, reflow/zoom, reduced-motion), each with an honesty caveat that emulation ≠ the real OS mode. Decide: per-page vs consolidated layout, the guided-walkthrough copy per defect, and which store surface hosts each demo. Consumes the DS matched compliant/stripped pairs + the comparison-layout / walkthrough / mode-emulation primitives.
**Answer:** _(open)_

### home-surface: Landing / gateway page
Blocked by: design-system, deployment-topology
Status: open
Type: Grilling
**Question:** The entry point opened via a blog/application link — explains what the site is, who built it, and why, and acts as a gateway to the rest (scoped simple per Rob: chrome + prose + CTA, nothing complex). _Paradigm settled by [ADR-0004](adr/0004-deployment-topology-and-contextual-switcher.md): singleton, served static on the canonical plane, no render-switcher — off the benchmarked spine._ Remaining: the actual content/structure, the gateway model to the rest, and the self-explaining copy. Surfaced during `design-system` as a gap in the original five-surface matrix.
**Answer:** _(open)_

### (fog) per-surface builds
The Editorial / PDP / PLP / Checkout / meta builds become tickets once the foundations resolve. Left as fog per decision-mapping — push the frontier forward one node at a time.
