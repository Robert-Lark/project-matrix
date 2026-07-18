// Seed a frozen snapshot into R2. Default source: the synthesized fixture —
// the CI seed, always (issue #9: CI never depends on the real crate or the
// Discogs API). `--dir <path>` seeds any other snapshot-layout directory —
// the real captured crate rides in via `pnpm capture seed`.
//
// Object layout mirrors the URL space: the contract's image paths ARE the R2
// keys (assets/img/...), and the tray files live under snapshot/.
//
// LOCAL mode seeds through a throwaway seed Worker (one `wrangler dev`
// sharing this project's persist dir, all objects streamed over HTTP):
// concurrent `wrangler r2 object put --local` processes were probed to
// corrupt state (3 of 8 objects byte-mismatched — miniflare persistence is
// not multi-process-safe), and serial per-object puts cost ~0.7s each, which
// the fixture's few dozen objects tolerate but the crate's thousands (600px
// derivatives + their .thumb.avif twins) do not. One workerd process = one
// writer = fast AND safe.
//
// REMOTE mode keeps per-object `wrangler r2 object put --remote` (distinct
// keys against the real API are concurrency-safe; modest pool of 4).
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const wranglerBin = join(root, "node_modules", ".bin", "wrangler");
const remote = process.argv.includes("--remote");
const dirFlag = process.argv.indexOf("--dir");
const dirArg = dirFlag !== -1 ? process.argv[dirFlag + 1] : undefined;
if (dirFlag !== -1 && !dirArg) {
  console.error("--dir requires a path to a snapshot-layout directory");
  process.exit(1);
}
const snapDir = dirArg
  ? resolve(dirArg)
  : join(
      dirname(
        createRequire(join(root, "package.json")).resolve(
          "@pm/snapshot-fixture/package.json",
        ),
      ),
      "snapshot",
    );

// Clobber guard (issue #9): once the REAL crate has been seeded into remote
// R2 (a manual, credentialed step — its image bytes are deliberately not in
// git, so CI cannot re-seed it), an armed CI deploy re-seeding the DEFAULT
// fixture must not overwrite it. FAIL-CLOSED: only a positively-identified
// missing manifest (fresh bucket) proceeds; any other failure — transient
// API error, auth trouble, unparseable output — refuses, because "couldn't
// tell" must never read as "safe to overwrite".
const sourceCrate = JSON.parse(readFileSync(join(snapDir, "manifest.json"), "utf8")).crate;
if (remote && !dirArg) {
  let remoteCrate;
  try {
    remoteCrate = JSON.parse(
      execFileSync(
        wranglerBin,
        ["r2", "object", "get", "pm-snapshot/snapshot/manifest.json", "--remote", "--pipe"],
        { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
      ),
    ).crate;
  } catch (err) {
    const text = `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message ?? ""}`;
    // wrangler surfaces a missing key as R2 "does not exist" (error 10007).
    if (/does not exist|10007/i.test(text)) {
      remoteCrate = null; // fresh bucket — first seed proceeds
    } else {
      console.error(
        "could not read the remote snapshot manifest — refusing to seed over an " +
          "unknown bucket state (fail-closed). Fix the read, or seed an explicit --dir.",
      );
      process.exit(1);
    }
  }
  if (remoteCrate !== null && remoteCrate !== sourceCrate) {
    console.log(
      `remote R2 already holds crate "${remoteCrate}" — refusing to overwrite it with the ` +
        `fixture. (Re-seed the crate via \`pnpm capture seed --remote\`; to deliberately ` +
        `reset the bucket to the fixture, seed it with an explicit --dir.)`,
    );
    process.exit(0);
  }
}

// Dotfiles (.DS_Store) and atomic-write leftovers (*.tmp) are not snapshot
// assets — never seed them.
const imgFiles = readdirSync(join(snapDir, "img"))
  .filter((f) => !f.startsWith(".") && !f.endsWith(".tmp"))
  .sort();
const objects = [
  ["snapshot/manifest.json", join(snapDir, "manifest.json"), "application/json"],
  ["snapshot/summaries.json", join(snapDir, "summaries.json"), "application/json"],
  ["snapshot/details.json", join(snapDir, "details.json"), "application/json"],
  ...imgFiles.map((f) => [`assets/img/${f}`, join(snapDir, "img", f), "image/avif"]),
];
console.log(
  `seeding ${objects.length} snapshot objects (crate "${sourceCrate}") into ${remote ? "REMOTE" : "local"} R2`,
);

if (remote) {
  const POOL = 4;
  let next = 0;
  let done = 0;
  const put = ([key, file, contentType]) =>
    new Promise((resolveOne, rejectOne) => {
      const child = spawn(
        wranglerBin,
        ["r2", "object", "put", `pm-snapshot/${key}`, "--file", file,
          "--content-type", contentType, "--remote"],
        { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
      );
      child.on("exit", (code) =>
        code === 0 ? resolveOne() : rejectOne(new Error(`put failed for ${key}`)),
      );
      child.on("error", rejectOne);
    });
  const worker = async () => {
    while (next < objects.length) {
      const i = next++;
      await put(objects[i]);
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${objects.length}`);
    }
  };
  await Promise.all(Array.from({ length: POOL }, worker));
} else {
  // Throwaway seed Worker on a fixed side port, persisting into THIS
  // project's local state (the same dir `wrangler dev` serves from).
  const PORT = 8799;
  try {
    const holders = execFileSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    }).trim();
    if (holders) {
      console.error(
        `port ${PORT} is already held (pids ${holders.replaceAll("\n", ", ")}) — a leaked ` +
          `seed worker? Kill it and re-run (workers/README.md port discipline).`,
      );
      process.exit(1);
    }
  } catch {
    // lsof exits nonzero when nothing listens — the port is free.
  }
  const tmp = mkdtempSync(join(tmpdir(), "pm-seed-"));
  writeFileSync(
    join(tmp, "seed-worker.mjs"),
    `export default {
  async fetch(request, env) {
    if (request.method !== "PUT") return new Response("pm seed worker", { status: 405 });
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const ct = url.searchParams.get("ct");
    if (!key || !ct) return new Response("key and ct required", { status: 400 });
    await env.SNAPSHOT.put(key, request.body, { httpMetadata: { contentType: ct } });
    return new Response(null, { status: 204 });
  },
};
`,
  );
  writeFileSync(
    join(tmp, "wrangler.json"),
    JSON.stringify({
      name: "pm-seed",
      main: "seed-worker.mjs",
      compatibility_date: "2026-06-01",
      r2_buckets: [{ binding: "SNAPSHOT", bucket_name: "pm-snapshot" }],
    }),
  );

  const dev = spawn(
    wranglerBin,
    ["dev", "--config", join(tmp, "wrangler.json"), "--port", String(PORT),
      "--inspector-port", "9239", "--persist-to", join(root, ".wrangler", "state")],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const teardown = () => {
    dev.kill("SIGTERM");
    // wrangler's workerd grandchildren are not reliably killed by the parent
    // signal — find the port's listeners and kill by pid (workers/README).
    try {
      const out = execFileSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], {
        encoding: "utf8",
      });
      for (const pid of out.split("\n").filter(Boolean)) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          /* already gone */
        }
      }
    } catch {
      /* nothing listening — clean */
    }
    rmSync(tmp, { recursive: true, force: true });
  };

  try {
    const ready = Date.now() + 30_000;
    for (;;) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/`);
        if (res.status === 405) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > ready) throw new Error("seed worker did not become ready in 30s");
      await new Promise((r) => setTimeout(r, 250));
    }

    const POOL = 16;
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < objects.length) {
        const [key, file, contentType] = objects[next++];
        const res = await fetch(
          `http://127.0.0.1:${PORT}/?key=${encodeURIComponent(key)}&ct=${encodeURIComponent(contentType)}`,
          { method: "PUT", body: readFileSync(file) },
        );
        if (res.status !== 204) throw new Error(`seed put failed (${res.status}) for ${key}`);
        done += 1;
        if (done % 250 === 0) console.log(`  ${done}/${objects.length}`);
      }
    };
    await Promise.all(Array.from({ length: POOL }, worker));
  } finally {
    teardown();
  }
}
console.log("snapshot seeded");
