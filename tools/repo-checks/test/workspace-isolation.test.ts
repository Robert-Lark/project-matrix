/**
 * The zero-bias asset, PROVEN not promised (ADR-0004 §2): with pnpm's strict
 * layout + `hoist: false`, a workspace cannot resolve a SIBLING's undeclared
 * dependency from anywhere inside the repo — so a variant can never quietly
 * bundle a sibling's packages and bundle contents stay honest.
 *
 * The demonstration is end-to-end: spawn a real `node` process resolving
 * `zod` from inside two workspaces — one that declares it (@pm/data-contract)
 * and one that does not (@pm/tokens) — and assert resolution succeeds/fails
 * accordingly. This is the "test or documented check" issue #2 requires.
 *
 * Two porosity channels exist OUTSIDE this guarantee, documented so the claim
 * stays honest (both audited 2026-07-07):
 *  - Node's walk-up continues past the repo root, so a node_modules directory
 *    in an ancestor of the repo (e.g. $HOME/node_modules on a dev machine)
 *    can satisfy undeclared imports locally. Guarded in CI below — where the
 *    benchmark builds actually run — and the airtight form (every resolved
 *    module path lives under the repo) belongs to the bench/drift builds
 *    (issues #6/#7).
 *  - `pnpm exec` bin lookup includes shims pnpm links for TRANSITIVE deps
 *    (e.g. vitest's vite appears in a declaring workspace's .bin). Module
 *    resolution — what determines bundle contents — stays strict; only
 *    script/bin invocation is looser.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function resolveFrom(workspaceDir: string, specifier: string) {
  return spawnSync(
    process.execPath,
    ["-e", `console.log(require.resolve(${JSON.stringify(specifier)}))`],
    { cwd: join(repoRoot, workspaceDir), encoding: "utf8" },
  );
}

describe("strict, non-hoisted dependency isolation (ADR-0004 §2)", () => {
  it("a workspace that DECLARES zod resolves it (positive control)", () => {
    const result = resolveFrom("packages/data-contract", "zod");
    expect(result.status, result.stderr).toBe(0);
  });

  it("a workspace that does NOT declare zod cannot resolve it", () => {
    const result = resolveFrom("packages/tokens", "zod");
    // On failure the resolved path names the leak's source (e.g. an ancestor
    // node_modules outside the repo, or a hoist regression inside it).
    expect(
      result.status,
      `zod unexpectedly resolved from packages/tokens: ${result.stdout.trim()}`,
    ).not.toBe(0);
    expect(result.stderr).toContain("Cannot find");
  });

  it("the root dependency set is exactly the tooling allowlist (the walk-up channel stays tooling-only)", () => {
    // Everything the root declares is resolvable from every workspace via
    // Node's walk-up. Pinning the exact set means adding ANY root dependency
    // fails here loudly and forces a deliberate decision — the guarantee
    // cannot narrow silently.
    const rootPkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(rootPkg.dependencies).toBeUndefined();
    expect(Object.keys(rootPkg.devDependencies ?? {}).sort()).toEqual([
      "@eslint/js",
      "eslint",
      "turbo",
      "typescript-eslint",
    ]);
  });

  it("hoisting is disabled repo-wide (pnpm ≥10 reads it from pnpm-workspace.yaml)", () => {
    const workspaceYaml = readFileSync(
      join(repoRoot, "pnpm-workspace.yaml"),
      "utf8",
    );
    expect(workspaceYaml).toMatch(/^hoist: false$/m);
  });

  it("the hidden virtual-store hoist is actually empty (hoist: false applied)", () => {
    // vitest exports NODE_PATH ending in node_modules/.pnpm/node_modules to
    // its workers and their children — if pnpm populated that dir, undeclared
    // deps would leak into anything a test spawns. Guard it directly.
    const hiddenHoist = join(repoRoot, "node_modules", ".pnpm", "node_modules");
    expect(
      existsSync(hiddenHoist) ? readdirSync(hiddenHoist) : [],
    ).toEqual([]);
  });

  // Dev machines legitimately carry e.g. $HOME/node_modules, so this guard is
  // CI-only: on the runners that produce the benchmark builds, nothing above
  // the repo may be resolvable.
  it.runIf(process.env.CI)(
    "no ancestor of the repo carries a node_modules directory (CI)",
    () => {
      const leaks: string[] = [];
      for (let dir = dirname(repoRoot); ; dir = dirname(dir)) {
        if (existsSync(join(dir, "node_modules"))) {
          leaks.push(join(dir, "node_modules"));
        }
        if (dir === dirname(dir)) break;
      }
      expect(leaks, `ancestor node_modules can leak undeclared deps: ${leaks.join(", ")}`).toEqual([]);
    },
  );
});
