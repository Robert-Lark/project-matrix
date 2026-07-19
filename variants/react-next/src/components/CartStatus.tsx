"use client";

import { useEffect, useState } from "react";
import { CART_ANNOUNCE_EVENT } from "../lib/cart";

interface AnnounceDetail {
  message: string;
}

/** The shell's live region (WCAG 4.1.3) — a sibling of `<main>`, not inside
 *  it, so it is reached by event rather than prop. Starts empty (the
 *  canonical served state); a successful add anywhere on the page sets its
 *  text via the shared cart-announce event. */
export function CartStatus() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<AnnounceDetail>).detail;
      setMessage(detail.message);
    };
    window.addEventListener(CART_ANNOUNCE_EVENT, onAnnounce);
    return () => window.removeEventListener(CART_ANNOUNCE_EVENT, onAnnounce);
  }, []);

  return (
    <p className="pm-status" role="status" data-pm-status="">
      {message}
    </p>
  );
}
