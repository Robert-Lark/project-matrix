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

// A tray path opening a string literal — test titles mentioning the path
// mid-sentence don't match; request builders do.
const TRAY_REQUEST = /["'`]\/api\/(plp|pdp)/;

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
    expect(
      violations,
      `un-nonced, non-cold warm-tier request(s) — nonce them, use cache=cold, or add a "kv-exempt: <why>" marker:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
