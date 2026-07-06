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

**Sparse matrix — the five store surfaces.**

| Surface | Commercial form | Built in | Also varies | Spotlights |
|---|---|---|---|---|
| Editorial (spine) | blog / staff-pick + CTA | all core variants + Remix 3 (frontier) | network, CPU | render baseline; hydration-overkill-for-prose |
| PDP (spine) | product detail, janky→fixed | vanilla, React/Next, Astro, Qwik (HTMX opt) | network | the flip: interactivity earns JS; CLS/LCP; Qwik shines |
| Catalog/PLP (spotlight) | search + faceted filters + sort | React/Next + HTMX | data strategy × cache warmth × network | data axis; edge TTFB 400ms→15ms |
| Checkout/A11y (spotlight) | checkout / account form | vanilla, React/Next, HTMX (Qwik opt) | forced-colors + CPU | INP under load; a11y failure→repair |
| How it was built | store chrome, editorial | singleton | — | process evidence |

**The flip (thesis proof):** React/Next is the *villain* on Editorial and a *contender* on PDP — same variant, opposite verdict.
**Contextual switcher:** the live control adapts per surface — render-switcher on spine surfaces, data-strategy switcher on PLP, device/CPU + forced-colors controls on Checkout. HUD constant.

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
Status: open
Type: Grilling + Research
**Question:** How do we capture TTFB/FCP/LCP/CLS/INP, KB-transferred, and a compute-cost estimate *comparably and fairly* across a static-edge deploy vs Vercel-Edge SSR vs server-HTML/HTMX vs a non-React frontier build — so a skeptical staff engineer can't call the benchmark rigged? Includes the `sendBeacon`→observability (Datadog/New Relic) pipeline and the infra-cost model. This is the thesis's credibility root.
**Answer:** _(open)_

### data-contract: Discogs proxy, payload schema, caching, commerce layer
Blocked by: —
Status: open
Type: Grilling + Prototype
**Question:** Which Discogs endpoints; the normalized payload schema shared by all variants (zero-bias); the Cloudflare Worker reverse-proxy design; cold vs edge/KV caching; and how the commerce layer (cart / price / CTA) is handled — real Discogs marketplace data (auth?) vs simulated over catalog data?
**Answer:** _(open)_

### design-system: Shared token + component system replicable across variants
Blocked by: —
Status: open
Type: Grilling + Prototype
**Question:** The single CSS Custom Property token system + store component set (PLP grid, PDP, forms, CTAs) that renders visually identical across every variant (the zero-bias guarantee). Stakes are raised because a storefront is a big shared surface. How is it authored so multiple paradigms consume it without drift?
**Answer:** _(open)_

### deployment-topology: Monorepo, hosting, contextual switcher
Blocked by: design-system, data-contract
Status: open
Type: Grilling
**Question:** Monorepo layout; per-variant hosting (CF Pages static/SSR, Vercel Edge, etc.); and the contextual switcher that swaps architecture on the same route (render-switcher on spine surfaces, data-switcher on PLP). How do route/state sync across a variant swap?
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
**Question:** The minimum Remix 3 (alpha) showcase that demonstrates the non-React server-HTML + frames paradigm, clearly labeled pre-release and fenced from core numbers. Re-verify Remix 3 status at build time (fast-moving).
**Answer:** _(open)_

### (fog) per-surface builds
The Editorial / PDP / PLP / Checkout / meta builds become tickets once the foundations resolve. Left as fog per decision-mapping — push the frontier forward one node at a time.
