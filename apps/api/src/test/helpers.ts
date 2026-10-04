import type { MeDto } from '@spendly/shared'
import request from 'supertest'

import { createApp } from '../app'
import { prisma } from '../lib/prisma'

export const ORIGIN = 'http://localhost:5173'

/** Wipes every table (fast, keeps the schema). Call in `beforeEach`. */
export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length === 0) return
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

/**
 * A browser-like client: keeps cookies between requests (like a real session) and sends
 * our Origin on writes, as a browser on the web app would.
 */
export function createClient(app = createApp()) {
  const agent = request.agent(app)
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => agent.post(url).set('Origin', ORIGIN).send(body),
    patch: (url: string, body?: object) => agent.patch(url).set('Origin', ORIGIN).send(body),
    delete: (url: string) => agent.delete(url).set('Origin', ORIGIN),
  }
}

export type TestClient = ReturnType<typeof createClient>

let counter = 0

/** Registers a fresh user (and household) and returns the logged-in client + /me payload. */
export async function signUp(
  overrides: Partial<{
    name: string
    email: string
    password: string
    householdName: string
    inviteToken: string
  }> = {},
  client: TestClient = createClient(),
) {
  counter += 1
  const body = {
    name: overrides.name ?? `Pessoa ${counter}`,
    email: overrides.email ?? `pessoa${counter}@teste.dev`,
    password: overrides.password ?? 'senha-segura-123',
    ...(overrides.householdName ? { householdName: overrides.householdName } : {}),
    ...(overrides.inviteToken ? { inviteToken: overrides.inviteToken } : {}),
  }
  const res = await client.post('/api/auth/register', body)
  if (res.status !== 201) {
    throw new Error(`signUp failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return { client, me: res.body as MeDto, password: body.password, email: body.email }
}

export { prisma }
