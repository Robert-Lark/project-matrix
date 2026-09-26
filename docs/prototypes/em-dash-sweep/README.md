# The em-dash sweep (2026-09-26)

Every em dash in the site's copy and in the docs the site links to on GitHub was
replaced, because readers who take the glyph as the mark of a machine stop
reading. The sweep ran over the whole tracked tree so that one invariant holds
and one guard (`tools/repo-checks/test/no-em-dashes.test.ts`) can keep it.

## Numbers (from git, not typed)

| what | count |
|---|---|
| em dashes in tracked files at `b894710` | 14,871 |
| left after the sweep, all in exempt files | 2,960 |
| files changed | 597 |
| markdown headings reworded (colon for the first dash) | 321 |

Derive them: `git grep -o` for U+2014 at `<sha>`, piped to `wc -l`, before and after; `git status
--short | wc -l`; `git diff -U0 -- '*.md' | grep -cE '^\+#{1,6} '`.

## What stayed, and why

- `tools/snapshot-capture/crate/`: Discogs' own release text, hashed by the
  manifest (ADR-0002). Not ours to edit.
- `workers/front/lab/receipts/*.json`: the three minted editorial receipts.
  Their `methodNotes` and `cpuMs.source` strings carry the glyph; nothing
  renders those fields, and a minted receipt is not edited after the fact.
  Re-minting is the measurement pass's call.
- `packages/reference/test/fixtures/github-heading-anchors.json` and
  `packages/reference/test/reference.test.ts`: evidence of how GitHub slugs an
  em-dash heading, which the how-it-was-built renderer must still get right.
- The lockfile and binaries (three PNG boards contain the byte sequence by
  chance; the guard skips anything that is not valid UTF-8).

## The rules (`strip.mjs`), in the order they run per line

Markdown:

1. A table cell that is only a dash becomes an en dash (`–`), the placeholder
   glyph the instrument's table uses too.
2. A heading's first ` <em dash> ` becomes `: `; any later one a comma.
3. A decision-map `Status: **verdict** <em dash> narrative` line becomes
   `**verdict**. Narrative` (the cap guard splits the verdict at `. `).
4. A label bullet (`- **Label** <em dash> text`, `` - `file` <em dash> text ``) gets a colon.
5. A wrapped line that starts with `<em dash> ` is joined to the line above, which
   gets a comma if it had no punctuation.
6. A line that ends with ` <em dash>` ends with a comma.
7. Prose: two dashes in one sentence (an aside) become commas; a lone dash
   becomes a comma, or a full stop plus a capital when the next word is a
   sentence lead (`it`, `this`, `there`, `nothing`, ...).

Code, CSS, JSON, HTML, YAML: the placeholder glyph in a string or a cell
becomes an en dash; banner strings `"<em dash> X <em dash>"` become `"-- X --"`; then rule 7.

The line count of every file is asserted unchanged (the build log is deep-linked
by line number).

After the per-line pass, every `path.md#slug` and same-file `#slug` reference
whose heading moved is rewritten from the renderer's own `githubAnchors` rule.

## The hand passes

- `copy-fixes.py`: 70 exact-string fixes over the rendered copy (page titles use
  ` · `, list introductions use a colon, a few clause breaks use a full stop),
  applied across the reference renderer and every variant so the master
  identity guards stay green. Every pair is asserted to hit at least once.
- `quote-sync.mjs`: a decision-map status that quotes a build-log heading must
  quote it exactly; the heading rule (colon) and the prose rule (comma) had
  diverged in 26 quotes.
- Twelve lines that quoted the glyph as code (the sr-only bug record in
  ADR-0008 and the build log) were reworded by hand to say "em dash".
- Three live parsers keyed on the dash were moved to the colon: the phase list
  in `packages/reference/render/how-built.mjs`, and the heading-prefix and
  moved-narrative pointer regexes in
  `tools/repo-checks/test/decision-map-node-cap.test.ts`.

## Verification

`pnpm run check`: 40 successful, 40 total (three runs; the first two each
found one pinned test string that had to move with the copy).

Origin suite, alone, after the build-log entry and the regenerated masters:

| run | mode | result | note |
|---|---|---|---|
| 1 | fixture | 669/670, 149.2 s | `bench.browser` INP null on a placeholder page (issue #16's load class) |
| 2 | fixture | 669/670, 149.5 s | same leg, same null |
| 3 | crate | plane died (ECONNREFUSED 8787, 67 timeouts) | wrangler 4.110 under load; no crash banner in `.dev-logs/front.log` |
| 4 | fixture, held plane | `bench.browser` alone: 21/21, then 21/21 | the leg passes in isolation |
| 5 | crate | 670/670, 147.6 s | |

The two fixture nulls are the known class: the leg measures the two placeholder
sample pages, whose diff here is title, alt text and comments only (nothing that
can move an event-timing entry), a VM held ~30 % CPU throughout, and the leg
passed twice in a row on a held plane. Recorded as observed; not re-run to green.

The identity guards are the proof that reference copy and variant copy moved
together: `variant-master-identity`, each variant's `master-identity`, and the
drift gate all compare rendered text.

## Re-running

```
node docs/prototypes/em-dash-sweep/strip.mjs                 # dry run
node docs/prototypes/em-dash-sweep/strip.mjs --write /tmp/m  # mirror tree
# then per file: diff -u --label a/$f --label b/$f $f /tmp/m/$f >> sweep.patch
git apply sweep.patch
```
