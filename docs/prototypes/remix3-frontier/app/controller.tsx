import { createController } from 'remix/router'

import { clampPick } from './data.ts'
import { routes } from './routes.ts'
import { EditorialPage } from './ui/editorial-page.tsx'
import { StaffPick } from './ui/staff-pick.tsx'

export default createController(routes, {
  actions: {
    home(context) {
      const pick = clampPick(new URL(context.request.url).searchParams.get('pick'))
      return context.render(<EditorialPage pick={pick} />)
    },
    staffPick(context) {
      const pick = clampPick(new URL(context.request.url).searchParams.get('pick'))
      return context.render(<StaffPick pick={pick} />)
    },
  },
})
