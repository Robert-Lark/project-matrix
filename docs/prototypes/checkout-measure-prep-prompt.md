# Make checkout visible to the instrument — before its first batch

**Priority 7 of the 2026-08-29 audit.** Checkout merged (#36) and serves, but it is invisible
to the measurement apparatus: no origin-suite leg of any kind, no interaction ids, and the
recorded pre-batch leftovers all still stand. The map records every item below
(`decision-map.md:456-458`); the audit verified each is still true on main 2026-08-29.
Re-open every citation before editing.

---

## Task 1 — the origin-suite checkout leg

`tools/origin-suite/suite/cart.browser.test.ts:100-101` parameterises the cart suite over
EDITORIAL pages only; the lone "checkout" in the whole suite is a masters-health listing
(`drift.browser.test.ts:521`). A checkout cart that diverges from editorial's is exactly as
invisible as the dead PDP controls were. Extend the cart suite over the checkout surface
(the in-variant linkedom guard exists — `variants/vanilla/test/` — but nothing proves the
JS-ON half through a real browser at the composed origin: the summary populating, the
shipping radio moving the total, the error summary taking focus).

## Task 2 — the three interaction ids

ADR-0008 names `checkout-type-card`, `checkout-submit-invalid`, `checkout-fix-and-submit`;
`grep -c "checkout-" tools/bench-runner/src/collect.ts` → 0 today. Register them (the file's
existing five entries are the pattern). This is the surface whose spotlight is INP under
load — without the ids there is nothing to batch.

## Task 3 — the phone-profile CLS, fixed BEFORE the first batch

`checkout.css:40-43` orders `.pm-cart` above the form at ≤52em and `cart-summary.css:37`'s
`min-block-size: 12rem` is a floor, not a height — late catalogue population
(`checkout.js:190`) grows the summary and shifts the form, contradicting
`checkout.js:97-98`'s own zero-CLS comment. It moves no published number today (the measured
state is the empty cart), which is precisely why now is the cheap moment: nothing to
invalidate.

## Task 4 — the JS-off submit dead end

A JS-off "Place order" ends on a zero-length 405 (`workers/front/src/index.js:101` → ASSETS).
Nothing personal leaves — the measured POST body is `shipping=standard` and nothing else —
but the dead end is a served UX falsehood on the no-JS path the variant exists to prove.
The honest fix the map already names: a JS-off success page, not more copy.

## Task 5 — the drift-risk dedup guards (lines, not sessions)

- **Cart trio:** `read`/`count`/`renderCount` are byte-identical in `checkout.js:32,54,55`,
  `cart.js:13,35,36`, `pdp.js:17,39,40`, and nothing asserts they stay identical. The owed
  ~20-line repo-check: extract the trio, compare after comment stripping — `codeOnly()`
  already exists at `tools/repo-checks/test/pdp-controls-wired.test.ts:284`.
- **Guard dedup:** `pdp-controls-wired.test.ts` still carries the near-verbatim checkout
  copy of its PDP block; parameterise over a `{surface, masters, enhancements}` table
  (~40 lines saved, and future rule changes land once).

## Task 6 — the coupled tokens rule

`pm-checkout__form` exists only as a docblock comment (`checkout.css:14`) with its OWED
entry in `master-styles-resolve.test.ts:61-63`. Rule + retirement land together (the
registry's self-expiry legs enforce the pairing). If the PLP data-plane unit has not landed
its pair yet, take all three in one integration commit — the map's "three units, one
registry, one file".

## Done means

Cart behaviour proven at the composed origin on checkout in both snapshot modes; three
interaction ids registered and drivable; CLS probe on the phone profile reads 0.00 with a
populated cart; JS-off submit lands on a real page; the trio guard bites (sabotage one copy,
watch it fail, restore from a backup copy); OWED registry retired for `pm-checkout__form`.
No batch is minted here — that stays with the measurement pass, after this lands.
