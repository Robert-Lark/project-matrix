import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { ReleaseDetail } from "@pm/data-contract";
import { loadDetail } from "@/lib/edge";
import { PdpArticle } from "@/lib/pdp";
import { Shell } from "@/lib/render";

// Trays are fetched through the edge Worker at REQUEST time (SSR is the
// paradigm's real shape, ADR-0002 §7) — force-dynamic guarantees this route
// is never attempted at build time (no Cloudflare bindings exist then) and
// is re-rendered fresh on every request. NO loading.tsx and NO Suspense on
// this route, deliberately: streaming locks the HTTP status before
// `notFound()` can set it (Next's own docs, loading.md), and the slug
// contract below REQUIRES a real 404.
export const dynamic = "force-dynamic";

/**
 * The URL contract (pdp-build, settled): slug-keyed
 * /react-next/pdp/{id}-{artist}-{title}/. Parse the LEADING id, fetch the
 * tray, then verify the tray's slug equals the requested slug — any
 * mismatch is a 404, matching what static generation does by construction
 * (vanilla has no file at a non-canonical slug). A canonical 301 was
 * REJECTED: the build-time variants cannot serve one, so it would be an
 * observable behavioural divergence between paradigms on the very surface
 * that measures them.
 */
const loadPage = cache(async (slug: string): Promise<ReleaseDetail | null> => {
  const id = /^(\d{1,15})-/.exec(slug)?.[1];
  if (!id) return null;
  const detail = await loadDetail(Number(id));
  return detail && detail.slug === slug ? detail : null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = await loadPage(slug);
  // Never notFound() here: a notFound() thrown during METADATA resolution
  // bails to Next's own `__next_error__` document instead of the segment's
  // not-found boundary (measured on the composed plane — the 404 lost the
  // branded shell AND the chrome slot). The page component below owns the
  // throw; this only titles whichever page that produces.
  return {
    title: d
      ? `${d.title} — ${d.artist} — Long Decay Records`
      : "This record isn't in the crate — Long Decay Records",
  };
}

export default async function PdpPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await loadPage(slug);
  if (!detail) notFound();

  return (
    <Shell current="plp">
      <PdpArticle detail={detail} />
    </Shell>
  );
}
