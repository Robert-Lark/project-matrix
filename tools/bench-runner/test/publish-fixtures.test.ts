/**
 * The front Worker's publication-gate fixtures are RECEIPTS by this
 * workspace's own contract (workers-hardening, 2026-09-25). The gate
 * (workers/front/lab/publish.mjs) reads a handful of fields and its typedef
 * names only those; the fixtures mirror a real committed receipt field for
 * field, and this leg is what says so — parsed by the same Zod schema
 * `reproduce` refuses malformed receipts with, so a fixture that invented a
 * field the runner never writes, or dropped one it always does, fails here
 * rather than proving the gate against an artifact that could never exist.
 *
 * Rows the generator flags `schemaValid: false` are the deliberate
 * exceptions — a wrong `kind`, a second receiptVersion, a null run value —
 * and each is asserted to FAIL the schema, so the flag cannot go stale.
 *
 * Cross-workspace read by path: `@pm/bench-runner#test` is uncached in
 * turbo.json for exactly this class of read.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { Receipt } from "../src/receipt";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixtureDir = join(repoRoot, "workers", "front", "test", "fixtures", "publish");

const generator = (await import(
  pathToFileURL(join(fixtureDir, "generate.mjs")).href
)) as { CASES: { id: string; kind: string; schemaValid?: boolean }[] };

describe("the gate's receipt fixtures are receipts by the runner's own schema", () => {
  const files = readdirSync(join(fixtureDir, "receipts")).filter((f) => f.endsWith(".json"));
  const invalidById = new Set(
    generator.CASES.filter((c) => c.schemaValid === false).map((c) => `${c.id}.json`),
  );

  it("non-vacuity: there are receipt fixtures, and at least one deliberate schema exception", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(invalidById.size).toBeGreaterThan(0);
    for (const f of invalidById) expect(files, `${f} named by a row but not on disk`).toContain(f);
  });

  for (const file of files) {
    const expectValid = !invalidById.has(file);
    it(`${file} ${expectValid ? "parses" : "is refused by"} the runner's Receipt schema`, () => {
      const parsed = Receipt.safeParse(JSON.parse(readFileSync(join(fixtureDir, "receipts", file), "utf8")));
      expect(parsed.success, expectValid ? JSON.stringify(parsed.error?.issues ?? null) : "expected a schema refusal").toBe(expectValid);
    });
  }
});
