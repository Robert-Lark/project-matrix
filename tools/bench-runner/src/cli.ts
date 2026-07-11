/**
 * The bench CLI — `pnpm bench …` from the repo root (built by esbuild to
 * dist/cli.mjs; playwright stays external).
 *
 *   pnpm bench run --origin http://127.0.0.1:8787 \
 *     --targets /placeholder-static/sample/,/placeholder-ssr/sample/ \
 *     --profile avg-broadband-desktop [--runs 7] [--n 24] \
 *     [--interaction body-click] [--local-cpu] [--out receipts/x.json]
 *
 *   pnpm bench reproduce <receipt.json> [--origin …] [--local-cpu] [--out …]
 *
 * `reproduce` is the ADR-0001 §9 one-command path: it re-runs the receipt's
 * batch — same URLs, profile, run count, as one batch — and emits a NEW
 * receipt (fresh date, fresh run nonce, current SHA).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { runBatch, specFromReceipt, type BatchSpec } from "./batch";
import { InspectorCpuSource, LOCAL_PLANE_INSPECTORS } from "./cpu";
import { parseReceipt, type ReceiptT } from "./receipt";

// fileURLToPath, not URL.pathname: pathname keeps percent-encoding, which
// would break the default receipt path under a checkout containing spaces.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function writeReceipt(receipt: ReceiptT, out: string | undefined): void {
  const path =
    out ??
    join(
      repoRoot,
      "tools/bench-runner/receipts",
      `receipt-${receipt.date.replace(/[:.]/g, "-")}.json`,
    );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(receipt, null, 2) + "\n");
  console.log(path);
}

function cpuSource(local: boolean) {
  return local ? new InspectorCpuSource(LOCAL_PLANE_INSPECTORS) : undefined;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "run") {
    const { values } = parseArgs({
      args: rest,
      options: {
        origin: { type: "string", default: "http://127.0.0.1:8787" },
        targets: { type: "string" },
        profile: { type: "string" },
        runs: { type: "string", default: "7" },
        n: { type: "string" },
        interaction: { type: "string", default: "body-click" },
        "local-cpu": { type: "boolean", default: false },
        out: { type: "string" },
      },
    });
    if (!values.targets || !values.profile) {
      console.error("run requires --targets and --profile");
      return 2;
    }
    const spec: BatchSpec = {
      origin: values.origin,
      targets: values.targets.split(",").map((path) => ({
        path,
        // Only pages get the scripted interaction; bare data URLs get none.
        interactionId: path.startsWith("/api/") ? "none" : values.interaction,
      })),
      profileId: values.profile,
      runsPerUrl: parseInt(values.runs, 10),
      n: values.n === undefined ? undefined : parseInt(values.n, 10),
      repoRoot,
      cpuSource: cpuSource(values["local-cpu"]),
    };
    writeReceipt(await runBatch(spec), values.out);
    return 0;
  }

  if (command === "reproduce") {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        origin: { type: "string" },
        "local-cpu": { type: "boolean", default: false },
        out: { type: "string" },
      },
    });
    const receiptPath = positionals[0];
    if (!receiptPath) {
      console.error("reproduce requires a receipt path");
      return 2;
    }
    const receipt = parseReceipt(JSON.parse(readFileSync(receiptPath, "utf8")));
    const spec = specFromReceipt(receipt, repoRoot, {
      origin: values.origin,
      cpuSource: cpuSource(values["local-cpu"]),
    });
    writeReceipt(await runBatch(spec), values.out);
    return 0;
  }

  console.error("usage: bench <run|reproduce> …  (see tools/bench-runner/README.md)");
  return 2;
}

process.exit(await main());
