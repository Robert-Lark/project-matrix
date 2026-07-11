import { get, route } from 'remix/routes'

export const routes = route({
  // The editorial page — the surface Remix 3 appears on in the matrix.
  home: get('/'),
  // The frame partial: server-HTML fetched by <Frame> (SSR-inline and on reload).
  staffPick: get('/frames/staff-pick'),
})
