import { Router } from 'express'

import { prisma } from '../lib/prisma'

export const healthRouter = Router()

/** Liveness + database reachability. Used by uptime checks and the web app's boot. */
healthRouter.get('/', async (_req, res) => {
  const startedAt = performance.now()
  let database: 'up' | 'down' = 'up'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    database = 'down'
  }
  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    latencyMs: Math.round(performance.now() - startedAt),
    time: new Date().toISOString(),
  })
})
