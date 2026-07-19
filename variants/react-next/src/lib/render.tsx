// The react-next editorial page — this variant's OWN re-implementation of
// the canonical markup (ADR-0003 §1: a component is a spec, re-implemented
// per paradigm; ADR-0008: packages/reference/surfaces/editorial/ is the
// contract of record). Essay copy is re-typed as variant-owned content, not
// imported from @pm/reference at build time (the slice-A precedent,
// DIFF-TO-STARTER.md) — the drift gate polices textual identity, and here
// the identity check has no browser to wait for: this module is plain
// framework-neutral React, callable with `react-dom/server` directly by the
// pre-merge guard (tools/repo-checks), exactly as it is by the live route.
//
// Framework-neutral by design: no Next-specific imports here (those live in
// app/editorial/page.tsx) — only React, the data-contract types, and this
// variant's own client islands. Relative imports throughout (not the `@/*`
// alias): tools/repo-checks' pre-merge guard imports this file directly,
// from outside this workspace's tsconfig path mapping.
import type { ReleaseDetail } from "@pm/data-contract";
import { formatPrice, metaLine, stockLine } from "./format";
import { isFixtureCrate } from "./snapshot";
import { AddToCartButton } from "../components/AddToCartButton";
import { CartCount } from "../components/CartCount";
import { CartStatus } from "../components/CartStatus";

/** Designated hosts (spec of record; SURFACE_CONTROLS carries them too) —
 *  packages/reference/render/shell.mjs HOSTS, ported verbatim. */
export const HOSTS = {
  plp: "/react-next/plp/plain/",
  pdp: (slug: string) => `/vanilla/pdp/${slug}/`,
  editorial: "/vanilla/editorial/",
  checkout: "/vanilla/checkout/",
  a11y: "/vanilla/a11y/",
  howBuilt: "/how-it-was-built/",
};

interface EssayBlock {
  kind: "p" | "blockquote";
  content: React.ReactNode;
}

interface Essay {
  kicker: string;
  title: string;
  dek: string;
  /** The opening paragraph — the one block carrying an `<em>` — kept as JSX
   *  rather than a template string so React's own escaping applies. */
  opening: (featured: ReleaseDetail) => React.ReactNode;
  body: (featured: ReleaseDetail) => EssayBlock[];
  featureNote: (featured: ReleaseDetail) => string;
}

const CRATE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "The price of stillness",
  dek: "A drone record from 2007 has become the most expensive thing in our crate — without a single loud moment on it.",
  // Each side of the <em> is ONE template-literal string, not JSX text
  // interleaved with expressions: JSX splits `text {expr} text` into
  // separate DOM text nodes joined by empty comment markers (React's
  // hydration-boundary convention), which measurably (if imperceptibly)
  // shifts sub-pixel text shaping versus the master's single continuous
  // text node — caught by the zero-tolerance pixel gate (comparePixels'
  // own doc: same-run determinism means ANY difference counts). A single
  // combined string per side is one text node, matching the master's shape
  // exactly; React's normal text-child escaping still applies.
  opening: (d) => (
    <>
      {`There are records you put on and records you put up — and ${d.artist}'s `}
      <em>{d.title}</em>
      {` has spent nearly two decades being both. Two hours of tape-saturated strings and horns that barely move, released on ${d.labels[0]?.name ?? "Kranky"} in ${d.year}, it is the kind of album whose fans describe it in architectural terms: a room, a horizon, a place they go.`}
    </>
  ),
  body: (d) => [
    {
      kind: "p",
      content: `It is also, as of this crate's freeze, the most expensive record we stock. The original pressing sits north of five hundred dollars with a single copy on offer — ${formatPrice(d.priceFrom)} at the freeze, to be exact — and the story of how it got there is the story of what vinyl does when music refuses to be background for the people who love it.`,
    },
    {
      kind: "blockquote",
      content:
        "Stillness scales badly. You can stream it anywhere, but the people who want this record want the object — the gatefold, the etched runout, the side you have to stand up and flip. Scarcity does the rest.",
    },
    {
      kind: "p",
      content:
        "The economics are unsentimental. A triple LP of very quiet music is expensive to press and risky to repress, so supply arrives in slow, deliberate waves; a reissue surfaces, sells through, and the originals resume their climb. Meanwhile the music itself does the one thing collectible records must do: it keeps being recommended, year after year, by people who sound slightly embarrassed at how much they mean it.",
    },
    {
      kind: "p",
      content:
        "We are not in the appreciation business — this is a record store, and our copy count is what it is. But if you have ever wondered what people hear in a record that seems to do nothing, this is the one to start with. Put it on in the late afternoon. Let it be the room.",
    },
  ],
  featureNote: () =>
    "The pressing described above, as captured in the frozen snapshot — price and availability are the real aggregate at the freeze.",
};

const FIXTURE_ESSAY: Essay = {
  kicker: "Staff pick",
  title: "A quiet variation, on repeat",
  dek: "The fixture's stand-in essay: synthetic prose over synthetic data, exercising every structure the real one uses.",
  opening: (d) => (
    <>
      <em>{d.title}</em>
      {` by ${d.artist} is not a real record — it is release ${d.id} of the synthesized fixture crate, pressed on ${d.labels[0]?.name ?? "a placeholder label"} in ${d.year} by a deterministic generator. This essay exists so the editorial surface renders honestly in CI, where the real crate never travels.`}
    </>
  ),
  body: (d) => [
    {
      kind: "p",
      content: `It carries everything the real staff pick carries: a priced feature card rendered from the tray (${formatPrice(d.priceFrom) ?? "unpriced"} at the fixture's pinned capture date), a figure with data-sized dimensions, one blockquote, and exactly one interaction below.`,
    },
    {
      kind: "blockquote",
      content:
        "If you can read this in a published benchmark screenshot, the wrong snapshot is being served — the fixture never leaves CI.",
    },
    {
      kind: "p",
      content:
        "Structure is the point: the drift gate compares this page's rendered DOM against every paradigm's re-implementation, so even placeholder prose is part of the contract. The words are synthetic; the markup is law.",
    },
    {
      kind: "p",
      content:
        "The real essay ships wherever the real crate is served, with the same shape and the same rules — numbers from trays, dates from the manifest, verdicts from nowhere.",
    },
  ],
  featureNote: () =>
    "The fixture's featured release, rendered from its tray — same contract as the real crate's.",
};

/** `crateName` is the served SnapshotManifest's `crate` field. */
export function essayFor(crateName: string): Essay {
  return isFixtureCrate(crateName) ? FIXTURE_ESSAY : CRATE_ESSAY;
}

function ReleaseCard({ release }: { release: ReleaseDetail }) {
  const price = formatPrice(release.priceFrom);
  const c = release.cover;
  return (
    <li className="pm-release-card">
      <img
        className="pm-release-card__media"
        width={c.width}
        height={c.height}
        alt={c.alt}
        src={c.src}
      />
      <div className="pm-release-card__body">
        <h3 className="pm-release-card__title">
          <a className="pm-release-card__link" href={HOSTS.pdp(release.slug)}>
            {release.title}
          </a>
        </h3>
        <p className="pm-release-card__artist">{release.artist}</p>
        <p className="pm-release-card__meta">{metaLine(release)}</p>
        <div className="pm-release-card__foot">
          <span className="pm-release-card__price">{price ?? "—"}</span>
          <span className="pm-release-card__stock">{stockLine(release.numForSale)}</span>
        </div>
      </div>
    </li>
  );
}

/** The article: prose plus exactly one interaction (ADR-0008). `capturedAt`
 *  is the served manifest's freeze date — the dateline is always tool
 *  output, never typed. */
export function EditorialArticle({
  essay,
  featured,
  capturedAt,
}: {
  essay: Essay;
  featured: ReleaseDetail;
  capturedAt: string;
}) {
  const figureImg = featured.images[1] ?? featured.images[0];
  const catno = featured.labels[0]?.catno;

  return (
    <article className="pm-editorial">
      <header className="pm-editorial__head">
        <p className="pm-page__kicker">{essay.kicker}</p>
        <h1 className="pm-editorial__title">{essay.title}</h1>
        <p className="pm-editorial__dek">{essay.dek}</p>
        <p className="pm-editorial__dateline">
          From the crate · frozen <time dateTime={capturedAt}>{capturedAt}</time>
        </p>
      </header>
      <div className="pm-prose">
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
          {/* One combined template literal, not several interpolations —
              avoids extra comment-node text-splitting (see the essay
              opening's comment above). */}
          <figcaption>
            {`${featured.artist} — ${featured.title} (${featured.labels[0]?.name ?? ""}${catno ? ` · ${catno}` : ""}), from the frozen snapshot.`}
          </figcaption>
        </figure>
        {essay.body(featured).map((block, i) =>
          block.kind === "blockquote" ? (
            <blockquote key={i}>
              <p>{block.content}</p>
            </blockquote>
          ) : (
            <p key={i}>{block.content}</p>
          ),
        )}
      </div>
      <aside className="pm-editorial__feature" aria-label="Featured release">
        <ul className="pm-grid" role="list">
          <ReleaseCard release={featured} />
        </ul>
        <div className="pm-editorial__feature-body">
          <p className="pm-editorial__feature-note">{essay.featureNote(featured)}</p>
          <AddToCartButton
            id={featured.id}
            title={featured.title}
            disabled={featured.numForSale === 0}
          />
          <p className="pm-editorial__feature-note">
            The only interactive element on this page — that&apos;s the experiment.
          </p>
        </div>
      </aside>
    </article>
  );
}

/** The shared shell (packages/reference/render/shell.mjs `shell()`, ported):
 *  skip link, chrome slot, masthead · main · status · footer. `current`
 *  marks which masthead link is the surface being viewed — always
 *  "editorial" in this slice, kept as a parameter so PDP/PLP can reuse this
 *  component without touching it. */
export function Shell({
  current,
  children,
}: {
  current: "plp" | "editorial";
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="pm-skip pm-button" href="#main">
        Skip to content
      </a>
      {/* The front Worker injects chrome into this div by rewriting the HTTP
       *  stream in transit — React's own vdom for it has zero children, so
       *  on hydration React's mismatch recovery discards the injected chrome
       *  and re-renders it empty (invisible when hydration is fast; a real
       *  CLS bug under slow-CPU loads, caught via a CI-only flake). A
       *  dangerouslySetInnerHTML with a non-null __html is what makes
       *  react-dom's hydration skip that subtree's child-matching walk
       *  entirely — suppressHydrationWarning alone does not. */}
      <div id="pm-chrome-slot" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />
      <div className="pm-page">
        <header className="pm-masthead">
          <a className="pm-masthead__brand" href="/">
            Long Decay<span> Records</span>
          </a>
          <nav className="pm-masthead__nav" aria-label="Store">
            <a
              className="pm-masthead__link"
              href={HOSTS.plp}
              aria-current={current === "plp" ? "page" : undefined}
            >
              Records
            </a>
            <a
              className="pm-masthead__link"
              href={HOSTS.editorial}
              aria-current={current === "editorial" ? "page" : undefined}
            >
              Editorial
            </a>
          </nav>
          <CartCount checkoutHref={HOSTS.checkout} />
        </header>
        <main id="main">{children}</main>
        <CartStatus />
        <footer className="pm-footer">
          <p className="pm-footer__fiction">
            A working store on frozen Discogs data — nothing ships, checkout is simulated.
          </p>
          <nav className="pm-footer__nav" aria-label="About this site">
            <a href="/">What is this?</a>
            <a href={HOSTS.a11y}>Accessibility, shown</a>
            <a href={HOSTS.howBuilt}>How it was built</a>
            <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">
              GitHub
            </a>
          </nav>
        </footer>
      </div>
    </>
  );
}
