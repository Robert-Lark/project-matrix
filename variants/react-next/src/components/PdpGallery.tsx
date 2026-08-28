"use client";

import { useState } from "react";
import type { Image } from "@pm/data-contract";
import { thumbSrc } from "../lib/pdp-format";

/**
 * The gallery — thumbs switch the stage, zoom is a real toggle. Idiomatic
 * React state where vanilla writes attributes by hand, but the SERVED shape
 * is the master's exactly: selected index 0 (first thumb aria-current),
 * zoom not pressed, stage = the first image.
 *
 * Two behaviors the contract pins (vanilla's pdp.js is the precedent):
 *  - the stage's width/height attributes STAY the first image's — the stage
 *    is a fixed 1:1 mat, so a switch swaps only src and alt and can never
 *    move the buy panel (ADR-0008 §8, CLS 0 by construction);
 *  - zoom survives a thumb switch: the visitor asked to look closely, and
 *    changing the image does not withdraw that request. `aria-pressed` is
 *    both the accessible state and the selector gallery.css scales from, so
 *    the visual state cannot exist without the programmatic one.
 */
export function PdpGallery({ images }: { images: readonly Image[] }) {
  const [selected, setSelected] = useState(0);
  const [pressed, setPressed] = useState(false);
  const first = images[0]!;
  const current = images[selected] ?? first;

  return (
    <div className="pm-gallery">
      <figure className="pm-gallery__stage">
        <img
          className="pm-gallery__main"
          src={current.src}
          width={first.width}
          height={first.height}
          alt={current.alt}
          fetchPriority="high"
        />
        <button
          className="pm-gallery__zoom"
          type="button"
          aria-pressed={pressed ? "true" : "false"}
          onClick={() => setPressed((was) => !was)}
        >
          Zoom
        </button>
      </figure>
      {images.length > 1 ? (
        <ul className="pm-gallery__thumbs" role="list">
          {images.map((img, i) => (
            <li key={i}>
              <button
                className="pm-gallery__thumb"
                type="button"
                aria-current={i === selected ? "true" : undefined}
                onClick={() => setSelected(i)}
              >
                <img
                  src={thumbSrc(img.src)}
                  width="160"
                  height="160"
                  alt=""
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
                <span className="pm-sr-only">{`View image ${i + 1} of ${images.length}: ${img.alt}`}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
