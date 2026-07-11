/**
 * Plain-text rendering of a cost report — the published arithmetic in
 * readable form (ADR-0001 §7 "publish the arithmetic"). The JSON report is
 * the artifact; this is the same content for a terminal.
 */
import type { CostReportT, PricedTargetT } from "./report";

function money(n: number | null): string {
  if (n === null) return "unavailable";
  // A tiny nonzero must never display as the load-bearing "$0" — same
  // small-number path as cost.ts's fmt().
  if (n !== 0 && Math.abs(n) < 1e-4) return `$${n.toExponential(4).replace(/\.?0+e/, "e")}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
}

function renderTarget(t: PricedTargetT): string[] {
  const out: string[] = [];
  out.push(`  ${t.path} (variant=${t.variant}, surface=${t.surface}) on ${t.hostId}`);
  for (const line of t.lines) {
    out.push(`    ${line.meter}: ${money(line.costUsdPer1MVisits)} /1M visits`);
    out.push(`      ${line.arithmetic}`);
    if (line.rate.note) out.push(`      assumption: ${line.rate.note}`);
  }
  if (t.unpriced.length > 0) {
    out.push(
      `    UNPRICED (never estimated): ${t.unpriced.map((u) => u.meter).join(", ")} — priced subtotal ${money(t.pricedSubtotalUsdPer1MVisits)} is PARTIAL`,
    );
  }
  if (t.unmeasuredMeters.length > 0) {
    out.push(
      `    not in the measured profile (see method notes): ${t.unmeasuredMeters.join(", ")}`,
    );
  }
  out.push(`    total: ${money(t.totalUsdPer1MVisits)} per 1M visits`);
  return out;
}

export function renderReport(report: CostReportT): string {
  const out: string[] = [];
  out.push(`pm-cost-report ${report.date}`);
  out.push(
    `measurement: receipt ${report.input.receiptDate} @ ${report.input.commit.sha.slice(0, 10)}${report.input.commit.dirty ? " (dirty)" : ""} — origin ${report.input.origin}, profile ${report.input.profileId}, n=${report.input.n}, runs=${report.input.runsPerUrl}, location ${report.input.runLocation}`,
  );
  out.push(
    `prices: rate card "${report.card.id}" captured ${report.card.capturedAt} (${report.card.verifiedBy})`,
  );
  out.push(
    `assumptions: cache-hit ratio ${report.assumptions.cacheHitRatio}, region ${report.assumptions.region}`,
  );
  out.push(`  ${report.assumptions.visitDefinition}`);
  for (const note of report.assumptions.notes) out.push(`  ${note}`);
  out.push("");
  out.push(`ARCHITECTURE-ONLY (every variant on ${report.views.architectureOnly.hostId}):`);
  for (const t of report.views.architectureOnly.targets) out.push(...renderTarget(t));
  out.push("");
  out.push("REAL-WORLD (each variant on its stated host):");
  for (const t of report.views.realWorld.targets) out.push(...renderTarget(t));
  if (report.actual) {
    out.push("");
    out.push(`ACTUAL CHARGE at ${report.actual.monthlyVisits.toLocaleString("en-US")} visits/month:`);
    out.push(`  ${report.actual.split}`);
    for (const host of report.actual.hosts) {
      out.push(`  ${host.hostId} (${host.targetPaths.join(", ")}):`);
      if (host.freePlan) {
        out.push(`    ${host.freePlan.plan}: charge ${money(host.freePlan.chargeUsd)}`);
        for (const check of host.freePlan.checks) out.push(`      ${check.meter}: ${check.arithmetic}`);
        out.push(`      ${host.freePlan.arithmetic}`);
      }
      out.push(`    ${host.paidPlan.plan}: ${money(host.paidPlan.totalUsd)}/month`);
      for (const line of host.paidPlan.lines) out.push(`      ${line.meter}: ${line.arithmetic}`);
      out.push(`      ${host.paidPlan.arithmetic}`);
    }
  }
  out.push("");
  out.push("method notes (limits of data):");
  for (const note of report.methodNotes) out.push(`  - ${note}`);
  return out.join("\n") + "\n";
}
