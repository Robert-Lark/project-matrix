// The hand-rolled Cloudflare Workers entry: the entire "adapter" is this
// file. The app router is fetch-shaped (web Request in, web Response out),
// which is exactly a Worker's fetch handler. Static assets (/assets/*) are
// served by Workers Static Assets before this script runs (assets-first
// routing), mirroring what staticFiles does on the Node leg.
import { createAppRouter } from '../app/router.ts'

const router = createAppRouter()

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}
