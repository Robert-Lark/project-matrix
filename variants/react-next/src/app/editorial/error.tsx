"use client";

import { Shell } from "@/lib/render";

/** Error boundaries must be Client Components (Next's file convention).
 *  Catches loadManifest/loadFeatured failures (src/lib/edge.ts — pm-edge
 *  returning a non-2xx, or unreachable) so a visitor sees Long Decay
 *  Records' own chrome instead of Next's generic, unbranded fallback
 *  (verify-slice finding: this is the first request-time variant in the
 *  matrix, and nothing forced this path before). Deliberately does NOT
 *  re-fetch anything itself — Shell has no data dependency of its own, so
 *  wrapping this message in it can't itself throw the same error again. */
export default function EditorialError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <Shell current="editorial">
      <div className="pm-editorial">
        <p className="pm-page__kicker">Staff pick</p>
        <h1>This page couldn&apos;t load</h1>
        <p>
          The store&apos;s data plane didn&apos;t answer. This is a simulated demo storefront —
          nothing was ordered, nothing was lost.
        </p>
        <button className="pm-button" type="button" onClick={() => unstable_retry()}>
          Try again
        </button>
      </div>
    </Shell>
  );
}
