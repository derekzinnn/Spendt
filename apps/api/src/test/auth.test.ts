import type { MeDto } from '@spendly/shared'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app'

import { createClient, ORIGIN, prisma, resetDatabase, signUp } from './helpers'

beforeEach(resetDatabase)

describe('POST /api/auth/register', () => {
  it('creates the user, a household with default categories, and a session cookie', async () => {
    const client = createClient()
    const res = await client.post('/api/auth/register', {
      name: 'Derek Silva',
      email: '  Derek@Teste.DEV ',
      password: 'senha-segura-123',
    })

    expect(res.status).toBe(201)
    const me = res.body as MeDto
    expect(me.user).toMatchObject({ name: 'Derek Silva', email: 'derek@teste.dev' })
    expect(me.household?.name).toBe('Casa de Derek')
    expect(me.member).toMatchObject({
      role: 'OWNER',
      displayName: 'Derek',
      color: '700',
      isMe: true,
    })
    expect(me.memberships).toHaveLength(1)

    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toContain('spendly_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')

    const categories = await prisma.category.count({ where: { householdId: me.household!.id } })
    expect(categories).toBe(61)

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'derek@teste.dev' } })
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('stores only the hash of the session token', async () => {
    const client = createClient()
    const res = await client.post('/api/auth/register', {
      name: 'Ana',
      email: 'ana@teste.dev',
      password: 'senha-segura-123',
    })
    const token = /spendly_session=([^;]+)/.exec(String(res.headers['set-cookie']))?.[1]
    const session = await prisma.session.findFirstOrThrow()
    expect(token).toBeTruthy()
    expect(session.tokenHash).not.toBe(token)
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('uses the custom household name when given', async () => {
    const { me } = await signUp({ householdName: 'Nossa casa' })
    expect(me.household?.name).toBe('Nossa casa')
  })

  it('rejects a duplicate e-mail with a field error', async () => {
    await signUp({ email: 'dup@teste.dev' })
    const res = await createClient().post('/api/auth/register', {
      name: 'Outra',
      email: 'DUP@teste.dev',
      password: 'senha-segura-123',
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
    expect(res.body.error.details).toEqual([{ path: 'email', message: expect.any(String) }])
  })

  it('validates input with pt-BR messages per field', async () => {
    const res = await createClient().post('/api/auth/register', {
      name: '',
      email: 'nope',
      password: '123',
    })
    expect(res.status).toBe(400)
    const paths = (res.body.error.details as { path: string }[]).map((d) => d.path).sort()
    expect(paths).toEqual(['email', 'name', 'password'])
  })
})

describe('login / me / logout', () => {
  it('logs in, reads /me, and logs out', async () => {
    const { email, password } = await signUp()
    const client = createClient()

    expect((await client.get('/api/auth/me')).status).toBe(401)

    const login = await client.post('/api/auth/login', { email, password })
    expect(login.status).toBe(200)
    expect((login.body as MeDto).household).not.toBeNull()

    const me = await client.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect((me.body as MeDto).user.email).toBe(email)

    expect((await client.post('/api/auth/logout')).status).toBe(204)
    expect((await client.get('/api/auth/me')).status).toBe(401)
  })

  it('answers the same generic error for wrong password and unknown e-mail', async () => {
    const { email } = await signUp()
    const wrongPassword = await createClient().post('/api/auth/login', {
      email,
      password: 'errada-123',
    })
    const unknownEmail = await createClient().post('/api/auth/login', {
      email: 'ninguem@teste.dev',
      password: 'errada-123',
    })
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual(unknownEmail.body)
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects expired sessions', async () => {
    const { client } = await signUp()
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await client.get('/api/auth/me')).status).toBe(401)
    expect(await prisma.session.count()).toBe(0)
  })

  it('logout invalidates the session server-side, not only the cookie', async () => {
    const client = createClient()
    const registered = await client.post('/api/auth/register', {
      name: 'Ana',
      email: 'ana@teste.dev',
      password: 'senha-segura-123',
    })
    const cookie = String(registered.headers['set-cookie']).split(';')[0] ?? ''
    expect((await request(createApp()).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200)
    await client.post('/api/auth/logout')
    const replay = await request(createApp()).get('/api/auth/me').set('Cookie', cookie)
    expect(replay.status).toBe(401)
  })
})

describe('CSRF and abuse protection', () => {
  it('rejects writes coming from another origin', async () => {
    const { client } = await signUp()
    const res = await client.agent
      .post('/api/categories')
      .set('Origin', 'https://evil.example')
      .send({ name: 'Hack', kind: 'EXPENSE', icon: 'gift', color: '700' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('BAD_ORIGIN')
  })

  it('allows reads from anywhere but still requires a session', async () => {
    const res = await request(createApp())
      .get('/api/categories')
      .set('Origin', 'https://evil.example')
    expect(res.status).toBe(401)
  })

  it('rate-limits repeated login attempts', async () => {
    const client = createClient(createApp({ authRateLimit: 3 }))
    const attempt = () =>
      client.post('/api/auth/login', { email: 'x@teste.dev', password: 'errada-123' })
    expect((await attempt()).status).toBe(401)
    expect((await attempt()).status).toBe(401)
    expect((await attempt()).status).toBe(401)
    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
  })

  it('accepts requests that come from our own origin', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'x@teste.dev', password: 'errada-123' })
    expect(res.status).toBe(401)
  })
})
