// The editorial page — the canonical markup contract
// (packages/reference/surfaces/editorial/ is the spec of record) rendered by
// Remix 3 Handle components, plus this exhibit's TWO fenced subtrees: the
// plaque (the boundary, top of main — the label reads before the content,
// the a11y-section label-first principle) and the frames demo (the paradigm,
// after the article — the store wins the page, apparatus is the appendix).
// Everything outside [data-pm-fenced] is the master's DOM: the fence
// excludes NUMBERS, not visual identity (FINDINGS §4).
//
// The cart data hook rides a JSON script element (delivery, not contract —
// ADR-0008 freedoms) through the serializer's typed innerHTML escape hatch:
// script content is RAWTEXT in HTML, so entity-escaped children would
// corrupt the JSON; `<` is escaped as < so a tray string can never
// close the element early (the htmx precedent).
import type { Handle } from "remix/ui";

import { CRATE_ESSAY, FIXTURE_ESSAY } from "../lib/essays.tsx";
import type { Detail } from "../lib/format.ts";
import { ASSETS, Document } from "./document.tsx";
import { FrontierDemo } from "./frontier-demo.tsx";
import { FrontierPlaque } from "./plaque.tsx";
import { ReleaseCard } from "./release-card.tsx";

export interface EditorialData {
  isFixture: boolean;
  capturedAt: string;
  featured: Detail;
}

export function EditorialPage(handle: Handle<{ data: EditorialData; pick: number }>) {
  return () => {
    const { data, pick } = handle.props;
    const essay = data.isFixture ? FIXTURE_ESSAY : CRATE_ESSAY;
    const featured = data.featured;

    // The one figure sits after the opening paragraph (contract of record).
    const figureImg = featured.images[1] ?? featured.images[0]!;
    const blocks = essay.body(featured);
    const label = featured.labels[0];
    const figure = (
      <figure>
        <img
          src={figureImg.src}
          width={String(figureImg.width)}
          height={String(figureImg.height)}
          alt={figureImg.alt}
          loading="lazy"
          decoding="async"
        />
        <figcaption>
          {featured.artist}
          {" — "}
          {featured.title}
          {" ("}
          {label?.name ?? ""}
          {label?.catno ? ` · ${label.catno}` : null}
          {"), from the frozen snapshot."}
        </figcaption>
      </figure>
    );
    const prose = [blocks[0], figure, ...blocks.slice(1)];

    const cartItem = JSON.stringify({ id: featured.id, title: featured.title }).replace(
      /</g,
      "\\u003c",
    );

    const scripts = (
      <>
        <script type="application/json" id="pm-cart-item" innerHTML={cartItem}></script>
        <script type="module" src={`${ASSETS}/entry.js`}></script>
        <script src={`${ASSETS}/cart.js`} defer></script>
      </>
    );

    return (
      <Document title={`${essay.title} — Long Decay Records`} scripts={scripts}>
        <FrontierPlaque />
        <article class="pm-editorial">
          <header class="pm-editorial__head">
            <p class="pm-page__kicker">{essay.kicker}</p>
            <h1 class="pm-editorial__title">{essay.title}</h1>
            <p class="pm-editorial__dek">{essay.dek}</p>
            <p class="pm-editorial__dateline">
              {"From the crate · frozen "}
              <time datetime={data.capturedAt}>{data.capturedAt}</time>
            </p>
          </header>
          <div class="pm-prose">{prose}</div>
          <aside class="pm-editorial__feature" aria-label="Featured release">
            <ul class="pm-grid" role="list">
              <ReleaseCard release={featured} />
            </ul>
            <div class="pm-editorial__feature-body">
              <p class="pm-editorial__feature-note">{essay.featureNote(featured)}</p>
              <div>
                <button class="pm-button" type="button" disabled={featured.numForSale === 0}>
                  {"Add to cart"}
                </button>
              </div>
              <p class="pm-editorial__feature-note">
                {"The only interactive element on this page — that's the experiment."}
              </p>
            </div>
          </aside>
        </article>
        <FrontierDemo pick={pick} />
      </Document>
    );
  };
}
