import type { CreatedInviteDto, InvitePreviewDto, MeDto } from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { createClient, prisma, resetDatabase, signUp } from './helpers'

beforeEach(resetDatabase)

const tokenOf = (invite: CreatedInviteDto) => invite.url.split('/convite/')[1] ?? ''

async function ownerWithInvite(email = 'parceira@teste.dev') {
  const owner = await signUp({ name: 'Derek', householdName: 'Nossa casa' })
  const res = await owner.client.post('/api/household/invites', { email })
  expect(res.status).toBe(201)
  const invite = res.body as CreatedInviteDto
  return { owner, invite, token: tokenOf(invite) }
}

describe('invite flow', () => {
  it('creates a link the partner can preview without logging in', async () => {
    const { invite, token } = await ownerWithInvite()
    expect(invite.url).toBe(`http://localhost:5173/convite/${token}`)

    const preview = await createClient().get(`/api/invites/${token}`)
    expect(preview.status).toBe(200)
    expect(preview.body as InvitePreviewDto).toMatchObject({
      householdName: 'Nossa casa',
      invitedByName: 'Derek',
      email: 'parceira@teste.dev',
      hasAccount: false,
    })
  })

  it('lets the partner register straight into the household', async () => {
    const { owner, token } = await ownerWithInvite()
    const { me } = await signUp({
      name: 'Bia Souza',
      email: 'parceira@teste.dev',
      inviteToken: token,
    })

    expect(me.household?.id).toBe(owner.me.household?.id)
    expect(me.member).toMatchObject({ role: 'MEMBER', displayName: 'Bia', color: '300' })
    expect(me.members.map((m) => m.displayName)).toEqual(['Derek', 'Bia'])
    expect(me.memberships).toHaveLength(1) // no extra household was created
    expect(await prisma.household.count()).toBe(1)
  })

  it('refuses a different e-mail than the invited one', async () => {
    const { token } = await ownerWithInvite()
    const res = await createClient().post('/api/auth/register', {
      name: 'Intrusa',
      email: 'outra@teste.dev',
      password: 'senha-segura-123',
      inviteToken: token,
    })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('INVITE_EMAIL_MISMATCH')
    expect(await prisma.user.count()).toBe(1)
  })

  it('is single-use', async () => {
    const { token } = await ownerWithInvite()
    await signUp({ email: 'parceira@teste.dev', inviteToken: token })
    const again = await createClient().get(`/api/invites/${token}`)
    expect(again.status).toBe(410)
    expect(again.body.error.code).toBe('INVITE_USED')
  })

  it('lets an existing user accept after logging in, switching their active household', async () => {
    const partner = await signUp({
      name: 'Bia',
      email: 'parceira@teste.dev',
      householdName: 'Apê da Bia',
    })
    const { owner, token } = await ownerWithInvite('parceira@teste.dev')

    const preview = await createClient().get(`/api/invites/${token}`)
    expect((preview.body as InvitePreviewDto).hasAccount).toBe(true)

    const accepted = await partner.client.post(`/api/invites/${token}/accept`)
    expect(accepted.status).toBe(200)
    const me = accepted.body as MeDto
    expect(me.household?.id).toBe(owner.me.household?.id)
    expect(me.memberships.map((m) => m.householdName).sort()).toEqual(['Apê da Bia', 'Nossa casa'])

    const switched = await partner.client.post('/api/auth/switch-household', {
      householdId: partner.me.household?.id,
    })
    expect((switched.body as MeDto).household?.name).toBe('Apê da Bia')
  })

  it('needs a session to accept and the matching account', async () => {
    const { token } = await ownerWithInvite()
    expect((await createClient().post(`/api/invites/${token}/accept`)).status).toBe(401)

    const stranger = await signUp({ email: 'estranho@teste.dev' })
    const res = await stranger.client.post(`/api/invites/${token}/accept`)
    expect(res.status).toBe(403)
  })

  it('can be revoked; a new invite replaces the old link', async () => {
    const { owner, invite, token } = await ownerWithInvite()

    const second = await owner.client.post('/api/household/invites', {
      email: 'parceira@teste.dev',
    })
    expect((await createClient().get(`/api/invites/${token}`)).status).toBe(410)

    const pending = await owner.client.get('/api/household/invites')
    expect(pending.body).toHaveLength(1)

    const secondInvite = second.body as CreatedInviteDto
    expect((await owner.client.delete(`/api/household/invites/${secondInvite.id}`)).status).toBe(
      204,
    )
    const revoked = await createClient().get(`/api/invites/${tokenOf(secondInvite)}`)
    expect(revoked.status).toBe(410)
    expect(revoked.body.error.code).toBe('INVITE_REVOKED')
    expect(invite.id).not.toBe(secondInvite.id)
  })

  it('reports expired and unknown links', async () => {
    const { token } = await ownerWithInvite()
    await prisma.householdInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await createClient().get(`/api/invites/${token}`)).body.error.code).toBe(
      'INVITE_EXPIRED',
    )
    expect((await createClient().get('/api/invites/nao-existe-este-token-de-convite')).status).toBe(
      404,
    )
  })

  it('only the owner invites, and members cannot be invited twice', async () => {
    const { owner, token } = await ownerWithInvite()
    const partner = await signUp({ email: 'parceira@teste.dev', inviteToken: token })

    const byMember = await partner.client.post('/api/household/invites', {
      email: 'amigo@teste.dev',
    })
    expect(byMember.status).toBe(403)

    const duplicate = await owner.client.post('/api/household/invites', {
      email: 'parceira@teste.dev',
    })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('ALREADY_MEMBER')
  })
})
