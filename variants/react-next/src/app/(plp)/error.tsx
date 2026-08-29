"use client";

import { PlpErrorPage } from "@/lib/plp-error";

/** Error boundaries must be Client Components (Next's file convention).
 *  Catches loadPlp failures (src/lib/edge.ts — pm-edge returning a non-2xx, or
 *  unreachable) so a visitor sees Long Decay Records' own chrome instead of
 *  Next's generic, unbranded fallback. Body shared by both PLP route groups —
 *  see src/lib/plp-error.tsx for why it is inlined rather than reusing Shell. */
export default function PlpError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <PlpErrorPage retry={unstable_retry} />;
}
