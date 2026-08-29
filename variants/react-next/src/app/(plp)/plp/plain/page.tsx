import type { Metadata } from "next";
import { loadPlp } from "@/lib/edge";
import { conditionFromSearchParams } from "@/lib/plp-condition";
import { Shell } from "@/lib/render";
import { PlpPlain } from "@/components/PlpPlain";

// Trays are fetched through the edge Worker at REQUEST time (SSR is the
// paradigm's real shape, ADR-0002 §7) — force-dynamic guarantees this route is
// never attempted at build time (no Cloudflare bindings exist then) and is
// re-rendered fresh on every request. It is also what makes `?cache=` mean
// anything: a cached render would serve one warmth under both presets.
//
// NO loading.tsx and NO Suspense here, the PDP route's rule: streaming locks
// the HTTP status before an error boundary can set one.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Records — Long Decay Records" };

/** Serves BOTH switcher presets — "No caching (cold)" at `?cache=cold` and
 *  "Edge cache — KV" with no query. Byte-identical shipped code, one
 *  architectural variable (ADR-0005 §1: the purest cell on the site). */
export default async function PlpPlainPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const condition = conditionFromSearchParams(await searchParams);
  const initial = await loadPlp(condition);

  return (
    <Shell current="plp">
      <PlpPlain initial={initial} condition={condition} />
    </Shell>
  );
}
