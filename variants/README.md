# variants/

One workspace per rendering paradigm — vanilla, heavy-hydration (React/Next),
islands (Astro), resumability (Qwik), hypermedia (HTMX), plus the fenced Remix 3
frontier (ADR-0004 §2).

Current occupants: the **throwaway placeholder stand-in variants** (issue #3)
— `placeholder-static` (assets + the one-line forwarder script) and
`placeholder-ssr` (per-request render with representative permitted paradigm
noise for the drift gate). Both serve the same `/{variant}/sample/` surface so
the switcher (issue #5) has a real swap cell. Real paradigm variants replace
them in the downstream per-surface builds.
