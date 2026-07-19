// Composed-origin suite against local cross-process dev — the one command CI
// (and anyone) runs. Starts one `wrangler dev` per Worker (spike hardening 3:
// the single-process multi-config mode is forbidden — it demonstrably breaks
// assets-through-bindings), waits for the composed origin to answer, runs the
// suite, and tears everything down.
//
// Variants start before the front Worker so its service bindings find them in
// wrangler's local dev registry (the spike's proven shape). Edge starts
// first of all: react-next binds pm-edge itself (a request-time variant,
// editorial-build slice B), so its own dev process needs edge already
// registered, same as front's requirement.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const suiteDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(suiteDir, "..", "..");
const ORIGIN = "http://127.0.0.1:8787";
const PORTS = [
  8787, 8788, 8789, 8790, 8791, 8792, 8793, 9230, 9231, 9232, 9233, 9234, 9235, 9236,
];
const logDir = join(suiteDir, ".dev-logs");
mkdirSync(logDir, { recursive: true });

const children = [];

// Pre-flight: a stale wrangler/workerd tree holding any composition port
// would silently serve this suite while the fresh worker dies on its bind —
// a demonstrated wrong-data failure mode. Fail loudly instead.
async function assertPortsFree() {
  const { createServer } = await import("node:net");
  for (const port of PORTS) {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once("error", () =>
        reject(
          new Error(
            `port ${port} is already bound — a stale wrangler/workerd tree is running; kill it (pkill -f "wrangler dev"; pkill workerd) and re-run`,
          ),
        ),
      );
      probe.listen(port, "127.0.0.1", () => probe.close(resolve));
    });
  }
}

function startWorker(workspaceDir, name) {
  // Children write straight to file descriptors — piping through this parent
  // would stall while spawnSync (the suite) blocks the event loop, losing
  // exactly the logs from the failure window.
  const fd = openSync(join(logDir, `${name}.log`), "w");
  const child = spawn("pnpm", ["run", "dev"], {
    cwd: join(repoRoot, workspaceDir),
    detached: true, // own process group → we can kill wrangler AND workerd
    stdio: ["ignore", fd, fd],
  });
  children.push(child);
  console.log(`started ${name} (logs: tools/origin-suite/.dev-logs/${name}.log)`);
}

async function stopAll() {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  // SIGTERM is advisory to a wrangler tree (workerd demonstrably survives
  // it); escalate so nothing leaks to poison the next run.
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (children.every((c) => c.exitCode !== null)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const child of children) {
    if (child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* gone between checks */
      }
    }
  }
}

// A cancelled CI job (or Ctrl-C) must still tear down the process tree.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopAll().finally(() => process.exit(130));
  });
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) {
      throw new Error(`${url} not answering after ${timeoutMs}ms — check tools/origin-suite/.dev-logs/`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// The snapshot the plane will SERVE is chosen by PM_SEED_DIR (below); the
// snapshot build-time variants BAKE is chosen by PM_SNAPSHOT (@pm/vanilla —
// the selector minted by the editorial build's slice A). Deriving the second
// from the first here is what keeps "the one command holds either way" true:
// a crate-seeded plane gets crate-baked variant pages, and the two can never
// silently disagree. Unknown seed dirs fail loudly — a build-time variant
// cannot bake a snapshot the selector doesn't name (and the suite's snapshot
// resolution would fail closed on it anyway).
const SNAPSHOT_DIRS = {
  fixture: resolve(repoRoot, "tools/snapshot-fixture/snapshot"),
  crate: resolve(repoRoot, "tools/snapshot-capture/crate"),
};
const seedDirForBuild = process.env.PM_SEED_DIR
  ? resolve(repoRoot, process.env.PM_SEED_DIR)
  : SNAPSHOT_DIRS.fixture;
const snapshotName = Object.entries(SNAPSHOT_DIRS).find(
  ([, dir]) => dir === seedDirForBuild,
)?.[0];
if (!snapshotName) {
  console.error(
    `PM_SEED_DIR=${process.env.PM_SEED_DIR} names no known snapshot (fixture|crate) — build-time variants cannot bake it`,
  );
  process.exit(1);
}
console.log(`snapshot-parameterized builds run with PM_SNAPSHOT=${snapshotName}`);

// Build every workspace's dist (variants, the measurement bundle, the
// front Worker's /_pm assets) — cached by turbo when unchanged.
const build = spawnSync("pnpm", ["exec", "turbo", "run", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, PM_SNAPSHOT: snapshotName },
});
if (build.status !== 0) process.exit(build.status ?? 1);

// Fresh edge-Worker state per run: the bypass→miss→hit assertions need a KV
// that this run's requests haven't already warmed. Then seed local R2 with a
// frozen snapshot — the synthesized fixture by default (the CI seed, always;
// issue #9). PM_SEED_DIR selects another committed snapshot-layout directory
// for a local verification run (e.g. the real crate,
// PM_SEED_DIR=tools/snapshot-capture/crate); the suite itself asks the plane
// which snapshot it serves (/api/snapshot) and asserts that snapshot's
// committed artifacts (issue #11), so the one command holds either way.
rmSync(join(repoRoot, "workers/edge/.wrangler/state"), {
  recursive: true,
  force: true,
});
const seedDir = process.env.PM_SEED_DIR
  ? resolve(repoRoot, process.env.PM_SEED_DIR)
  : null;
if (seedDir) console.log(`PM_SEED_DIR set — seeding ${seedDir}`);
const seed = spawnSync(
  "node",
  ["seed-local.mjs", ...(seedDir ? ["--dir", seedDir] : [])],
  { cwd: join(repoRoot, "workers/edge"), stdio: "inherit" },
);
if (seed.status !== 0) process.exit(seed.status ?? 1);

// Fresh blog plane per run (ADR-0009): wipe local D1/R2 state, re-apply
// migrations. The blog suite writes through its own admin API using the
// committed fixture credential (workers/blog/.dev.vars).
rmSync(join(repoRoot, "workers/blog/.wrangler/state"), {
  recursive: true,
  force: true,
});
const migrate = spawnSync(
  "pnpm",
  ["exec", "wrangler", "d1", "migrations", "apply", "pm-blog", "--local"],
  { cwd: join(repoRoot, "workers/blog"), stdio: "inherit" },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

let suiteStatus;
try {
  await assertPortsFree();

  startWorker("workers/edge", "edge");
  startWorker("variants/placeholder-static", "placeholder-static");
  startWorker("variants/placeholder-ssr", "placeholder-ssr");
  startWorker("variants/vanilla", "vanilla");
  startWorker("variants/react-next", "react-next");
  startWorker("workers/blog", "blog");
  startWorker("workers/front", "front");

  console.log(`waiting for the composed origin at ${ORIGIN}`);
  await waitFor(`${ORIGIN}/`, 90_000);
  await waitFor(`${ORIGIN}/placeholder-static/sample/`, 60_000);
  await waitFor(`${ORIGIN}/placeholder-ssr/sample/`, 60_000);
  await waitFor(`${ORIGIN}/vanilla/editorial/`, 60_000);
  await waitFor(`${ORIGIN}/react-next/editorial/`, 60_000);
  await waitFor(`${ORIGIN}/api/plp`, 60_000);
  await waitFor(`${ORIGIN}/blog/`, 60_000);

  // A worker that lost a port race exits while something stale answers in
  // its place — readiness alone cannot tell the difference. Every spawned
  // child must still be alive.
  const dead = children.filter((c) => c.exitCode !== null);
  if (dead.length > 0) {
    throw new Error(
      `${dead.length} worker process(es) exited during startup — see tools/origin-suite/.dev-logs/`,
    );
  }
  console.log("composed origin ready — running the suite");

  const suite = spawnSync("pnpm", ["exec", "vitest", "run"], {
    cwd: suiteDir,
    stdio: "inherit",
    // PM_BLOG_CREDENTIAL unlocks the blog write-path tests — local only;
    // the post-deploy smoke omits it so the suite never writes to prod.
    env: {
      ...process.env,
      PM_ORIGIN: ORIGIN,
      PM_BLOG_CREDENTIAL: "local-dev-credential",
    },
  });
  suiteStatus = suite.status ?? 1;
} finally {
  await stopAll();
}
process.exit(suiteStatus ?? 1);
