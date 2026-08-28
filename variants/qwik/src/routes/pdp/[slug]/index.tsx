import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { PdpArticle } from "../../../components/PdpArticle";
import { Shell } from "../../../components/Shell";
import { type EdgeEnv, loadPdpDetail, projectPdpDetail } from "../../../lib/edge";

/**
 * /qwik/pdp/{slug}/ — resumability on the surface where interactivity is
 * genuine (pdp-variants slice 3).
 *
 * The URL contract (pdp-build, settled): parse the LEADING id, fetch the
 * tray through the variant's own EDGE binding at request time, verify the
 * tray's slug equals the requested slug — any mismatch is a 404 via
 * `fail()`, matching what static generation does by construction; a
 * canonical 301 was REJECTED (build-time variants cannot serve one).
 * `fail(404)` keeps the visitor inside Long Decay Records' own chrome —
 * this variant CAN brand its 404 server-side, where react-next's
 * multiple-root-layout structure defers its branded boundary to hydration;
 * the STATUS is the cross-paradigm contract, the body is each variant's own
 * (both recorded). The loader PROJECTS to the fields the page renders (the
 * editorial projectFeatured reasoning: the whole loader result rides this
 * route's q-data.json to client-nav visitors).
 */
export const usePdp = routeLoader$(async ({ params, platform, fail }) => {
  const id = /^(\d{1,15})-/.exec(params.slug)?.[1];
  if (!id) return fail(404, { notFound: true as const });
  try {
    const detail = await loadPdpDetail(platform.env as unknown as EdgeEnv, Number(id));
    if (!detail || detail.slug !== params.slug) {
      return fail(404, { notFound: true as const });
    }
    return { detail: projectPdpDetail(detail) };
  } catch {
    // A live data-plane failure is a real runtime state on a request-time
    // variant: branded 503 inside the store's own chrome (the editorial
    // route's shape), never qwik-city's unbranded error page.
    return fail(503, { unavailable: true as const });
  }
});

export default component$(() => {
  const pdp = usePdp();

  if (pdp.value.failed) {
    return pdp.value.notFound ? (
      <Shell>
        <div class="pm-pdp">
          <h1>{"This record isn't in the crate"}</h1>
          <p>
            {"No release in the frozen snapshot matches this address. The catalogue is fixed at capture time — a link that changed is a link that broke, honestly."}
          </p>
          <p>
            <a href="/react-next/plp/plain/">Back to all records</a>
          </p>
        </div>
      </Shell>
    ) : (
      <Shell current="plp">
        <div class="pm-pdp">
          <h1>{"This page couldn't load"}</h1>
          <p>
            {"The store's data plane didn't answer. This is a simulated demo storefront — nothing was ordered, nothing was lost."}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell current="plp">
      <PdpArticle detail={pdp.value.detail} />
    </Shell>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const pdp = resolveValue(usePdp);
  if (pdp.failed) {
    return {
      title: pdp.notFound
        ? "This record isn't in the crate — Long Decay Records"
        : "This page couldn't load — Long Decay Records",
    };
  }
  return { title: `${pdp.detail.title} — ${pdp.detail.artist} — Long Decay Records` };
};
