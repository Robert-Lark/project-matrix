# Item 6, branch protection on main, and Rob's call (2026-10-05)

Rob-gated; a settings change that leaves the machine and changes how he merges.
**Rob's answer, 2026-10-05: "No, or defer", the option as offered; recorded as
deferred, so it stays owed rather than closed.** Nothing was created. The evidence and the
exact call that would create it are recorded here for whoever picks this up.

## Verified 2026-10-05

- `gh api repos/Robert-Lark/project-matrix/branches/main/protection` answers
  `{"message":"Branch not protected", ... "status":"404"}`.
- `gh api repos/Robert-Lark/project-matrix/rulesets` answers `[]`.
- `gh repo view --json visibility,isPrivate` answers `PUBLIC`, `false`: rulesets are on
  the free plan for this repo.
- The two jobs a rule would require are named `check` and `origin`
  (`.github/workflows/ci.yml`, the `jobs:` keys); `deploy` needs both and runs only on
  `main`.

## The failure shape, twice

- PR #30 merged red on 2026-08-27: both CI runs failed the `check` job on the two
  react-next PDP identity sweeps timing out on the runner, the `deploy` job was
  skipped, and the plane kept serving the pre-merge `28d01fc` state for a day
  (`docs/build-log.md`, Phase 14, "The merge that did not deploy (2026-08-28)").
- Main run 36261255862 on `b894710` (PR #51's squash, 2026-09-26): `check` and
  `origin` green, every deploy step green, then the post-deploy smoke red on
  `suite/pdp-controls.browser.test.ts > qwik PDP: controls do what their markup says
  (JS on) > NO button on the page is inert` (`pm-gallery__thumb (#1)` changed
  nothing when pressed). Nobody watched it; the next push (`f0be557`, run
  36288512096) was green end to end. A ruleset on required checks would not have
  caught this one (the smoke runs after the merge, on `main`), which is worth saying
  before anyone expects it to. It is the third deployed smoke red on the qwik PDP
  controls leg (two earlier on the quantity stepper, this one on a gallery thumb),
  a flag Rob already carries.

## What a yes would run (not run)

One call, with admin bypass so a deliberate red costs a visible override instead of
being impossible; `strict` off so a PR need not be rebased onto main before merge
(solo repo, squash merges):

```
gh api -X POST repos/Robert-Lark/project-matrix/rulesets --input - <<'JSON'
{
  "name": "main: check and origin green before merge",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [{
    "type": "required_status_checks",
    "parameters": {
      "strict_required_status_checks_policy": false,
      "do_not_enforce_on_create": false,
      "required_status_checks": [{ "context": "check" }, { "context": "origin" }]
    }
  }]
}
JSON
```

Field names and the `~DEFAULT_BRANCH` token are from the REST reference "Create a
repository ruleset" (docs.github.com, fetched 2026-10-05). `actor_id` 5 is the
repository-admin role id as commonly documented; verify it against the rulesets UI or
the role listing before running, since the page fetched does not enumerate role ids.
What it gives up: direct pushes to `main` need passing checks on the pushed commit, so
in practice `main` moves only through pull requests; a deliberate red merge needs the
override click.
