/**
 * The commit pin (ADR-0001 §9): numbers are published as dated snapshots
 * tied to commit SHAs. A dirty tree is recorded honestly — a receipt that
 * hides uncommitted changes would be the opposite of anti-rigging.
 */
import { execFileSync } from "node:child_process";

export function commitPin(cwd: string): { sha: string; dirty: boolean } {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  return {
    sha: git("rev-parse", "HEAD"),
    dirty: git("status", "--porcelain").length > 0,
  };
}
