import type { Metadata } from "next";
import { loadPlp } from "@/lib/edge";
import { conditionFromSearchParams } from "@/lib/plp-condition";
import { PlpApolloPlaque } from "@/lib/plp-fence";
import { Shell } from "@/lib/render";
import { PlpApollo } from "@/components/PlpApollo";

// Request-time SSR, exactly as the two benchmarked routes — see the plain
// route's comment.
export const dynamic = "force-dynamic";

// CONSIDERED AND REJECTED: `robots: { index: false }` on the exhibit. It reads
// sensible — a deliberately-wrong-tool page is not a catalogue result — but it
// would be the repo's FIRST indexing policy, set unilaterally inside one
// variant. Verified before deciding: no robots.txt exists under workers/front,
// no variant sets robots metadata anywhere (grep across variants/*/src returns
// nothing), and the only master carrying `<meta name="robots">` is
// a11y/element-demos. The established FENCED precedent — remix3, the frontier
// exhibit — does not noindex either. Indexing is a site-wide decision, and the
// fencing mechanism this repo actually uses is on-surface labeling plus number
// exclusion, not search-engine policy.
export const metadata: Metadata = { title: "Records — Long Decay Records" };

/**
 * The FENCED misapplication exhibit (ADR-0005 §7). The plaque is rendered
 * FIRST, label before the thing it labels — the remix3 precedent ("the plaque
 * (top of main, label-first)"). It is the only element on any PLP route
 * carrying `data-pm-fenced`, and the pre-merge guard asserts exactly that: one
 * here, zero on plain and tanstack.
 */
export default async function PlpApolloPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const condition = conditionFromSearchParams(await searchParams);
  const initial = await loadPlp(condition);

  return (
    <Shell current="plp">
      <PlpApolloPlaque />
      <PlpApollo initial={initial} condition={condition} />
    </Shell>
  );
}
