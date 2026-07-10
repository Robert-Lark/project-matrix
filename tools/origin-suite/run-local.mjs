// Composed-origin suite against local cross-process dev — the one command CI
// (and anyone) runs. Starts one `wrangler dev` per Worker (spike hardening 3:
// the single-process multi-config mode is forbidden — it demonstrably breaks
// assets-through-bindings), waits for the composed origin to answer, runs the
// suite, and tears everything down.
//
// Variants start before the front Worker so its service bindings find them in
// wrangler's local dev registry (the spike's proven shape).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const suiteDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(suiteDir, "..", "..");
const ORIGIN = "http://127.0.0.1:8787";
const logDir = join(suiteDir, ".dev-logs");
mkdirSync(logDir, { recursive: true });

const children = [];

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

function stopAll() {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

// A cancelled CI job (or Ctrl-C) must still tear down the process tree.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopAll();
    process.exit(130);
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

let suiteStatus;
try {
  startWorker("variants/placeholder-static", "placeholder-static");
  startWorker("variants/placeholder-ssr", "placeholder-ssr");
  startWorker("workers/front", "front");

  console.log(`waiting for the composed origin at ${ORIGIN}`);
  await waitFor(`${ORIGIN}/`, 90_000);
  await waitFor(`${ORIGIN}/placeholder-static/sample/`, 60_000);
  await waitFor(`${ORIGIN}/placeholder-ssr/sample/`, 60_000);
  console.log("composed origin ready — running the suite");

  const suite = spawnSync("pnpm", ["exec", "vitest", "run"], {
    cwd: suiteDir,
    stdio: "inherit",
    env: { ...process.env, PM_ORIGIN: ORIGIN },
  });
  suiteStatus = suite.status ?? 1;
} finally {
  stopAll();
}
process.exit(suiteStatus ?? 1);
