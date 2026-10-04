import { PrismaPg } from '@prisma/adapter-pg'

import { env } from '../config/env'
import { PrismaClient } from '../generated/prisma/client'

export function createPrismaClient(connectionString: string = env.DATABASE_URL) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

/**
 * The single Prisma client for the API process.
 *
 * Every query on business tables MUST be scoped by householdId — see CLAUDE.md →
 * "Conventions". From Phase 1 on, route handlers get the household from the session,
 * never from the request body.
 */
export const prisma = createPrismaClient()
