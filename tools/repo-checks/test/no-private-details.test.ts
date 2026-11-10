/**
 * Nothing private to Rob or to an employer in the tracked tree (2026-11-10).
 *
 * This repo is public. Two kinds of private detail reached it anyway:
 *  - a prototype lockfile minted through an org-internal npm mirror, so all
 *    89 of its `resolved` URLs named that mirror's host and cloud account.
 *    The root `.npmrc` pins the public registry, but a prototype under
 *    `docs/prototypes/` is its own npm project root and the pin does not
 *    reach it. `data-strategy-lab` hit this first and fixed it with a local
 *    `.npmrc`; `cf-composition` had the same fault and nothing caught it;
 *  - a personal mailbox address, written into three docs as the blog's
 *    login identity.
 *
 * Both were removed on 2026-11-10. This guard keeps them out, because the
 * first one had already happened twice.
 *
 * Non-vacuity: the lockfile rule must see every npm lockfile the tree holds
 * and at least one `resolved` entry in each, and both predicates are proved
 * on planted strings.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const PUBLIC_REGISTRY = "registry.npmjs.org";
const NPM_LOCKFILE = /(^|\/)(package-lock|npm-shrinkwrap)\.json$/;

/** Consumer mailbox domains: an address at one of these is a person's own. */
const PERSONAL_MAILBOX = /[A-Za-z0-9._%+-]+@(gmail|googlemail|icloud|me|outlook|hotmail|yahoo|proton|protonmail)\.[a-z.]{2,}/;

/** The frozen crate is Discogs' own release text, hashed by the manifest (ADR-0002). */
const EXEMPT: readonly RegExp[] = [/^tools\/snapshot-capture\/crate\//];

/** Hosts named by a lockfile's `resolved` entries, with how often each appears. */
export function resolvedHosts(lockfileText: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of lockfileText.matchAll(/"resolved":\s*"[a-z+]+:\/\/([^/"]+)/g)) {
    const host = m[1] as string;
    out.set(host, (out.get(host) ?? 0) + 1);
  }
  return out;
}

export function mailboxLines(text: string): number[] {
  const out: number[] = [];
  text.split("\n").forEach((line, i) => {
    if (PERSONAL_MAILBOX.test(line)) out.push(i + 1);
  });
  return out;
}

function isText(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  return Buffer.from(buf.toString("utf8"), "utf8").equals(buf);
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

describe("no private details in the public tree (2026-11-10)", () => {
  it("the predicates are live: planted strings are reported", () => {
    const planted = [
      '"resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz",',
      '"resolved": "https://mirror.internal.example/npm/a/-/a-1.0.0.tgz",',
      '"resolved": "https://mirror.internal.example/npm/b/-/b-1.0.0.tgz",',
    ].join("\n");
    expect([...resolvedHosts(planted)]).toEqual([
      [PUBLIC_REGISTRY, 1],
      ["mirror.internal.example", 2],
    ]);
    // Split so this file does not itself carry the shape the rule forbids.
    expect(mailboxLines(`one\nwrite to someone@${"gmail"}.com\nthree`)).toEqual([2]);
    expect(mailboxLines("a@users.noreply.github.com\nb@example.com")).toEqual([]);
  });

  it("every npm lockfile resolves from the public registry and nowhere else", () => {
    const lockfiles = trackedFiles().filter((f) => NPM_LOCKFILE.test(f));
    // Non-vacuity: the three prototype lockfiles are still here to be checked.
    expect(lockfiles.length).toBeGreaterThanOrEqual(3);
    const bad: string[] = [];
    for (const f of lockfiles) {
      const hosts = resolvedHosts(readFileSync(join(repoRoot, f), "utf8"));
      // Non-vacuity: a lockfile with no `resolved` entry proves nothing.
      expect(hosts.size, `${f} has no resolved entries`).toBeGreaterThan(0);
      for (const [host, n] of hosts) {
        // Report the count, never the host: the failure message is public in CI logs.
        if (host !== PUBLIC_REGISTRY) bad.push(`${f}: ${n} entries resolve from a host other than ${PUBLIC_REGISTRY}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no tracked text file carries a personal mailbox address", () => {
    const files = trackedFiles();
    // Non-vacuity: this is the repo, not an empty checkout.
    expect(files.length).toBeGreaterThan(500);
    const bad: string[] = [];
    for (const f of files) {
      if (EXEMPT.some((re) => re.test(f))) continue;
      let buf: Buffer;
      try {
        buf = readFileSync(join(repoRoot, f));
      } catch {
        continue; // a symlink to a directory, or a file removed mid-run
      }
      if (!isText(buf)) continue;
      // Report the place, never the address: the failure message is public in CI logs.
      for (const line of mailboxLines(buf.toString("utf8"))) bad.push(`${f}:${line}`);
    }
    expect(bad).toEqual([]);
  });
});
