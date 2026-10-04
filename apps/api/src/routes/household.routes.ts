import { createInviteSchema, updateHouseholdSchema, updateMemberSchema } from '@spendly/shared'
import { Router } from 'express'

import { updateHousehold, updateMember } from '../domain/households/household.service'
import { createInvite, listPendingInvites, revokeInvite } from '../domain/invites/invite.service'
import { idParam } from '../lib/params'
import { requireOwner, scopeOf } from '../middleware/auth'

/** The active household: settings, members, invites. Mounted behind `requireHousehold`. */
export function householdRouter() {
  const router = Router()

  router.patch('/', requireOwner, async (req, res) => {
    const input = updateHouseholdSchema.parse(req.body)
    res.json(await updateHousehold(scopeOf(req).householdId, input))
  })

  router.patch('/members/me', async (req, res) => {
    const input = updateMemberSchema.parse(req.body)
    res.json(await updateMember(scopeOf(req).member, input))
  })

  router.get('/invites', async (req, res) => {
    res.json(await listPendingInvites(scopeOf(req).householdId))
  })

  router.post('/invites', requireOwner, async (req, res) => {
    const { email } = createInviteSchema.parse(req.body)
    const { householdId, member } = scopeOf(req)
    res.status(201).json(await createInvite(householdId, member, email))
  })

  router.delete('/invites/:id', requireOwner, async (req, res) => {
    await revokeInvite(scopeOf(req).householdId, idParam(req, 'id', 'Convite não encontrado.'))
    res.status(204).end()
  })

  return router
}
