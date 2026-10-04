import { createApp } from './app'
import { env } from './config/env'
import { logger } from './lib/logger'
import { prisma } from './lib/prisma'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(`Spendly API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`${signal} received, shutting down`)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
