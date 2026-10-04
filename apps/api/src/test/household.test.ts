import type { CreatedInviteDto, MeDto } from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { createClient, resetDatabase, signUp } from './helpers'

beforeEach(resetDatabase)

async function couple() {
  const owner = await signUp({ name: 'Derek', householdName: 'Nossa casa' })
  const invite = (await owner.client.post('/api/household/invites', { email: 'bia@teste.dev' }))
    .body as CreatedInviteDto
  const token = invite.url.split('/convite/')[1] ?? ''
  const partner = await signUp({ name: 'Bia', email: 'bia@teste.dev', inviteToken: token })
  return { owner, partner }
}

describe('household settings', () => {
  it('owner renames the household; members cannot', async () => {
    const { owner, partner } = await couple()
    const res = await owner.client.patch('/api/household', { name: 'Lar doce lar' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ name: 'Lar doce lar' })
    expect(res.body).not.toHaveProperty('defaultSplitMode')

    const asMember = await partner.client.patch('/api/household', { name: 'Minha casa' })
    expect(asMember.status).toBe(403)
  })

  it('each member edits their own name and colour; colours stay distinct', async () => {
    const { partner } = await couple()
    const res = await partner.client.patch('/api/household/members/me', {
      displayName: 'Bia ❤',
      color: '900',
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ displayName: 'Bia ❤', color: '900', isMe: true })

    const clash = await partner.client.patch('/api/household/members/me', { color: '700' })
    expect(clash.status).toBe(409)
    expect(clash.body.error.code).toBe('COLOR_TAKEN')
  })

  it('login reopens the household; switching to a foreign one is a 404', async () => {
    const { owner } = await couple()
    const client = createClient()
    await client.post('/api/auth/login', { email: owner.email, password: owner.password })
    const me = (await client.get('/api/auth/me')).body as MeDto
    expect(me.household?.name).toBe('Nossa casa')

    const bad = await client.post('/api/auth/switch-household', {
      householdId: '00000000-0000-7000-8000-000000000000',
    })
    expect(bad.status).toBe(404)
  })
})
