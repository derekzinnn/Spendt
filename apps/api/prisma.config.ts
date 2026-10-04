import { existsSync } from 'node:fs'

import { defineConfig } from 'prisma/config'

// Prisma 7 no longer reads .env on its own. In production the variables come from the
// environment (Docker), so a missing file is fine.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Optional so `prisma generate` works without a database (e.g. on a fresh clone).
    url: process.env.DATABASE_URL,
  },
})
