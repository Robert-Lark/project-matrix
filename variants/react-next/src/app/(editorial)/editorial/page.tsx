import type { Metadata } from "next";
import { cache } from "react";
import { loadFeatured, loadManifest } from "@/lib/edge";
import { EditorialArticle, Shell, essayFor } from "@/lib/render";

// Trays are fetched through the edge Worker at REQUEST time (SSR is the
// paradigm's real shape, ADR-0002 §7) — force-dynamic guarantees this route
// is never attempted at build time (no Cloudflare bindings exist then) and
// is re-rendered fresh on every request, matching "heavy hydration" as a
// genuine per-request cost, not a cached shortcut.
export const dynamic = "force-dynamic";

// generateMetadata and the page component both need this data; env.EDGE.fetch
// isn't the global `fetch` Next auto-memoizes, so React's own `cache` dedupes
// the two edge round-trips within one render pass (the documented pattern for
// non-fetch/non-global-fetch data access).
const loadPage = cache(async () => {
  const manifest = await loadManifest();
  const featured = await loadFeatured(manifest);
  return { manifest, featured, essay: essayFor(manifest.crate) };
});

export async function generateMetadata(): Promise<Metadata> {
  const { essay } = await loadPage();
  return { title: `${essay.title} — Long Decay Records` };
}

export default async function EditorialPage() {
  const { manifest, featured, essay } = await loadPage();

  return (
    <Shell current="editorial">
      <EditorialArticle essay={essay} featured={featured} capturedAt={manifest.capturedAt} />
    </Shell>
  );
}
