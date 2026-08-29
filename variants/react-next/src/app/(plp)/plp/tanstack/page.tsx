import type { Metadata } from "next";
import { loadPlp } from "@/lib/edge";
import { conditionFromSearchParams } from "@/lib/plp-condition";
import { Shell } from "@/lib/render";
import { PlpTanstack } from "@/components/PlpTanstack";

// Request-time SSR, exactly as the plain route — see its comment. The ONE
// difference between this route and that one is the client data layer the
// island mounts, which is the point: ADR-0005 §1's "exactly one architectural
// move" holds within the React/Next build, and this is the move.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Records — Long Decay Records" };

/** The "Client cache — TanStack Query" preset. Always served with the edge
 *  tier bypassed in the comparison cells (`?cache=cold`), so the client layer
 *  is the only delta against the cold arm. */
export default async function PlpTanstackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const condition = conditionFromSearchParams(await searchParams);
  const initial = await loadPlp(condition);

  return (
    <Shell current="plp">
      <PlpTanstack initial={initial} condition={condition} />
    </Shell>
  );
}
