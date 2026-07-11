import { createRouter, type MiddlewareContext } from 'remix/router'

import controller from './controller.tsx'
import { render } from './render.tsx'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

type RouterMiddleware = NonNullable<
  Parameters<typeof createRouter<AppContext>>[0]
>['middleware']

// One app, two hosts: the host passes only its own serving concerns in
// (Node: a filesystem static middleware; Workers: nothing — the platform's
// asset layer serves /assets/* before the Worker runs).
export function createAppRouter(hostMiddleware: NonNullable<RouterMiddleware> = []) {
  const router = createRouter<AppContext>({
    middleware: [...hostMiddleware, render()],
  })

  router.map(routes, controller)

  return router
}
