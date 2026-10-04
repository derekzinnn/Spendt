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

import { startPrismaDevServer } from '@prisma/dev'
import type { TestProject } from 'vitest/node'

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

  project.provide('databaseUrl', databaseUrl)

  return async () => {
    await stop?.()
  }
}
