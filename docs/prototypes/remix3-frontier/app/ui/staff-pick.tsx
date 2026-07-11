import type { Handle } from 'remix/ui'

import { PICKS } from '../data.ts'

export interface StaffPickProps {
  pick: number
}

// The frame partial: server-HTML for one staff pick. Rendered two ways —
// inline during SSR (resolveFrame) and as a standalone partial when the
// frame reloads over the wire. The "next" control lives INSIDE the partial
// (Turbo-style: frame content carries its own navigation) so repeated
// clicks cycle correctly, JS on or off:
//   JS on:  the anchor reloads only this frame from rmx-src (and pushes
//           the href URL via the Navigation API).
//   JS off: the anchor is a plain link to the full page for the same pick.
export function StaffPick(handle: Handle<StaffPickProps>) {
  return () => {
    const current = handle.props.pick
    const next = (current + 1) % PICKS.length
    const pick = PICKS[current]!

    return (
      <article class="pm-staff-pick" data-pick={String(current)}>
        <p class="pm-staff-pick__eyebrow">Staff pick</p>
        <h3 class="pm-staff-pick__title">
          {pick.artist} — <em>{pick.title}</em>
        </h3>
        <p class="pm-staff-pick__meta">
          {pick.label}, {pick.year}
        </p>
        <p class="pm-staff-pick__blurb">{pick.blurb}</p>
        <nav class="pm-staff-pick__controls" aria-label="Staff pick controls">
          <a
            href={`/?pick=${next}`}
            rmx-target="picks"
            rmx-src={`/frames/staff-pick?pick=${next}`}
          >
            Next pick →
          </a>
        </nav>
      </article>
    )
  }
}
