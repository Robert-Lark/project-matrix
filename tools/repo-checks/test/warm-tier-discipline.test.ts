/**
 * Warm-tier discipline guard (issue #11). The KV warm tier is persistent
 * and its keys carry no snapshot identity, so any un-nonced, non-cold tray
 * request the origin suite makes against the DEPLOYED plane either plants
 * a warm entry that outlives the next snapshot re-seed (served stale to
 * real visitors forever — no TTL on canonical keys by design) or reads a
 * previous run's stale entry into an assertion. The rule, enforced here
 * rather than remembered in comments: every `/api/plp` / `/api/pdp`
 * request in the suite must carry `run=` (the harness isolation nonce,
 * TTL'd server-side) or `cache=cold` (bypasses the tier in both
 * directions), or a `kv-exempt:` marker on the line or the line above
 * naming why it provably never touches the tier.
 *
 * This defect class was found three independent times in one verification
 * pass (a single un-nonced request in chrome.test.ts) — a convention that
 * survives only as prose WILL regress.
 *
 * PAGE paths that proxy the tray server-side count as tray requests
 * (widened 2026-09-04 with the PLP data plane): `/htmx/plp/` fetches
 * `/api/plp` inside its Worker forwarding the page URL's `cache`/`run`
 * (variants/htmx/src/index.js PLP_KNOBS), and every `/react-next/plp/…`
 * route does the same in `loadPlp` — so an un-nonced, non-cold page request
 * plants the canonical key exactly as a direct tray call would. The
 * 2026-08-28 handoff named htmx (§6.6); react-next had the same hole, and
 * `a11y.test.ts` carried a live instance until this widening.
 *
 * BOUNDARY, stated: request-time EDITORIAL and PDP pages also fetch a tray
 * server-side (`/api/pdp/<featured>`), with no query forwarded at all —
 * the measurement-pass decision (ADR-0002 addendum, 2026-09-01) accepted
 * that those fetches read the warm tier under every column. They are out
 * of this guard's scope because no page-URL discipline could change what
 * they do; the PLP paths are IN scope because theirs forwards the knobs.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const suiteDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "origin-suite",
  "suite",
);

// A tray path — or a PLP page path that proxies it — opening a string
// literal. Test titles mentioning the path mid-sentence don't match; request
// builders do (`get("/api/plp…")`, `const path = \`/htmx/plp/…\``). The
// lookbehind excludes a quote preceded by `=`: that is an HTML attribute
// INSIDE a JS string — `toContain('href="/react-next/plp/plain/"')` asserts
// on a body and requests nothing — which the widened alternation would
// otherwise report on every masthead assertion in the suite. The second
// alternative is a template-literal interpolation closing right before the
// path — `fetch(\`${ORIGIN}/api/plp?…\`)`, the shape the PLP browser suite
// introduced (2026-09-18, verify-slice): without it the guard was blind to
// that file's two tray requests, which were cold and nonced by luck of the
// object form, not because anything checked.
// The third alternative is an interpolated PATH variable opening the query
// — `get(\`${arm.path}?cache=cold&…\`)`, the loop-over-arms shape of the two
// PLP suite files, whose request lines carried no literal path at all and so
// were invisible here (2026-09-18, verify-slice skeptic lens): their
// discipline rested on a `kv-exempt` comment on a constant, not on this
// guard. A `${path}?` that is NOT a warm-tier request (published-readings'
// lab pages) carries its own kv-exempt line, as every exemption does.
const TRAY_REQUEST =
  /(?<![=\w])(?:(?:["'`]|\$\{[A-Za-z_]+\})\/(api\/(plp|pdp)|(htmx|react-next)\/plp)\b|\$\{(?:[a-z]+\.)?path\}(?=\?))/;

describe("origin-suite warm-tier discipline (issue #11)", () => {
  it("every tray request is nonced, cold, or explicitly kv-exempt", () => {
    const files = readdirSync(suiteDir).filter((f) => f.endsWith(".ts"));
    // Non-vacuity: the suite must actually be where this guard looks.
    expect(files.length).toBeGreaterThanOrEqual(7);

    let requestLines = 0;
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(join(suiteDir, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (!TRAY_REQUEST.test(line)) return;
        requestLines += 1;
        const prev = lines[i - 1]?.trim() ?? "";
        if (
          line.includes("run=") ||
          line.includes("cache=cold") ||
          line.includes("kv-exempt:") ||
          prev.includes("kv-exempt:")
        ) {
          return;
        }
        violations.push(`${file}:${i + 1}: ${trimmed}`);
      });
    }

    // Non-vacuity: the pattern still recognizes the suite's request shape.
    expect(requestLines).toBeGreaterThanOrEqual(10);
    // …and the PAGE shapes it was widened for, without the false positive it
    // was tuned around. Pinned here so the regex cannot quietly narrow.
    expect(TRAY_REQUEST.test('await get("/react-next/plp/plain/")')).toBe(true);
    expect(TRAY_REQUEST.test("const path = `/htmx/plp/?genre=Jazz`;")).toBe(true);
    expect(TRAY_REQUEST.test("targets: [{ path: \"/react-next/plp/apollo\" }]")).toBe(true);
    expect(TRAY_REQUEST.test("const res = await fetch(`${ORIGIN}/api/plp?${qs}`);")).toBe(true);
    expect(TRAY_REQUEST.test("await page.goto(`${ORIGIN}/htmx/plp/`);")).toBe(true);
    expect(TRAY_REQUEST.test("const res = await get(`${arm.path}?cache=cold&${enc({ genre })}`);")).toBe(true);
    expect(TRAY_REQUEST.test("return `${ORIGIN}${path}?cache=cold&run=${NONCE}${qs ? `&${qs}` : \"\"}`;")).toBe(true);
    expect(TRAY_REQUEST.test("await fetch(`${ORIGIN}/api/snapshot`)")).toBe(false);
    expect(TRAY_REQUEST.test("expect(body).toContain('href=\"/react-next/plp/plain/\"')")).toBe(false);
    expect(TRAY_REQUEST.test('get("/react-next/plpx/")')).toBe(false);
    expect(
      violations,
      `un-nonced, non-cold warm-tier request(s) — nonce them, use cache=cold, or add a "kv-exempt: <why>" marker:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
