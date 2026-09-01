# Build /how-it-was-built/ — the spec is merged, the 404 is site-wide

**Priority 6 of the 2026-08-29 audit (tied with the a11y build — these two kill the footer
404s).** The PRD merged as #37 (`docs/prds/how-it-was-built-build.md`, 557 lines) and is the
contract — this prompt adds only what the audit verified about the current tree. The
executing session reads the PRD first and follows it; where this prompt and the PRD disagree,
re-verify at source and prefer whichever the code supports.

---

## Why now

Every store page in all six variants footers "How it was built" →
`/how-it-was-built/` (`packages/reference/render/shell.mjs:42,:163`), and nothing serves it:
`grep -rn how-it-was-built workers/front/build.mjs` → 0; `workers/front/dist/` holds only
`_pm`, `methodology`, `pm`. That is ~2,006 served pages linking a 404
(`decision-map.md:241,:426`) on the surface whose subject is the project's proudest claim.
For a portfolio whose product is the build record, this is the most visitor-visible gap on
main.

## The PRD's five decisions (hold to them)

Index-not-copy content model with SHA-pinned deep links; `/methodology/` KEPT at its URL and
indexed; assets-first, chrome-free, no HUD; the drift tie fixed structurally (`@pm/front`
renders the surface with the same function that renders the master — no second renderer);
limits stated as content (what the page deliberately does not index).

## Audit additions and confirmations

1. **The two stale-prose duties are still live and are this session's** (PRD + map `:430`):
   - `workers/front/methodology/index.html:17-18` promises its "long-term home" is this
     surface — the spec decided otherwise; fix the comment.
   - `packages/tokens/css/surfaces/how-built.css:5` claims generation "from decision-map
     rows" — never true, stays untrue; fix the comment (tokens/ was outside the spec unit's
     boundary, which is why it survived).
2. **The turbo duty is load-bearing:** `@pm/front#build` must declare the same `docs/`
   inputs `@pm/reference#test` declares (`turbo.json` — PRD cites `:231-243` vs `:37-52`),
   or a docs change replays a cached dist and the deploy ships it stale.
3. **The ADR-index sabotage the spec proved absent** (a valid tenth ADR passing 37/37) is a
   duty, not a nice-to-have — the phase-pin half already bites, the ADR half does not.
4. **The origin probe is owed:** the spec session could not run a server (ports held);
   every serving claim in the PRD is read-from-source. The executing session owes the
   before/after probe: `/how-it-was-built/` 404 → 200, chrome-free, no HUD, all on-disk
   links resolving.
5. The footer's OTHER 404 (`/vanilla/a11y/`) is NOT this unit's — it belongs to
   `a11y-section-build-prompt.md`. Do not retarget or excuse it here.

## Done means

The PRD's done paragraph, verified against the deployed origin — plus: zero footer links to
this surface 404 anywhere in either snapshot mode, the two stale comments fixed, and the
nine duties' sabotages each watched failing and restored from a backup copy (the house
rule).
