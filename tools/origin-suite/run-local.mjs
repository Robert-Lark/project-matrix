// Composed-origin suite against local cross-process dev — the one command CI
// (and anyone) runs. Starts one `wrangler dev` per Worker (spike hardening 3:
// the single-process multi-config mode is forbidden — it demonstrably breaks
// assets-through-bindings), waits for the composed origin to answer, runs the
// suite, and tears everything down.
//
// Variants start before the front Worker so its service bindings find them in
// wrangler's local dev registry (the spike's proven shape).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const suiteDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(suiteDir, "..", "..");
const ORIGIN = "http://127.0.0.1:8787";
const PORTS = [8787, 8788, 8789, 8790, 9230, 9231, 9232, 9233];
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

// Build the placeholder dists (cached by turbo when unchanged).
const build = spawnSync(
  "pnpm",
  ["exec", "turbo", "run", "build", "--filter=@pm/placeholder-static", "--filter=@pm/placeholder-ssr"],
  { cwd: repoRoot, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);

// Fresh edge-Worker state per run: the bypass→miss→hit assertions need a KV
// that this run's requests haven't already warmed. Then seed local R2 with
// the frozen fixture snapshot.
rmSync(join(repoRoot, "workers/edge/.wrangler/state"), {
  recursive: true,
  force: true,
});
const seed = spawnSync("pnpm", ["run", "seed:local"], {
  cwd: join(repoRoot, "workers/edge"),
  stdio: "inherit",
});
if (seed.status !== 0) process.exit(seed.status ?? 1);

let suiteStatus;
try {
  await assertPortsFree();

  startWorker("workers/edge", "edge");
  startWorker("variants/placeholder-static", "placeholder-static");
  startWorker("variants/placeholder-ssr", "placeholder-ssr");
  startWorker("workers/front", "front");

  console.log(`waiting for the composed origin at ${ORIGIN}`);
  await waitFor(`${ORIGIN}/`, 90_000);
  await waitFor(`${ORIGIN}/placeholder-static/sample/`, 60_000);
  await waitFor(`${ORIGIN}/placeholder-ssr/sample/`, 60_000);
  await waitFor(`${ORIGIN}/api/plp`, 60_000);

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
    env: { ...process.env, PM_ORIGIN: ORIGIN },
  });
  suiteStatus = suite.status ?? 1;
} finally {
  await stopAll();
}
process.exit(suiteStatus ?? 1);
