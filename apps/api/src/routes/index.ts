import { Router } from 'express'

import { requireHousehold } from '../middleware/auth'
import { createAuthRateLimit } from '../middleware/rate-limit'

import { accountsRouter } from './accounts.routes'
import { authRouter } from './auth.routes'
import { cardPurchasesRouter, cardsRouter, invoicesRouter } from './cards.routes'
import { categoriesRouter } from './categories.routes'
import { healthRouter } from './health'
import { householdRouter } from './household.routes'
import { invitesRouter } from './invites.routes'

export interface ApiOptions {
  /** Attempts per IP per 15 minutes on credential endpoints. */
  authRateLimit: number
}

/**
 * Everything lives under /api so the web app and the API can share one origin.
 * Routes behind `requireHousehold` get their scope from `scopeOf(req)` — never from input.
 */
export function apiRouter(options: ApiOptions) {
  const router = Router()
  const rateLimit = createAuthRateLimit(options.authRateLimit)
  const lookupRateLimit = createAuthRateLimit(options.authRateLimit * 3)

  router.use('/health', healthRouter)
  router.use('/auth', authRouter({ rateLimit }))
  router.use('/invites', invitesRouter({ rateLimit, lookupRateLimit }))
  router.use('/household', requireHousehold, householdRouter())
  router.use('/categories', requireHousehold, categoriesRouter())
  router.use('/accounts', requireHousehold, accountsRouter())
  router.use('/cards', requireHousehold, cardsRouter())
  router.use('/invoices', requireHousehold, invoicesRouter())
  router.use('/card-purchases', requireHousehold, cardPurchasesRouter())

  return router
}
