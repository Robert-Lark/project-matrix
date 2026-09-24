/**
 * The vanilla cart trio — `read`, `count`, `renderCount` — is byte-identical
 * (after comment stripping) in every vanilla script that re-implements the
 * cart storage contract, and this is the guard that keeps it so
 * (checkout-measure-prep, 2026-09-24; the decision map's owed item (7)).
 *
 * Why four copies exist is recorded in each file and stands: a component is
 * a spec, not shared code (ADR-0003 §1), and the vanilla paradigm's real
 * shape is one request, one script, no module graph. What did NOT stand was
 * the drift risk — nothing asserted the copies stayed identical, and the
 * repo's own history says what happens to an unguarded true statement
 * (CART_CONTRACT's uniqueness clause: stated for months, checked by nothing,
 * and the two readers disagreed about a value neither could write).
 *
 * The oracle is INDEPENDENT on purpose: the files are compared to EACH OTHER,
 * never to the contract module they re-implement from (`shell.mjs`
 * CART_CONTRACT) and never to a canonical copy — a test that compares an
 * implementation to a function it was written from is the self-referential
 * class unit 6 recorded (a dropped prefix moved both sides). Here a change
 * to one copy fails against three others; a change to all four passes, which
 * is the intended edit and is the browser leg's to judge.
 *
 * Comments are stripped before comparing (lib/code-only.ts): each copy
 * carries its own prose and is allowed to, and "identical" is a claim about
 * code. Whitespace collapses for the same reason.
 *
 * The storage KEY is compared too, separately: `read()` closes over
 * `const KEY = "pm:cart"`, the one free variable the trio depends on, and it
 * is declared above the span — so a guard over the span alone would pass a
 * copy that reads a different key (the verify-slice skeptic lens, 2026-09-24:
 * cart.js writing `pm:cart:v2` while the other badges read `pm:cart` would
 * have merged green). Files against each other, never against the contract.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { codeOnly } from "./lib/code-only";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const srcDir = join(repoRoot, "variants", "vanilla", "src");

/** The three declarations, in the order every copy carries them. */
const TRIO = ["const read = () =>", "const count = (cart) =>", "const renderCount = (n) =>"] as const;

/**
 * The span from `const read` through the end of `renderCount`'s body —
 * brace-matched, so the extractor does not depend on the body's length.
 * Returns null when the file has no trio, which is how the file set below is
 * derived: a vanilla script HAS the trio or it does not.
 */
function trioSpan(source: string): string | null {
  const start = source.indexOf(TRIO[0]);
  if (start === -1) return null;
  const renderAt = source.indexOf(TRIO[2], start);
  if (renderAt === -1) return null;
  const open = source.indexOf("{", renderAt);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        // Through the arrow function's closing brace and its `;`.
        const end = source.indexOf(";", i) + 1;
        return source.slice(start, end);
      }
    }
  }
  return null;
}

/** Comment-free, whitespace-collapsed code — what "identical" means here. */
function normalized(span: string): string {
  return codeOnly(span).replace(/\s+/g, " ").trim();
}

/** The storage key declaration a copy closes over, or null. */
function keyLine(source: string): string | null {
  return codeOnly(source).match(/const KEY = "[^"]*";/)?.[0] ?? null;
}

/** Every vanilla script carrying the trio, DERIVED from disk. */
function trioFiles(): { file: string; span: string; key: string | null }[] {
  const out: { file: string; span: string; key: string | null }[] = [];
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".js")).sort()) {
    const source = readFileSync(join(srcDir, file), "utf8");
    const span = trioSpan(source);
    if (span !== null) out.push({ file, span, key: keyLine(source) });
  }
  return out;
}

/** First point of divergence, with context — a guard whose failure output
 *  cannot be read is a guard that gets muted (checkout-vanilla's lesson). */
function firstDivergence(a: string, b: string, context = 60): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const from = Math.max(0, i - context);
  return `first divergence at character ${i}:\n  …${a.slice(from, i + context)}…\n  …${b.slice(from, i + context)}…`;
}

const FILES = trioFiles();

describe("the vanilla cart trio is identical in every copy", () => {
  it("finds the copies the decision map names, and every other vanilla script that carries one", () => {
    // Non-vacuity: the three files the audit named (cart.js, pdp.js,
    // checkout.js) plus the a11y section's badge-only copy (DIFF-TO-STARTER
    // decision 7). A fifth copy joins by existing; a copy that lost its trio
    // drops out and the count below says so.
    const names = FILES.map((f) => f.file);
    for (const owed of ["cart.js", "pdp.js", "checkout.js", "a11y.js"]) {
      expect(names, `${owed} no longer carries the trio`).toContain(owed);
    }
    expect(FILES.length).toBeGreaterThanOrEqual(4);
  });

  it("every copy declares read, count and renderCount, in that order, and nothing else in the span", () => {
    for (const { file, span } of FILES) {
      const code = codeOnly(span);
      const positions = TRIO.map((decl) => code.indexOf(decl));
      expect(positions, `${file}: a declaration is missing`).not.toContain(-1);
      expect([...positions].sort((a, b) => a - b), `${file}: declarations out of order`).toEqual(positions);
      // Exactly three arrow-function declarations in the span (`read`'s own
      // `const cart = JSON.parse(…)` is a value, not a function): a fourth
      // would be a helper one copy grew and the others did not.
      expect(code.match(/const \w+ = \(/g)?.length, `${file}: unexpected function declarations in the span`).toBe(3);
    }
  });

  it("the copies are byte-identical after comment stripping and whitespace collapse", () => {
    const [first, ...rest] = FILES;
    expect(first).toBeDefined();
    const reference = normalized(first!.span);
    expect(reference.length).toBeGreaterThan(400); // real code, not an empty match
    for (const { file, span } of rest) {
      const candidate = normalized(span);
      if (candidate !== reference) {
        console.error(`${first!.file} vs ${file}\n${firstDivergence(reference, candidate)}`);
      }
      expect(candidate, `${file} has drifted from ${first!.file} (see above)`).toBe(reference);
    }
  });

  it("every copy declares the same storage KEY — the free variable the span closes over", () => {
    const keys = FILES.map((f) => f.key);
    for (const [i, key] of keys.entries()) {
      expect(key, `${FILES[i]!.file} declares no const KEY`).not.toBeNull();
    }
    expect(new Set(keys).size, `the copies read different keys: ${JSON.stringify(Object.fromEntries(FILES.map((f) => [f.file, f.key])))}`).toBe(1);
    // Non-vacuity: a real key, not an empty string.
    expect(keys[0]).toMatch(/const KEY = "[^"]+";/);
  });

  it("fires on a one-token drift and NOT on a comment-only edit — the two directions of the claim", () => {
    // The self-proof: the comparison is not trivially equal, and the strip is
    // doing its job. Both against a real copy, never a synthetic string.
    const real = FILES[0]!.span;
    const drifted = real.replace("n > 9", "n > 99");
    expect(drifted).not.toBe(real);
    expect(normalized(drifted)).not.toBe(normalized(real));
    const commented = real.replace(TRIO[1], `// a note the other copies do not carry\n  ${TRIO[1]}`);
    expect(commented).not.toBe(real);
    expect(normalized(commented)).toBe(normalized(real));
  });
});
