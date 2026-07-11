/**
 * The cost CLI — `pnpm cost …` from the repo root (built by esbuild to
 * dist/cli.mjs).
 *
 *   pnpm cost from-receipt <receipt.json> \
 *     --card tools/cost-calculator/ratecards/2026-07-10-usd.json \
 *     --cache-hit 0.9 --region us-east \
 *     --architecture-host cloudflare-workers-paid \
 *     --host /placeholder-static/sample/=cloudflare-workers-paid \
 *     --host /placeholder-ssr/sample/=cloudflare-workers-paid \
 *     [--monthly-visits 3000] [--out report.json]
 *
 * Cache-hit ratio, region, the architecture-only host, and the per-target
 * real-world hosts are all REQUIRED — the §7 assumptions are explicit
 * calculator inputs, never defaults hidden in code.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseReceipt } from "@pm/bench-runner/receipt";
import { computeCostReport } from "./cost";
import { parseRateCard } from "./ratecard";
import { renderReport } from "./render";
import type { CostReportT } from "./report";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function writeReport(report: CostReportT, out: string | undefined): void {
  const path =
    out ??
    join(
      repoRoot,
      "tools/cost-calculator/reports",
      `cost-report-${report.date.replace(/[:.]/g, "-")}.json`,
    );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
  console.error(`report: ${path}`);
}

function main(): number {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "from-receipt") {
    console.error("usage: cost from-receipt <receipt.json> …  (see tools/cost-calculator/README.md)");
    return 2;
  }
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      card: { type: "string" },
      "cache-hit": { type: "string" },
      region: { type: "string" },
      "architecture-host": { type: "string" },
      host: { type: "string", multiple: true },
      "monthly-visits": { type: "string" },
      out: { type: "string" },
    },
  });
  const receiptPath = positionals[0];
  // An empty string must not slip past as a value: Number("") is 0, which
  // would silently price cold-only (a hidden default, against AC3).
  const blank = (v: string | undefined) => v === undefined || v.trim() === "";
  if (!receiptPath || blank(values.card) || blank(values["cache-hit"]) || blank(values.region) || blank(values["architecture-host"]) || !values.host?.length) {
    console.error(
      "from-receipt requires <receipt.json>, --card, --cache-hit, --region, --architecture-host, and one --host <path>=<hostId> per target — the assumptions are explicit inputs, never defaults (empty values are refused)",
    );
    return 2;
  }
  if (values["monthly-visits"] !== undefined && values["monthly-visits"].trim() === "") {
    console.error("--monthly-visits must carry a number when given — an empty value is not 0 visits");
    return 2;
  }
  const realWorldHosts: Record<string, string> = {};
  for (const pair of values.host) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      console.error(`--host expects <target-path>=<hostId>, got "${pair}"`);
      return 2;
    }
    const path = pair.slice(0, eq);
    if (path in realWorldHosts) {
      console.error(
        `--host maps "${path}" twice (${realWorldHosts[path]} and ${pair.slice(eq + 1)}) — a duplicate mapping is refused, not last-wins`,
      );
      return 2;
    }
    realWorldHosts[path] = pair.slice(eq + 1);
  }
  // The blank() guard above proves these are present; TS can't see through it.
  const cacheHitRatio = Number(values["cache-hit"]!);
  const receipt = parseReceipt(JSON.parse(readFileSync(receiptPath, "utf8")));
  const card = parseRateCard(JSON.parse(readFileSync(values.card!, "utf8")));
  const report = computeCostReport({
    receipt,
    card,
    assumptions: { cacheHitRatio, region: values.region! },
    architectureHostId: values["architecture-host"]!,
    realWorldHosts,
    monthlyVisits:
      values["monthly-visits"] === undefined ? undefined : Number(values["monthly-visits"]),
    date: new Date().toISOString(),
  });
  writeReport(report, values.out);
  console.log(renderReport(report));
  return 0;
}

process.exit(main());
