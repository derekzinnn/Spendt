/**
 * Integration tests run against a real Postgres:
 *  • TEST_DATABASE_URL set → use that database (it is migrated, then wiped between tests —
 *    never point it at data you care about);
 *  • otherwise → an in-memory Prisma dev server (PGlite) is started just for this run, so
 *    `pnpm test` works on a fresh clone with no Docker.
 */
import { exec } from 'node:child_process'
import { createServer, type AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { PrismaPg } from '@prisma/adapter-pg'
import { startPrismaDevServer } from '@prisma/dev'
import type { TestProject } from 'vitest/node'

import { PrismaClient } from '../generated/prisma/client'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

const apiRoot = fileURLToPath(new URL('../..', import.meta.url))
// Async on purpose: the in-memory database lives in THIS process, so a blocking
// execSync would freeze the very server the migration is trying to reach.
const run = promisify(exec)

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolve(port))
    })
  })
}

/**
 * Waits until the server answers a query, then hands the connection straight back.
 *
 * The migration runs in a child process, so the first test file would otherwise be the one
 * discovering whether the server is up again. The in-memory server (PGlite) serves exactly
 * one connection, which is why this lets go of it immediately.
 */
async function waitForDatabase(connectionString: string, attempts = 40) {
  for (let attempt = 1; ; attempt++) {
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) })
    try {
      await client.$queryRaw`SELECT 1`
      await client.$disconnect()
      return
    } catch (error) {
      await client.$disconnect().catch(() => undefined)
      if (attempt >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
}

export default async function setup(project: TestProject) {
  let databaseUrl = process.env.TEST_DATABASE_URL
  let stop: (() => Promise<void>) | undefined

  if (!databaseUrl) {
    const server = await startPrismaDevServer({
      name: `spendly-test-${process.pid}`,
      persistenceMode: 'stateless',
      port: await freePort(),
      databasePort: await freePort(),
      shadowDatabasePort: await freePort(),
      streamsPort: await freePort(),
    })
    databaseUrl = server.database.connectionString
    stop = () => server.close()
  }

  try {
    await run('npx prisma migrate deploy', {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    })
  } catch (error) {
    await stop?.()
    throw error
  }

  await waitForDatabase(databaseUrl)

  project.provide('databaseUrl', databaseUrl)

  return async () => {
    await stop?.()
  }
}
