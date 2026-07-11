import { Frame, type Handle } from 'remix/ui'

import { CounterButton } from '../client/counter-button.tsx'
import { Document } from './document.tsx'

export interface EditorialPageProps {
  pick: number
}

export function EditorialPage(handle: Handle<EditorialPageProps>) {
  return () => {
    const current = handle.props.pick

    return (
      <Document title="Editorial — Remix 3 frontier spike">
        <main class="pm-editorial">
          <h1 class="pm-editorial__title">This week in the crate</h1>
          <p class="pm-editorial__standfirst">
            Server-rendered prose: this whole page arrives as streamed HTML
            from a non-React component runtime. No hydration is needed to
            read it.
          </p>
          <p class="pm-editorial__body">
            The box below is a Remix 3 <code>&lt;Frame&gt;</code>. On the
            server it is resolved inline — view source and the pick is
            already there. In the browser, the &ldquo;next pick&rdquo; link
            reloads <em>only the frame</em> over the wire as HTML; with
            JavaScript disabled the same link falls back to a full-page
            navigation to the same content. That is the frames paradigm:
            HTML on the wire, progressive enhancement by default.
          </p>

          <Frame name="picks" src={`/frames/staff-pick?pick=${current}`} />

          <CounterButton label="Island check — clicks:" />
        </main>
      </Document>
    )
  }
}
