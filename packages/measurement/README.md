# @pm/measurement

The shared measurement layer ([ADR-0001](../../docs/adr/0001-benchmark-measurement-methodology.md)).

**This slice ships the versioned profile spec only** (`src/profiles.ts`): the
one definition of the three published test profiles (ADR-0001 §4) — profile id
→ network throttle, CPU multiplier, viewport/DPR — consumed by:

- the HUD's `?profile=` snapshot-selector ids (ADR-0004 §6)
- the bench runner's throttles (issue #7)
- the drift gate's pixel-diff viewports (issue #6)
- the receipt's `profile` field (ADR-0001 §9)

One spec, no second copy to drift. Values are pinned exactly by tests; any
change bumps `PROFILE_SPEC_VERSION` (receipts cite the version they ran under).
The mobile/desktop profiles pin Lighthouse's published defaults; the fast-wifi
profile is project-defined (no widely-published preset exists) — provenance is
carried on each profile object.

The pinned web-vitals build + `sendBeacon` wiring (ADR-0001 §2, §8) land with
the chrome slice (issue #5), delivered from the front Worker's `/_pm/*`
instrumentation path so the bytes stay strippable (ADR-0001 §6).

Dependency-free by design: the HUD ships this spec to the browser.
