import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

interface CounterButtonProps extends SerializableProps {
  label: string
}

// import.meta.url survives Node's loader and real browser ESM, but workerd
// leaves the wrangler-bundled module's import.meta EMPTY at runtime
// (probed: url === undefined, zero keys — the bundler preserves the
// expression verbatim), and clientEntry() throws on a missing ID. The ID is
// only an opaque key that resolveClientEntry() maps to the prebuilt asset
// URL, so a stable literal fallback is safe on every host.
// (FINDINGS.md: Workers-hosting friction #1.)
const ENTRY_ID = import.meta.url || 'file:///app/client/counter-button.tsx'

// The one island: proves clientEntry() hydration — the rest of the page is
// static server HTML. Exhibit-only chrome, so remix/ui's own css() idiom is
// fine here (the ADR-0003 markup contract governs store components, and this
// isn't one).
export const CounterButton = clientEntry(
  ENTRY_ID,
  function CounterButton(handle: Handle<CounterButtonProps>) {
    let clicks = 0

    return () => (
      <button
        type="button"
        class="pm-island-check"
        mix={[
          css({ marginTop: '2rem', padding: '0.5rem 1rem', cursor: 'pointer' }),
          on('click', () => {
            clicks += 1
            handle.update()
          }),
        ]}
      >
        {handle.props.label} {clicks}
      </button>
    )
  },
)
