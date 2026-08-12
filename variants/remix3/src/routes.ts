// Route table — the FULL prefixed paths (FINDINGS §8's named seam: the front
// Worker forwards the ORIGINAL request untouched, so the /remix3/ prefix in
// routes, frame srcs, anchor hrefs, and asset URLs is this variant's own
// duty; the htmx precedent hand-carries the prefix in route literals).
import { get, route } from "remix/routes";

export const routes = route({
  // The editorial page — the surface this exhibit appears on.
  editorial: get("/remix3/editorial/"),
  // The frames-demo partial: server HTML fetched by <Frame> (resolved inline
  // during document SSR, and refetched standalone on frame reloads).
  demoFrame: get("/remix3/editorial/frames/demo"),
});
