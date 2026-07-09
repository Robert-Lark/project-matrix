/**
 * There is deliberately NO shared component-runtime package (ADR-0003 §1):
 * a "component" is a spec — canonical markup + shared CSS — re-implemented by
 * each paradigm in its own idiom. A shared runtime would bias the exact
 * numbers the project measures (the Web Components rejection).
 *
 * Enforced structurally: packages/ may only contain the ADR-0004 §2 set, and
 * the two spec-carrying packages (@pm/tokens, @pm/reference) must expose no
 * JS/TS entry points.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const packagesDir = join(repoRoot, "packages");

// The shared-package set ADR-0004 §2 allows. `switcher` arrives with issue #5.
const ALLOWED = new Set([
  "data-contract",
  "tokens",
  "reference",
  "switcher",
  "measurement",
]);

describe("no shared component runtime exists (ADR-0003 §1, ADR-0004 §2)", () => {
  it("packages/ contains only the ADR-decided shared-package set", () => {
    const dirs = readdirSync(packagesDir).filter((d) =>
      statSync(join(packagesDir, d)).isDirectory(),
    );
    for (const dir of dirs) {
      expect(ALLOWED.has(dir), `unexpected shared package: packages/${dir}`).toBe(
        true,
      );
    }
  });

  it("the design-system packages expose no JS/TS entry point", () => {
    for (const name of ["tokens", "reference"]) {
      const pkg = JSON.parse(
        readFileSync(join(packagesDir, name, "package.json"), "utf8"),
      ) as {
        main?: string;
        module?: string;
        exports?: Record<string, string>;
      };
      expect(pkg.main, `${name} has a main entry`).toBeUndefined();
      expect(pkg.module, `${name} has a module entry`).toBeUndefined();
      for (const target of Object.values(pkg.exports ?? {})) {
        expect(target, `${name} exports runtime code: ${target}`).not.toMatch(
          /\.(js|mjs|cjs|ts|mts|cts|tsx)$/,
        );
      }
    }
  });
});
