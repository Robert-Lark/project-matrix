/**
 * Origin build provenance (ADR-0001 addendum N hole 2, closed by the
 * bench-instrumentation-dilution unit): nothing used to tie a receipt's
 * `commit.sha` to the code the plane was actually serving — `commitPin`
 * reads the LOCAL checkout, and with `--origin` pointing at a remote plane
 * the SHA described the machine that drove the browser, not the tree under
 * measurement. A skeptic following `pnpm bench reproduce` could measure a
 * different tree than the receipt names, with no way to detect it.
 *
 * The front Worker now attests its build at `/_pm/build.json` (stamped by
 * the front build and re-stamped by the deploy and run-local paths, so a
 * turbo cache replay cannot ship a stale SHA silently). The runner fetches
 * it, records it in the receipt as `originCommit`, and REFUSES a batch or
 * probe whose origin SHA disagrees with the local pin — unless the operator
 * passes the explicit cross-tree escape, in which case the disagreement is
 * recorded in the artifact for anyone to see. Verification lives here, in
 * the library, so the reproduce path and direct imports hit the same wall
 * (the assertBenchableTarget precedent).
 */

export interface OriginCommit {
  sha: string;
  dirty: boolean;
}

/**
 * What the origin attests it is serving, or null when it does not attest
 * (no /_pm/build.json — a plane deployed before the attestation existed,
 * or a non-PM origin).
 */
export async function fetchOriginCommit(origin: string): Promise<OriginCommit | null> {
  let res: Response;
  try {
    res = await fetch(new URL("/_pm/build.json", origin));
  } catch (err) {
    throw new Error(
      `could not reach ${origin}/_pm/build.json to verify what the plane serves: ${
        err instanceof Error ? err.message : String(err)
      } (a TLS-intercepted machine may need NODE_EXTRA_CA_CERTS)`,
      { cause: err },
    );
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`${origin}/_pm/build.json answered ${res.status} — cannot verify the origin's build`);
  }
  const json = (await res.json()) as { sha?: unknown; dirty?: unknown };
  if (typeof json.sha !== "string" || !/^[0-9a-f]{40}$/.test(json.sha) || typeof json.dirty !== "boolean") {
    throw new Error(`${origin}/_pm/build.json is malformed — cannot verify the origin's build`);
  }
  return { sha: json.sha, dirty: json.dirty };
}

/**
 * The refusal (hole 2's mechanism). Returns what the receipt records.
 * `allowCrossTree` is the explicit escape for DELIBERATE cross-tree
 * measurement — the receipt then carries the mismatch (or the null) in
 * plain sight instead of a silent lie.
 */
export async function verifyOriginCommit(
  origin: string,
  localSha: string,
  allowCrossTree: boolean,
): Promise<OriginCommit | null> {
  const attested = await fetchOriginCommit(origin);
  if (attested === null) {
    if (!allowCrossTree) {
      throw new Error(
        `${origin} does not attest its build (no /_pm/build.json), so nothing ties this ` +
          `receipt's commit SHA to the code the plane serves (ADR-0001 addendum N hole 2). ` +
          `Pass the cross-tree escape (--allow-cross-tree) to measure it anyway — the ` +
          `receipt will record originCommit: null, visibly unattested.`,
      );
    }
    return null;
  }
  if (attested.sha !== localSha && !allowCrossTree) {
    throw new Error(
      `the origin is serving ${attested.sha.slice(0, 12)} but this checkout is ${localSha.slice(0, 12)} — ` +
        `the receipt would name a tree the plane is not running (ADR-0001 addendum N hole 2). ` +
        `Check out the deployed SHA, or pass --allow-cross-tree for a deliberate cross-tree ` +
        `measurement (the receipt records both SHAs, so the mismatch stays visible).`,
    );
  }
  return attested;
}
