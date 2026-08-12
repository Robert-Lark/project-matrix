// The canonical release card (packages/tokens/css/components/release-card.css
// anatomy; packages/reference/render/shell.mjs releaseCard is the contract of
// record), rendered from the featured release's DETAIL tray — the
// request-time shape. Card link absolute to the PDP's designated host.
import type { Handle } from "remix/ui";

import { formatPrice, metaLine, stockLine, type Detail } from "../lib/format.ts";

export function ReleaseCard(handle: Handle<{ release: Detail }>) {
  return () => {
    const release = handle.props.release;
    const price = formatPrice(release.priceFrom);
    const c = release.cover;

    return (
      <li class="pm-release-card">
        <img
          class="pm-release-card__media"
          width={String(c.width)}
          height={String(c.height)}
          alt={c.alt}
          src={c.src}
        />
        <div class="pm-release-card__body">
          <h3 class="pm-release-card__title">
            <a class="pm-release-card__link" href={`/vanilla/pdp/${release.slug}/`}>
              {release.title}
            </a>
          </h3>
          <p class="pm-release-card__artist">{release.artist}</p>
          <p class="pm-release-card__meta">{metaLine(release)}</p>
          <div class="pm-release-card__foot">
            <span class="pm-release-card__price">{price ?? "—"}</span>
            <span class="pm-release-card__stock">{stockLine(release.numForSale)}</span>
          </div>
        </div>
      </li>
    );
  };
}
