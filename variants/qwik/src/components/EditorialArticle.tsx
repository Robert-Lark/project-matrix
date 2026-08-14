import type { FeaturedRelease } from "../lib/edge";
import { formatPrice, metaLine, stockLine } from "../lib/format";
import type { Essay } from "../lib/essays";
import { HOSTS } from "../lib/hosts";
import { AddToCartButton } from "./AddToCartButton";

/**
 * The article and the feature card, as Qwik INLINE components — plain
 * functions returning JSX rather than `component$()`.
 *
 * That is a deliberate, idiomatic choice, not a shortcut: Qwik's own guidance
 * is that inline components suit small presentational markup. An inline
 * component is not a lazy boundary, so it adds no lazy chunk and no serialized
 * props to the resumability payload — and neither of these has any
 * interactivity to defer. The three pieces that DO
 * (`CartCount`/`CartStatus`/`AddToCartButton`) are real `component$`
 * boundaries, so the lazy chunks the page ships are the interactive ones and
 * nothing else.
 *
 * It does NOT follow that inline markup is free of Qwik's bookkeeping
 * attributes — an earlier draft of this comment claimed exactly that and the
 * served page disproves it: `<article class="pm-editorial">`, the
 * `<blockquote>` below, and `<li class="pm-release-card">` all carry a `q:key`
 * the optimizer assigned to their JSX nodes. That is registered noise
 * (`PERMITTED_NOISE["qwik"]`, whose audit note records the measurement), not a
 * reason to avoid inline components.
 */
function ReleaseCard({ release }: { release: FeaturedRelease }) {
  const price = formatPrice(release.priceFrom);
  const c = release.cover;
  return (
    <li class="pm-release-card">
      <img
        class="pm-release-card__media"
        width={c.width}
        height={c.height}
        alt={c.alt}
        src={c.src}
      />
      <div class="pm-release-card__body">
        <h3 class="pm-release-card__title">
          <a class="pm-release-card__link" href={HOSTS.pdp(release.slug)}>
            {release.title}
          </a>
        </h3>
        <p class="pm-release-card__artist">{release.artist}</p>
        <p class="pm-release-card__meta">{metaLine(release)}</p>
        <div class="pm-release-card__foot">
          <span class="pm-release-card__price">{price ?? (<><span aria-hidden="true">—</span><span class="pm-sr-only">No price listed</span></>)}</span>
          <span class="pm-release-card__stock">{stockLine(release.numForSale)}</span>
        </div>
      </div>
    </li>
  );
}

/** The article: prose plus exactly one interaction (ADR-0008). `capturedAt`
 *  is the served manifest's freeze date — the dateline is always tool output,
 *  never typed. */
export function EditorialArticle({
  essay,
  featured,
  capturedAt,
}: {
  essay: Essay;
  featured: FeaturedRelease;
  capturedAt: string;
}) {
  const figureImg = featured.images[1] ?? featured.images[0]!;
  const catno = featured.labels[0]?.catno;

  return (
    <article class="pm-editorial">
      <header class="pm-editorial__head">
        <p class="pm-page__kicker">{essay.kicker}</p>
        <h1 class="pm-editorial__title">{essay.title}</h1>
        <p class="pm-editorial__dek">{essay.dek}</p>
        <p class="pm-editorial__dateline">
          {"From the crate · frozen "}
          {/* `datetime`, lowercase, is what the master serves and what Qwik
              emits — it passes attribute names through verbatim, so authoring
              the DOM-property spelling (`dateTime`, which react-next ships)
              would put a differently spelled attribute in the served bytes.
              Measured, not assumed. It reaches JSX through a spread because
              Qwik's `<time>` types expose only `dateTime`; the same escape
              `root.tsx` needs for `crossorigin`, and `editorial.test.ts`
              asserts the served spelling either way. */}
          <time {...{ datetime: capturedAt }}>{capturedAt}</time>
        </p>
      </header>
      <div class="pm-prose">
        <p>{essay.opening(featured)}</p>
        <figure>
          <img
            src={figureImg.src}
            width={figureImg.width}
            height={figureImg.height}
            alt={figureImg.alt}
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            {`${featured.artist} — ${featured.title} (${featured.labels[0]?.name ?? ""}${catno ? ` · ${catno}` : ""}), from the frozen snapshot.`}
          </figcaption>
        </figure>
        {/* No JSX `key`: Qwik serializes one as a `q:key` ATTRIBUTE on the
            element (React's does not render at all), so a key here would put
            variant-authored noise on contract elements. This list is a
            constant — never reordered, never re-rendered — so nothing needs
            one. */}
        {essay.body(featured).map((block) =>
          block.kind === "blockquote" ? (
            <blockquote>
              <p>{block.content}</p>
            </blockquote>
          ) : (
            <p>{block.content}</p>
          ),
        )}
      </div>
      <aside class="pm-editorial__feature" aria-label="Featured release">
        <ul class="pm-grid" role="list">
          <ReleaseCard release={featured} />
        </ul>
        <div class="pm-editorial__feature-body">
          <p class="pm-editorial__feature-note">{essay.featureNote}</p>
          <AddToCartButton
            id={featured.id}
            title={featured.title}
            disabled={featured.numForSale === 0}
          />
          <p class="pm-editorial__feature-note">
            {"The only interactive element on this page — that's the experiment."}
          </p>
        </div>
      </aside>
    </article>
  );
}
