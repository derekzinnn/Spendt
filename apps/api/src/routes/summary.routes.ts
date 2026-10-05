import { monthKeySchema } from '@spendly/shared'
import { Router } from 'express'

import { getDashboardSummary } from '../domain/summary/summary.service'
import { scopeOf } from '../middleware/auth'

/** `/summary` — mounted behind `requireHousehold`. Everything the dashboard charts need. */
export function summaryRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    const month = monthKeySchema.parse(req.query.month)
    res.json(await getDashboardSummary(scopeOf(req).householdId, month))
  })

  return router
}
