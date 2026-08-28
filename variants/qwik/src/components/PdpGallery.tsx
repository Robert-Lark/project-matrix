import { component$, useSignal } from "@builder.io/qwik";
import type { Image } from "@pm/data-contract";
import { thumbSrc } from "../lib/pdp-format";

/**
 * The gallery — thumbs switch the stage, zoom is a real toggle. Resumable
 * handlers over two signals; the SERVED state is the master's exactly
 * (selected 0 → first thumb aria-current, zoom not pressed).
 *
 * Two behaviors the contract pins (vanilla's pdp.js is the precedent):
 *  - the stage's width/height attributes STAY the first image's — the stage
 *    is a fixed 1:1 mat, so a switch swaps only src and alt and can never
 *    move the buy panel (ADR-0008 §8, CLS 0 by construction);
 *  - zoom survives a thumb switch: the visitor asked to look closely, and
 *    changing the image does not withdraw that request. `aria-pressed` is
 *    both the accessible state and the selector gallery.css scales from.
 */
export const PdpGallery = component$<{ images: readonly Image[] }>(({ images }) => {
  const selected = useSignal(0);
  const pressed = useSignal(false);
  const first = images[0]!;
  const current = images[selected.value] ?? first;

  return (
    <div class="pm-gallery">
      <figure class="pm-gallery__stage">
        <img
          class="pm-gallery__main"
          src={current.src}
          width={first.width}
          height={first.height}
          alt={current.alt}
          {...{ fetchpriority: "high" }}
        />
        <button
          class="pm-gallery__zoom"
          type="button"
          aria-pressed={pressed.value ? "true" : "false"}
          onClick$={() => {
            pressed.value = !pressed.value;
          }}
        >
          Zoom
        </button>
      </figure>
      {images.length > 1 ? (
        <ul class="pm-gallery__thumbs" role="list">
          {images.map((img, i) => (
            <li key={i}>
              <button
                class="pm-gallery__thumb"
                type="button"
                // `null`, not `undefined`: at SSR both omit the attribute,
                // but on a client re-render qwik's diff treats undefined as
                // "leave unchanged" — the deselected thumb kept its
                // aria-current and two thumbs announced selected (caught by
                // the JS-on browser leg's exactly-one assertion).
                aria-current={(i === selected.value ? "true" : null) as unknown as "true" | undefined}
                onClick$={() => {
                  selected.value = i;
                }}
              >
                <img
                  src={thumbSrc(img.src)}
                  width="160"
                  height="160"
                  alt=""
                  loading="lazy"
                  {...{ fetchpriority: "low" }}
                  decoding="async"
                />
                <span class="pm-sr-only">{`View image ${i + 1} of ${images.length}: ${img.alt}`}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
