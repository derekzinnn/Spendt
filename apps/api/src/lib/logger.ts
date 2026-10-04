import { pino } from 'pino'

import { env } from '../config/env'

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } } }
    : {}),
})
