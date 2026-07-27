import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { EditorialArticle } from "../../components/EditorialArticle";
import { Shell } from "../../components/Shell";
import { type EdgeEnv, loadEditorialData, projectFeatured } from "../../lib/edge";
import { essayFor } from "../../lib/essays";
import { isFixtureCrate } from "../../lib/snapshot";

/**
 * Trays are fetched through the edge Worker at REQUEST time — SSR is this
 * paradigm's real shape on this surface (ADR-0002 §7), and `routeLoader$` is
 * Qwik City's own mechanism for server data a route needs before it renders.
 *
 * The payload is PROJECTED to the fields the page actually renders, not passed
 * through whole — and the reason is narrower than it first looks, because it
 * was measured rather than assumed. The initial page's inline resumability
 * state (`<script type="qwik/json">`) does NOT carry loader results: it is 339
 * bytes, holding only the cart store and the props of the three `component$`
 * boundaries. What DOES carry the whole loader result is the route's
 * client-navigation payload, `/qwik/editorial/q-data.json` (955 bytes with
 * this projection) — so returning the entire detail tray would ship the
 * tracklist, every image variant, and every field this surface never shows to
 * any visitor who reaches this page through a Qwik City link. Projecting is
 * both the idiomatic loader shape and the honest one, and it does not change a
 * single rendered byte.
 *
 * `fail()` on an edge error rather than a thrown exception: this is the
 * matrix's second request-time variant, so a live data-plane failure is a real
 * runtime state (slice B added the equivalent branded fallback for react-next,
 * where nothing had forced that path before). A failure keeps the visitor
 * inside Long Decay Records' own chrome and returns 503 rather than rendering
 * Qwik City's unbranded error page.
 */
export const useEditorial = routeLoader$(async ({ platform, fail }) => {
  try {
    const data = await loadEditorialData(platform.env as unknown as EdgeEnv);
    return {
      capturedAt: data.capturedAt,
      isFixture: isFixtureCrate(data.crate),
      featured: projectFeatured(data.featured),
    };
  } catch {
    return fail(503, { unavailable: true as const });
  }
});

export default component$(() => {
  const editorial = useEditorial();

  if (editorial.value.failed) {
    return (
      <Shell current="editorial">
        <div class="pm-editorial">
          <p class="pm-page__kicker">Staff pick</p>
          <h1>This page couldn't load</h1>
          <p>
            The store's data plane didn't answer. This is a simulated demo storefront — nothing was
            ordered, nothing was lost.
          </p>
        </div>
      </Shell>
    );
  }

  const { capturedAt, isFixture, featured } = editorial.value;
  return (
    <Shell current="editorial">
      <EditorialArticle
        essay={essayFor(isFixture)}
        featured={featured}
        capturedAt={capturedAt}
      />
    </Shell>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const editorial = resolveValue(useEditorial);
  const title = editorial.failed
    ? "This page couldn't load"
    : essayFor(editorial.isFixture).title;
  return { title: `${title} — Long Decay Records` };
};
