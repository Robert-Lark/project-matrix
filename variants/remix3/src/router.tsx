// The app router — fetch-shaped (web Request in, web Response out), which is
// exactly a Worker's fetch handler (the spike's verdict; ADR-0004 second
// addendum). Built PER REQUEST so the controller actions close over this
// request's `env` (the Workers way to reach the EDGE service binding; the
// spike had no bindings so it built once — the delta is recorded in
// DIFF-TO-STARTER.md). Two routes and one middleware make the per-request
// construction cost negligible, and nothing is cached across requests that
// could leak one request's data into another.
import { createController, createRouter, type MiddlewareContext } from "remix/router";

import { loadEditorialData, type Env } from "./lib/data.ts";
import { render } from "./render.tsx";
import { routes } from "./routes.ts";
import { clampPick, FrontierDemoCard } from "./ui/frontier-demo.tsx";
import { EditorialPage } from "./ui/editorial-page.tsx";

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

export function createAppRouter(env: Env) {
  const router = createRouter<AppContext>({
    middleware: [render()],
  });

  const controller = createController(routes, {
    actions: {
      async editorial(context) {
        // Data resolves BEFORE render starts: an edge failure throws here
        // and becomes the Worker's branded 503, never a half-written page.
        const data = await loadEditorialData(env);
        const pick = clampPick(new URL(context.request.url).searchParams.get("pick"));
        return context.render(<EditorialPage data={data} pick={pick} />);
      },
      demoFrame(context) {
        const pick = clampPick(new URL(context.request.url).searchParams.get("pick"));
        return context.render(<FrontierDemoCard pick={pick} />);
      },
    },
  });

  router.map(routes, controller);

  return router;
}
