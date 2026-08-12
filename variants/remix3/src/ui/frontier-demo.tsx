// The frames demo — the paradigm made visible (remix3-frontier FINDINGS §2,
// §5: frames, run() anchor interception, Navigation API history). Exhibit
// APPARATUS, not store content: the whole section carries data-pm-fenced and
// is dropped from the drift comparison by the same scoped mechanism as the
// plaque, so the canonical page stays byte-comparable around it. Its copy
// says so out loud (every surface self-explains), which also keeps the
// article's "only interactive element" feature-note honest — these controls
// are the exhibit's own instrument, like the injected chrome, not the store.
//
// The demo card lives INSIDE the frame and carries its own next-anchor
// (Turbo-style: frame content carries its own navigation — the spike's
// shape). JS on: run() intercepts the anchor, reloads ONLY the frame from
// rmx-src, and pushes the href through the Navigation API. JS off: the same
// anchor is a plain link to the full page for the same card — progressive
// enhancement by construction.
import { Frame, type Handle } from "remix/ui";

interface DemoCard {
  heading: string;
  body: string;
  cta: string;
}

export const DEMO_CARDS: readonly DemoCard[] = [
  {
    heading: "Server HTML, resolved inline",
    body: "This card arrived inside the page: the server resolved the frame during the initial render, so view-source already contains it. Nothing here hydrated — what you are reading is the markup the wire carried.",
    cta: "Load the next card →",
  },
  {
    heading: "A frame reload, not a page load",
    body: "That click fetched only this card as HTML over the wire — one request, no document navigation, no JSON layer. The address bar updated through the Navigation API, and your browser's Back button will restore the previous card the same way.",
    cta: "One more →",
  },
  {
    heading: "JavaScript off? Same link.",
    body: "Every control here is a plain anchor. With JavaScript disabled the same click becomes a full-page navigation to this card's URL — progressive enhancement is the paradigm's default posture, not an add-on.",
    cta: "Back to the first card →",
  },
];

export function clampPick(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < DEMO_CARDS.length ? n : 0;
}

/** The frame partial: rendered two ways — inline during document SSR
 *  (resolveFrame through the same router, no network hop) and standalone at
 *  its own URL when the frame reloads over the wire. */
export function FrontierDemoCard(handle: Handle<{ pick: number }>) {
  return () => {
    const pick = handle.props.pick;
    const next = (pick + 1) % DEMO_CARDS.length;
    const card = DEMO_CARDS[pick]!;

    return (
      <div class="pm-frontier-demo__card" data-pick={String(pick)}>
        <p class="pm-frontier-demo__step">{`Behavior ${pick + 1} of ${DEMO_CARDS.length}`}</p>
        <h3 class="pm-frontier-demo__heading">{card.heading}</h3>
        <p class="pm-frontier-demo__body">{card.body}</p>
        <nav class="pm-frontier-demo__controls" aria-label="Frames demo controls">
          <a
            href={`/remix3/editorial/?pick=${next}`}
            rmx-target="frontier-demo"
            rmx-src={`/remix3/editorial/frames/demo?pick=${next}`}
          >
            {card.cta}
          </a>
        </nav>
      </div>
    );
  };
}

export function FrontierDemo(handle: Handle<{ pick: number }>) {
  return () => (
    <section class="pm-frontier-demo" data-pm-fenced="true" aria-label="Frames demo">
      <p class="pm-frontier-demo__kicker">{"Exhibit apparatus"}</p>
      <h2 class="pm-frontier-demo__title">{"The frames paradigm, live"}</h2>
      <p class="pm-frontier-demo__lede">
        {"The box below is a Remix 3 frame — server-rendered HTML with a src, reloadable on its own. It is exhibit apparatus, not store content: like the plaque above, it sits outside the drift comparison and exists only to show the mechanism this exhibit previews."}
      </p>
      <Frame
        name="frontier-demo"
        src={`/remix3/editorial/frames/demo?pick=${handle.props.pick}`}
      />
    </section>
  );
}
