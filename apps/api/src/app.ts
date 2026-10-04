import { randomUUID } from 'node:crypto'

import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'

import { env } from './config/env'
import { logger } from './lib/logger'
import { loadSession } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { originCheck } from './middleware/origin-check'
import { apiRouter, type ApiOptions } from './routes'

/** Parses TRUST_PROXY: "true"/"false", a hop count, or a named/CIDR list. */
function trustProxySetting(value: string): boolean | number | string {
  if (value === 'true') return true
  if (value === 'false') return false
  const hops = Number(value)
  return Number.isInteger(hops) ? hops : value
}

export function createApp(options: Partial<ApiOptions> = {}) {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', trustProxySetting(env.TRUST_PROXY))

  // The web app and the API share one origin (Vite proxy in dev, Caddy in prod),
  // so no CORS is configured on purpose.
  app.use(helmet())
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.headers['x-request-id']?.toString() ?? randomUUID()
        res.setHeader('x-request-id', id)
        return id
      },
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  // Order matters: reject foreign origins before touching the session.
  app.use('/api', originCheck(env.WEB_ORIGIN), loadSession)
  app.use('/api', apiRouter({ authRateLimit: options.authRateLimit ?? env.AUTH_RATE_LIMIT }))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
