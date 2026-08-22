"use client";

import { useEffect, useState } from "react";

/** Error boundaries must be Client Components (Next's file convention).
 *  Catches loadDetail's non-404 failures (src/lib/edge.ts — pm-edge
 *  unreachable or answering 5xx) so a visitor sees Long Decay Records' own
 *  chrome instead of Next's generic, unbranded fallback — the editorial
 *  boundary's pattern, on the second surface that fetches per request.
 *
 *  The shell skeleton is INLINED here rather than imported from
 *  src/lib/render.tsx, deliberately: this file is a client entry, and a
 *  second client importer of Shell registers it as a named export inside
 *  render.tsx's client instantiation — measured +76 raw bytes in a chunk the
 *  EDITORIAL page serves, whose published initial-JS cell is pinned at its
 *  measurement SHA (the pdp-cart.ts / pdp-format.ts reasoning, third
 *  instance). An error page that fetches nothing cannot re-throw, and its
 *  duplicated skeleton is held to the shared shape by eye and by the chrome
 *  slot contract, not by the drift gate — error pages are never compared.
 *
 *  The badge read below is self-contained for the same chunk-freeze reason
 *  (no cart.ts import), and it exists because CART_CONTRACT's populate
 *  clause covers EVERY shell page load — a visitor with items in cart who
 *  hits a data-plane failure must not see the empty badge read as zero
 *  (verify-slice finding: the first draft shipped the slot with nothing
 *  able to fill it, while the editorial boundary populates via CartCount). */
function storedCartCount(): number {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("pm:cart") ?? "");
    const cart = parsed as { v?: unknown; items?: { id: number; qty: number }[] };
    if (
      cart != null &&
      cart.v === 1 &&
      Array.isArray(cart.items) &&
      cart.items.every(
        (i) => i != null && Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty >= 1,
      ) &&
      new Set(cart.items.map((i) => i.id)).size === cart.items.length
    ) {
      return cart.items.reduce((n, i) => n + i.qty, 0);
    }
  } catch {
    /* fall through to the empty cart */
  }
  return 0;
}

export default function PdpError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(storedCartCount());
  }, []);
  const badge = count === 0 ? "" : count > 9 ? "9+" : String(count);
  const label = count === 0 ? undefined : `Cart, ${count} ${count === 1 ? "item" : "items"}`;

  return (
    <>
      <a className="pm-skip pm-button" href="#main">
        Skip to content
      </a>
      <div id="pm-chrome-slot" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />
      <div className="pm-page">
        <header className="pm-masthead">
          <a className="pm-masthead__brand" href="/">
            Long Decay<span> Records</span>
          </a>
          <nav className="pm-masthead__nav" aria-label="Store">
            <a className="pm-masthead__link" href="/react-next/plp/plain/" aria-current="page">
              Records
            </a>
            <a className="pm-masthead__link" href="/vanilla/editorial/">
              Editorial
            </a>
          </nav>
          <a className="pm-masthead__cart" href="/vanilla/checkout/" aria-label={label}>
            Cart
            <span className="pm-masthead__cart-count" data-pm-cart-count="" aria-hidden="true">
              {badge}
            </span>
          </a>
        </header>
        <main id="main">
          <div className="pm-pdp">
            <h1>This page couldn&apos;t load</h1>
            <p>
              The store&apos;s data plane didn&apos;t answer. This is a simulated demo storefront
              — nothing was ordered, nothing was lost.
            </p>
            <button className="pm-button" type="button" onClick={() => unstable_retry()}>
              Try again
            </button>
          </div>
        </main>
        <p className="pm-status" role="status" data-pm-status=""></p>
        <footer className="pm-footer">
          <p className="pm-footer__fiction">
            A working store on frozen Discogs data — nothing ships, checkout is simulated.
          </p>
          <nav className="pm-footer__nav" aria-label="About this site">
            <a href="/">What is this?</a>
            <a href="/vanilla/a11y/">Accessibility, shown</a>
            <a href="/how-it-was-built/">How it was built</a>
            <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">
              GitHub
            </a>
          </nav>
        </footer>
      </div>
    </>
  );
}
