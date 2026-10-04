import { inviteTokenSchema } from '@spendly/shared'
import { Router, type Request, type RequestHandler } from 'express'

import { buildMe } from '../domain/households/household.service'
import { acceptInvite, previewInvite } from '../domain/invites/invite.service'
import { HttpError } from '../lib/http-error'
import { authOf, requireAuth } from '../middleware/auth'

function tokenParam(req: Request): string {
  const parsed = inviteTokenSchema.safeParse(req.params.token)
  if (!parsed.success) throw HttpError.notFound('Convite não encontrado. Confira o link.')
  return parsed.data
}

/** Public side of invites: preview a link, accept it. */
export function invitesRouter({
  rateLimit,
  lookupRateLimit,
}: {
  rateLimit: RequestHandler
  lookupRateLimit: RequestHandler
}) {
  const router = Router()

  router.get('/:token', lookupRateLimit, async (req, res) => {
    res.json(await previewInvite(tokenParam(req)))
  })

  router.post('/:token/accept', rateLimit, requireAuth, async (req, res) => {
    const { user, session } = authOf(req)
    const member = await acceptInvite(tokenParam(req), user, session.id)
    res.json(await buildMe(user.id, member.householdId))
  })

  return router
}
