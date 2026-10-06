/**
 * Repo hygiene (2026-10-05; the 2026-08-29 audit's priority 9, runbook
 * unit 10). Four one-line fixes, each with the leg that keeps it fixed, so
 * none of them survives only as a comment somebody deletes.
 *
 * 1. eslint ignores `.claude/worktrees/**`. On 2026-10-05 the main checkout
 *    carried 24 parked worktrees (plus this unit's own) and `eslint .`
 *    visited 4,741 files, 4,465 of them inside those worktrees (37.4 s
 *    against 2.45 s without, medians of three). Turbo's `//#lint` inputs
 *    never included `.claude/`, so the lint task's PASS depended on files
 *    its cache key did not hash. The leg lints a planted error through stdin
 *    AS a worktree path and expects no result; the control lints the same
 *    bytes as a repo path and expects the error, so a probe that could see
 *    nothing would fail here.
 * 2. `//#lint`'s inputs are the files eslint lints, both ways. The two
 *    `.d.mts` files were linted and not hashed, a stale PASS on edit; and the
 *    globs also hashed every built `dist/`, `.next/`, `.open-next/` and
 *    `server/` tree eslint ignores (2,648 inputs on a built tree against 277
 *    linted files, verify-slice), so every local build re-linted for nothing.
 *    Rather than pin an extension list (a second copy of the rule), the leg
 *    asks eslint which files it lints (`--format json`) and turbo which files
 *    the task hashes (`--dry=json`, the task's resolved `inputs`), and
 *    requires the two sets equal apart from the files turbo adds to every
 *    root task on its own. About 3 s: two tool runs, no guessing.
 * 3. A variant's `deploy` script is one deploy command and builds nothing,
 *    and nothing else runs a build on `deploy` either: no `predeploy` or
 *    `postdeploy` lifecycle script (pnpm runs them around `deploy` by
 *    default) and no `build` key in a wrangler config (wrangler runs a custom
 *    build command on deploy). `.github/workflows/ci.yml` sets `PM_SNAPSHOT`
 *    in exactly one step, so a rebuild inside `deploy` is only safe while that
 *    variant stays request-time; react-next and qwik rebuilt. The front
 *    Worker's `deploy` rebuilds by design (the attestation re-stamp,
 *    turbo.json's `@pm/front#build` comment) and is exempt BY NAME, with the
 *    exemption held live: if its script stops building, the entry must go.
 * 4. Every `uses:` in the workflows is a 40-hex commit SHA with its release
 *    in a trailing comment, and no `runs-on:` is a `-latest` label. The
 *    deploy job holds the Cloudflare secrets; a mutable tag lets whoever
 *    controls it change what runs with them. Two forms need no SHA and are
 *    allowed by name: a local action (`./…`, pinned by the checkout itself)
 *    and a docker image pinned by digest. Every `runs-on:` key must yield a
 *    label the leg can read; a form it cannot read (a block list, a map) is
 *    reported, never skipped (verify-slice: the first regex dropped a line
 *    with a trailing comment and passed).
 *
 * Non-vacuity: the file sets are checked to be real (hundreds of files, at
 * least one `.mts` among them), the deploy roster to contain the two scripts
 * this unit changed, the workflow to contain the pins it changed, and every
 * predicate is proven on literal fixtures through the same extractor the
 * live leg uses.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// realpath: eslint reports paths against its real cwd, so a checkout under a
// symlinked directory would otherwise relativise every file to `../…` and
// fail leg 2 loudly for the wrong reason (verify-slice, correctness lens).
const repoRoot = realpathSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."));
// Root devDependencies' bins (eslint, turbo), the same binaries `pnpm exec` resolves at the root.
const bin = (name: string) => join(repoRoot, "node_modules", ".bin", name);

type EslintResult = { filePath: string; errorCount: number; messages: { ruleId: string | null; message: string }[] };

function runTool(name: string, args: string[], input?: string, okExits: number[] = [0]): string {
  const run = spawnSync(bin(name), args, { cwd: repoRoot, encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });
  if (run.error) throw run.error;
  if (!okExits.includes(run.status ?? -1)) throw new Error(`${name} ${args.join(" ")} exited ${run.status}:\n${run.stderr}`);
  return run.stdout;
}

/** Lint `source` as if it were the file at `asPath` (nothing is written to disk). ESLint exits 1 when it reports errors. */
export function lintStdinAs(source: string, asPath: string): EslintResult[] {
  return JSON.parse(runTool("eslint", ["--stdin", "--stdin-filename", asPath, "--no-warn-ignored", "--format", "json"], source, [0, 1])) as EslintResult[];
}

/** Every file `eslint .` lints, repo-relative. Exit 1 (errors reported) still lists the files. */
export function eslintFileList(): string[] {
  const results = JSON.parse(runTool("eslint", [".", "--format", "json"], undefined, [0, 1])) as EslintResult[];
  return results.map((r) => relative(repoRoot, realpathSync(r.filePath)));
}

/** The files turbo hashes for `//#lint`, from its own dry run (the task's resolved `inputs`). */
export function turboLintInputs(): string[] {
  const dry = JSON.parse(runTool("turbo", ["run", "lint", "--dry=json"])) as { tasks: { taskId: string; inputs: Record<string, string> }[] };
  const task = dry.tasks.find((t) => t.taskId === "//#lint");
  if (!task) throw new Error("turbo --dry=json lists no //#lint task");
  return Object.keys(task.inputs);
}

/** Files turbo hashes into every root task whatever the inputs say (observed in the dry run, 2026-10-05). */
const TURBO_OWN = new Set(["package.json", "turbo.json"]);

// The smallest planted defect eslint reports: an unused const. typescript-eslint's recommended config
// replaces the base rule, so the id reported is `@typescript-eslint/no-unused-vars` on .js files too.
const PLANTED = "const unused = 1;\n";

describe("1. eslint ignores parked worktrees under .claude/worktrees/", () => {
  it("a planted error linted AS a worktree path produces no result (the ignore is live)", () => {
    expect(lintStdinAs(PLANTED, ".claude/worktrees/zz-hygiene-probe/stale.js")).toEqual([]);
  });

  it("control: the same bytes linted AS a repo path report the error (the probe can see errors)", () => {
    const results = lintStdinAs(PLANTED, "tools/repo-checks/zz-hygiene-probe.js");
    expect(results.length).toBe(1);
    expect(results[0]!.errorCount).toBe(1);
    expect(results[0]!.messages[0]!.ruleId).toMatch(/(^|\/)no-unused-vars$/);
  });

  it("the config names the pattern (so a reader finds it where every other ignore lives)", () => {
    const config = readFileSync(join(repoRoot, "eslint.config.mjs"), "utf8");
    expect(config).toContain('".claude/worktrees/**",');
  });
});

describe("2. turbo's //#lint inputs are the files eslint lints, both ways", () => {
  const linted = eslintFileList();
  const lintedSet = new Set(linted);
  const inputs = new Set(turboLintInputs());

  it("both sets are real (non-vacuity): hundreds of files, and the .mts class is present", () => {
    expect(linted.length).toBeGreaterThan(200);
    expect(inputs.size).toBeGreaterThan(200);
    expect(linted.filter((f) => /\.(mts|cts)$/.test(f)).length, "no linted .mts/.cts file: the class this leg was written for has left the repo, re-derive").toBeGreaterThan(0);
    expect(inputs.has("eslint.config.mjs")).toBe(true);
    for (const own of TURBO_OWN) expect(inputs.has(own), `${own} is no longer a turbo-added input; re-derive TURBO_OWN`).toBe(true);
  });

  it("every linted file is a hashed input (a file eslint reads but turbo does not hash replays a stale PASS)", () => {
    const unhashed = linted.filter((f) => !inputs.has(f));
    expect(unhashed, "files eslint lints that are not in turbo.json's //#lint inputs; add their extension or directory to that task's inputs").toEqual([]);
  });

  it("every hashed input is a linted file, apart from turbo's own (a file turbo hashes but eslint ignores busts lint's cache for nothing)", () => {
    const overHashed = [...inputs].filter((f) => !lintedSet.has(f) && !TURBO_OWN.has(f));
    expect(overHashed.slice(0, 20), `${overHashed.length} hashed inputs eslint never lints (build output, generated files); add a negated glob for their class to turbo.json's //#lint inputs`).toEqual([]);
  });
});

describe("3. a variant's deploy script deploys and builds nothing, and nothing else builds on deploy", () => {
  const DEPLOY_ONLY = /^(wrangler|opennextjs-cloudflare) deploy$/;
  /** Workspaces whose `deploy` rebuilds on purpose, by exact directory, with the shape the exemption covers. */
  const REBUILDS_BY_DESIGN: Record<string, RegExp> = {
    // The attestation re-stamp (turbo.json, @pm/front#build: "the deploy script rebuilds fully"); not a variant, no PM_SNAPSHOT.
    "workers/front": /^node build\.mjs && wrangler deploy$/,
  };
  /** pnpm runs these around `deploy` by default (enable-pre-post-scripts), so a build hidden in one bypasses the deploy line. */
  const LIFECYCLE = ["predeploy", "postdeploy"] as const;

  type Workspace = { dir: string; deploy: string; lifecycle: string[]; wranglerBuild: string[] };
  function workspaces(): Workspace[] {
    const out: Workspace[] = [];
    for (const group of ["variants", "workers"]) {
      for (const name of readdirSync(join(repoRoot, group))) {
        const dir = join(repoRoot, group, name);
        const p = join(dir, "package.json");
        if (!existsSync(p)) continue;
        const pkg = JSON.parse(readFileSync(p, "utf8")) as { scripts?: Record<string, string> };
        if (!pkg.scripts?.deploy) continue;
        const lifecycle = LIFECYCLE.filter((k) => pkg.scripts![k] !== undefined).map((k) => `${k}: "${pkg.scripts![k]}"`);
        out.push({ dir: `${group}/${name}`, deploy: pkg.scripts.deploy, lifecycle, wranglerBuild: wranglerBuildKeys(dir) });
      }
    }
    return out;
  }
  /** wrangler's `build.command` runs on `wrangler deploy`; any `build` key in a wrangler config is a build on deploy. */
  function wranglerBuildKeys(dir: string): string[] {
    const found: string[] = [];
    for (const f of readdirSync(dir).filter((f) => /^wrangler\.(jsonc?|toml)$/.test(f))) {
      const text = readFileSync(join(dir, f), "utf8");
      if (f.endsWith(".toml") ? /^\s*\[build\]/m.test(text) : /^\s*"build"\s*:/m.test(text)) found.push(f);
    }
    return found;
  }
  const roster = workspaces();

  it("the roster is real (non-vacuity): the two scripts this unit changed are on it", () => {
    const dirs = roster.map((s) => s.dir);
    expect(dirs).toContain("variants/react-next");
    expect(dirs).toContain("variants/qwik");
    expect(roster.length).toBeGreaterThanOrEqual(10);
  });

  it("every deploy script outside the named exemptions is one deploy command", () => {
    const bad = roster.filter((s) => !(s.dir in REBUILDS_BY_DESIGN) && !DEPLOY_ONLY.test(s.deploy)).map((s) => `${s.dir}: "${s.deploy}"`);
    expect(bad, "deploy scripts that do more than deploy; the build belongs to turbo's build task, the only place CI sets PM_SNAPSHOT").toEqual([]);
  });

  it("no workspace outside the exemptions runs a build around deploy by another route (pre/post scripts, wrangler build key)", () => {
    const bad = roster
      .filter((s) => !(s.dir in REBUILDS_BY_DESIGN))
      .flatMap((s) => [...s.lifecycle.map((l) => `${s.dir}: ${l}`), ...s.wranglerBuild.map((f) => `${s.dir}: ${f} has a "build" key`)]);
    expect(bad, "a build that runs on deploy without being in the deploy script").toEqual([]);
  });

  it("every exemption is live: the exempt script still has the shape the exemption describes", () => {
    for (const [dir, shape] of Object.entries(REBUILDS_BY_DESIGN)) {
      const s = roster.find((x) => x.dir === dir);
      expect(s, `${dir} has no deploy script; drop its exemption`).toBeDefined();
      expect(s!.deploy, `${dir}'s deploy no longer matches its exemption; drop or re-derive the entry`).toMatch(shape);
    }
  });

  it("the predicates are live", () => {
    expect(DEPLOY_ONLY.test("wrangler deploy")).toBe(true);
    expect(DEPLOY_ONLY.test("opennextjs-cloudflare deploy")).toBe(true);
    expect(DEPLOY_ONLY.test("opennextjs-cloudflare build && opennextjs-cloudflare deploy")).toBe(false);
    expect(DEPLOY_ONLY.test("node scripts/prepare-build.mjs && wrangler deploy")).toBe(false);
    expect(DEPLOY_ONLY.test("wrangler deploy --dry-run")).toBe(false);
    expect(/^\s*"build"\s*:/m.test('{\n  "name": "x",\n  "build": { "command": "pnpm run build" }\n}')).toBe(true);
    expect(/^\s*"build"\s*:/m.test('{\n  "main": "./dist/_worker.js",\n  "assets": { "directory": "./dist" }\n}')).toBe(false);
    expect(/^\s*\[build\]/m.test('name = "x"\n[build]\ncommand = "npm run build"\n')).toBe(true);
  });
});

describe("4. GitHub Actions are pinned by commit SHA on a pinned runner image", () => {
  const workflowsDir = join(repoRoot, ".github", "workflows");
  const files = readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f));

  /** `uses: owner/repo[/path]@<40 hex> # vX.Y.Z` and nothing else: no tag, no branch, no short SHA, no pin without its release. */
  const PINNED_USES = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;
  /** Two forms carry their own pin: a local action (the checkout's own commit) and a docker image pinned by digest. */
  const PINNED_BY_NATURE = /^(\.\/\S+|docker:\/\/\S+@sha256:[0-9a-f]{64})$/;
  const pinnedUses = (u: string) => PINNED_USES.test(u) || PINNED_BY_NATURE.test(u);
  /** A dated image label, never the moving `-latest` alias. */
  const PINNED_RUNNER = /^(ubuntu|windows|macos)-\d+(\.\d+)?(-\w+)?$/;

  function usesLines(yaml: string): string[] {
    return [...yaml.matchAll(/^\s*-?\s*uses:\s*(.+?)\s*$/gm)].map((m) => m[1]!);
  }
  /** Every `runs-on:` key's value: the scalar with any trailing comment stripped, or "" for a block form, so nothing is skipped. */
  function runsOnLabels(yaml: string): string[] {
    return [...yaml.matchAll(/^\s*runs-on:(.*)$/gm)].map((m) => m[1]!.replace(/\s+#.*$/, "").trim());
  }
  const runsOnKeys = (yaml: string) => (yaml.match(/^\s*runs-on:/gm) ?? []).length;

  it("the workflow set is real (non-vacuity): ci.yml with its action steps and jobs", () => {
    expect(files).toContain("ci.yml");
    const ci = readFileSync(join(workflowsDir, "ci.yml"), "utf8");
    expect(usesLines(ci).length).toBeGreaterThanOrEqual(10);
    expect(runsOnLabels(ci).length).toBeGreaterThanOrEqual(3);
  });

  it("every uses: is a full commit SHA with its release in the trailing comment (local and digest-pinned docker actions excepted)", () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const u of usesLines(readFileSync(join(workflowsDir, f), "utf8"))) if (!pinnedUses(u)) bad.push(`${f}: uses: ${u}`);
    }
    expect(bad, "unpinned or half-pinned action refs; pin to the tag's commit SHA and name the release after `#` (a local `./` action or a `docker://…@sha256:` image needs no SHA)").toEqual([]);
  });

  it("every runs-on: is a dated image label, not -latest, and every runs-on: key was read", () => {
    const bad: string[] = [];
    for (const f of files) {
      const yaml = readFileSync(join(workflowsDir, f), "utf8");
      const labels = runsOnLabels(yaml);
      expect(labels.length, `${f}: runs-on keys the extractor did not read`).toBe(runsOnKeys(yaml));
      for (const r of labels) if (!PINNED_RUNNER.test(r) || /-latest/.test(r)) bad.push(`${f}: runs-on: ${r || "<block form>"}`);
    }
    expect(bad, "runner labels that move between images, or forms this leg cannot read (use one dated scalar label)").toEqual([]);
  });

  it("the predicates are live, through the same extractors the leg uses", () => {
    expect(pinnedUses("actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0")).toBe(true);
    expect(pinnedUses("actions/checkout@v4")).toBe(false);
    expect(pinnedUses("actions/checkout@main")).toBe(false);
    expect(pinnedUses("actions/checkout@11d5960a326750d5838078e36cf38b85af67726")).toBe(false); // 39 hex
    expect(pinnedUses("actions/checkout@11d5960a326750d5838078e36cf38b85af677262")).toBe(false); // no release comment
    expect(pinnedUses("actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4")).toBe(false); // not a release
    expect(pinnedUses("./.github/actions/setup")).toBe(true); // local: pinned by the checkout
    expect(pinnedUses("docker://alpine:3.20")).toBe(false); // a tag
    expect(pinnedUses(`docker://alpine@sha256:${"a".repeat(64)}`)).toBe(true); // a digest
    expect(PINNED_RUNNER.test("ubuntu-24.04")).toBe(true);
    expect(PINNED_RUNNER.test("ubuntu-24.04-arm")).toBe(true);
    expect(PINNED_RUNNER.test("ubuntu-latest")).toBe(false);
    expect(usesLines("      - uses: actions/checkout@v4\n        uses: x/y@z # c\n")).toEqual(["actions/checkout@v4", "x/y@z # c"]);
    // The extractor reads every form a runs-on key can take and hands it to the predicate; nothing vanishes.
    const forms = "    runs-on: ubuntu-24.04\n    runs-on: ubuntu-latest # re-pin later\n    runs-on: ${{ matrix.os }}\n    runs-on: [self-hosted, linux]\n    runs-on:\n      labels: ubuntu-latest\n";
    const labels = runsOnLabels(forms);
    expect(labels).toEqual(["ubuntu-24.04", "ubuntu-latest", "${{ matrix.os }}", "[self-hosted, linux]", ""]);
    expect(labels.length).toBe(runsOnKeys(forms));
    expect(labels.filter((r) => PINNED_RUNNER.test(r) && !/-latest/.test(r))).toEqual(["ubuntu-24.04"]);
  });
});
