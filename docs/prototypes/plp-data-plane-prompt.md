# Land the PLP data plane — ADR-0005 §5's five params, and the KV ceiling

**Priority 3 of the 2026-08-29 audit — the map's own "largest owed item"
(`docs/decision-map.md:486`, `:544`).** The PLP's commercial form is "search + faceted
filters + sort"; the served pages have none of it — the rail, search form and sort select
were cut (correctly, rather than shipped inert) because the edge Worker never learned the
params. Until this lands the surface's title promises a page that does not exist.

Every file:line verified 2026-08-29. Re-open each before editing.

---

## Step 0 — the `?page=` ceiling does NOT wait for the rest

`workers/edge/src/index.js:125` floors `page` at 1 with **no upper bound**; `:127` folds the
raw value into the KV key; `:84` writes un-nonced entries with **no TTL** (deliberate — the
comment at `:79-82`). So a curl loop mints one immortal KV key per distinct integer —
attacker pays nothing, the project pays writes + storage forever, on the project whose thesis
prices infra. (Verifier correction worth keeping: `?page=1e15` does NOT mint —
`parseInt` stops at `1`; every plain digit string does.) Clamp `page` to
`ceil(total/n)` — or refuse to write-through past the last real page — as its own small
commit even if the rest of this unit waits.

## Step 1 — settle the two ADR-0005 open questions FIRST (they are why this is a unit)

1. Does a filtered response recount its facets over the filtered set, or keep whole-crate
   counts? (Facet counting today: `workers/edge/src/index.js:101-119`.)
2. Does `PlpPage` grow a field naming the applied filters?
   (`packages/data-contract/src/schema.ts:89-100`.)

Record both as an ADR-0005 addendum before writing code.

## Step 2 — the KV key-cardinality policy

Five new params fold into an infinite-TTL key space. Decide and record: which param
combinations are cacheable, what the key looks like, and what the cost ceiling is —
denominate it (KV writes ~$5/M, storage ~$0.50/GB-mo). Validate facet values against the
real facet sets and 400 junk (`ADR-0005 §5`: "no junk KV keys").

## Step 3 — wire the params, restore the UI

- `workers/edge/src/index.js` `handlePlp` reads `genre/style/format/sort/q` (today it reads
  only `n`, `page`, `run`, `cache` — `:124-127`).
- The markup skeleton is preserved in the `plp.mjs`, `toolbar.css` and `plp.css` docblocks;
  the react-next legs are `it.skip`ped, not deleted
  (`variants/react-next/test/master-identity.test.ts:509`); both arms carry the
  `plp-params-not-yet-honoured` tripwire that FAILS the moment a param is wired without the
  UI restored (`variants/htmx/test/master-identity.test.js:1067-1090`) — the tripwires are
  your task list.
- Restore rail/search/sort in the reference master first, then both arms mirror it —
  the #38-before-#39 ordering rule (`decision-map.md:243`).
- `tools/repo-checks/test/plp-arms-agree.test.ts` must cover the restored controls.

## Step 4 — the two one-line instrument gaps from the PLP handoff

Both recorded in `docs/handoffs/2026-08-28-plp-htmx.md`; both still open:

1. **Warm-tier guard blindness:** `tools/repo-checks/test/warm-tier-discipline.test.ts:33`
   finds tray requests only by the literal `/api/(plp|pdp)` — a PAGE path that proxies the
   tray server-side (`/htmx/plp/`, and every request-time page) is invisible. Widen it before
   the PLP drift leg is written (its natural first line is `get("/htmx/plp/")`). Note: the
   audit's "nothing flushes the warm tier at re-seed" scare was REFUTED — the flush runbook
   exists at `workers/README.md:161-186`; the guard widening is the real half.
2. **Front Worker partial pass-through:** the `x-pm-partial: 1` header the htmx partials
   declare is inert until the one variant-agnostic line lands in `workers/front/src/index.js`
   (the file's own comment at `:126-128` predicted this build). Without it every page-flip
   logs a chrome-slot ERROR against a correct Worker.

## Step 5 — the coupled CSS/OWED retirement

`packages/tokens/css/surfaces/plp.css:8,:13` carry `pm-plp__head`/`pm-plp__results` as
comments only, paired with their `OWED` registry entries in
`tools/repo-checks/test/master-styles-resolve.test.ts:61-63`. The rules and the retirements
must land in the same branch or the self-expiry legs fail — the map's "three units, one
registry, one file" note (`decision-map.md:458`).

## Done means

A facet click, a search and a sort each return a genuinely filtered grid on both arms; junk
params 400 without minting keys; `?page=` past the end cannot mint a key; tripwires retired;
un-skipped legs green; arms-agree leg covers the restored controls; no PLP number publishes
(batches stay with the measurement pass, after the route-level fence lands).
