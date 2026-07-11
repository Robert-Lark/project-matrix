/**
 * The capture CLI — `pnpm capture …` from the repo root (built by esbuild to
 * dist/cli.mjs; sharp stays external).
 *
 *   pnpm capture run [--until search|plan|details|images|derive|normalize]
 *     [--api-base https://api.discogs.com] [--min-interval-ms 1100]
 *     [--spec crate.spec.json] [--capture-dir .capture] [--crate-dir crate]
 *
 *   pnpm capture status
 *   pnpm capture seed [--remote]
 *
 * `run` is the one-time capture (issue #9), checkpointed and resumable: kill
 * it anywhere, run it again, and it continues from disk; a fully-landed
 * capture re-runs with ZERO API requests (and therefore needs no token —
 * the credential is loaded lazily, on the first real request only).
 *
 * `seed` pushes the frozen crate into R2 through the edge seeder — local
 * wrangler emulation by default; `--remote` shares issue #3's credential gate.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DiscogsClient } from "./discogs";
import { detailsPhase } from "./details";
import { derivePhase } from "./derive";
import { imagesPhase } from "./images";
import { planPhase } from "./plan";
import { searchPhase } from "./search";
import { loadSpec } from "./spec";
import { statusCommand } from "./status";
import { normalizePhase } from "./normalize";
import { exists, readJson, writeJsonAtomic, type Dirs } from "./store";

// fileURLToPath, not URL.pathname (bench-runner precedent): pathname keeps
// percent-encoding, which breaks paths under a checkout containing spaces.
const toolRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(toolRoot, "..", "..");

const PHASES = ["search", "plan", "details", "images", "derive", "normalize"] as const;
type Phase = (typeof PHASES)[number];

const log = (line: string) => console.log(line);

interface CommonValues {
  spec: string;
  "capture-dir": string;
  "crate-dir": string;
}

function commonOptions() {
  return {
    spec: { type: "string" as const, default: join(toolRoot, "crate.spec.json") },
    "capture-dir": { type: "string" as const, default: join(toolRoot, ".capture") },
    "crate-dir": { type: "string" as const, default: join(toolRoot, "crate") },
  };
}

function load(values: CommonValues): { spec: ReturnType<typeof loadSpec>; dirs: Dirs } {
  return {
    spec: loadSpec(resolve(values.spec)),
    dirs: { capture: resolve(values["capture-dir"]), crate: resolve(values["crate-dir"]) },
  };
}

/**
 * Advisory single-runner lock. Two concurrent captures against one checkpoint
 * dir converge to a correct crate (atomic writes + existence checkpoints) but
 * race on downloads and waste rate-limit budget — probed live when a killed
 * wrapper shell orphaned its node child. A SIGKILLed run leaves a stale lock;
 * the pid liveness check clears it on the next start.
 */
function acquireLock(dirs: Dirs): () => void {
  const lockPath = join(dirs.capture, "lock.json");
  if (exists(lockPath)) {
    const { pid } = readJson<{ pid: number }>(lockPath);
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    if (alive && pid !== process.pid) {
      throw new Error(`another capture run (pid ${pid}) holds ${lockPath} — refusing to race it`);
    }
  }
  writeJsonAtomic(lockPath, { pid: process.pid, startedAt: new Date().toISOString() });
  return () => rmSync(lockPath, { force: true });
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "run") {
    const { values } = parseArgs({
      args: rest,
      options: {
        ...commonOptions(),
        until: { type: "string" },
        "api-base": { type: "string", default: "https://api.discogs.com" },
        "min-interval-ms": { type: "string", default: "1100" },
      },
    });
    const until = (values.until ?? "normalize") as Phase;
    if (!PHASES.includes(until)) {
      console.error(`--until must be one of: ${PHASES.join(", ")}`);
      return 1;
    }
    const { spec, dirs } = load(values);
    // NaN poisons the pacing scheduler (Math.max(NaN, …) is NaN — every pace
    // AND park would silently no-op), so the flag is validated, not coerced.
    const minIntervalMs = Number(values["min-interval-ms"]);
    if (!Number.isFinite(minIntervalMs) || minIntervalMs <= 0) {
      console.error(`--min-interval-ms must be a positive number of milliseconds`);
      return 1;
    }
    const client = new DiscogsClient({
      apiBase: values["api-base"],
      minIntervalMs,
      log,
    });
    const after = (phase: Phase) => PHASES.indexOf(until) > PHASES.indexOf(phase);

    const releaseLock = acquireLock(dirs);
    try {
      await searchPhase(spec, dirs, client, log);
      if (!after("search")) return 0;

      const plan = planPhase(spec, dirs, log);
      if (!after("plan")) return 0;

      // Details and images interleave: an image failure can tombstone a
      // release, which pulls a deterministic substitute whose details/images
      // then need fetching — loop to a fixed point.
      for (;;) {
        await detailsPhase(dirs, client, plan, log);
        if (!after("details")) return 0;
        const { newTombstones } = await imagesPhase(dirs, client, plan, log);
        if (newTombstones === 0) break;
      }
      if (!after("images")) return 0;

      await derivePhase(dirs, plan, log);
      if (!after("derive")) return 0;

      await normalizePhase(dirs, plan, log);
      log(`[run] done (${client.requestCount} API requests this run)`);
      return 0;
    } finally {
      releaseLock();
    }
  }

  if (command === "status") {
    const { values } = parseArgs({ args: rest, options: commonOptions() });
    const { spec, dirs } = load(values);
    statusCommand(spec, dirs, log);
    return 0;
  }

  if (command === "seed") {
    const { values } = parseArgs({
      args: rest,
      options: { ...commonOptions(), remote: { type: "boolean", default: false } },
    });
    const { dirs } = load(values);
    const args = ["seed-local.mjs", ...(values.remote ? ["--remote"] : []), "--dir", dirs.crate];
    const result = spawnSync("node", args, {
      cwd: join(repoRoot, "workers", "edge"),
      stdio: "inherit",
    });
    return result.status ?? 1;
  }

  console.error("usage: pnpm capture <run|status|seed> [options]");
  return 1;
}

process.exitCode = await main();
