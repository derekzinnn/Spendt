import { loginSchema, registerSchema, switchHouseholdSchema } from '@spendly/shared'
import { Router, type Request, type RequestHandler } from 'express'

import { login, register } from '../domain/auth/auth.service'
import { clearSessionCookie, endSession, startSession } from '../domain/auth/session'
import { buildMe } from '../domain/households/household.service'
import { HttpError } from '../lib/http-error'
import { prisma } from '../lib/prisma'
import { authOf, requireAuth } from '../middleware/auth'

const clientInfo = (req: Request) => ({ userAgent: req.get('user-agent'), ipAddress: req.ip })

export function authRouter({ rateLimit }: { rateLimit: RequestHandler }) {
  const router = Router()

  /** Create an account (and a household, or join one through `inviteToken`). */
  router.post('/register', rateLimit, async (req, res) => {
    const input = registerSchema.parse(req.body)
    const { userId, householdId } = await register(input)
    if (req.auth) await endSession(req.auth.session.id)
    await startSession(res, { userId, activeHouseholdId: householdId, ...clientInfo(req) })
    res.status(201).json(await buildMe(userId, householdId))
  })

  router.post('/login', rateLimit, async (req, res) => {
    const input = loginSchema.parse(req.body)
    const { userId, householdId } = await login(input)
    // Always a fresh token on login (no session fixation).
    if (req.auth) await endSession(req.auth.session.id)
    await startSession(res, { userId, activeHouseholdId: householdId, ...clientInfo(req) })
    res.json(await buildMe(userId, householdId))
  })

  router.post('/logout', async (req, res) => {
    if (req.auth) await endSession(req.auth.session.id)
    clearSessionCookie(res)
    res.status(204).end()
  })

  router.get('/me', requireAuth, async (req, res) => {
    const { user, member } = authOf(req)
    res.json(await buildMe(user.id, member?.householdId ?? null))
  })

  /** Change the session's active household (multi-household users). */
  router.post('/switch-household', requireAuth, async (req, res) => {
    const { householdId } = switchHouseholdSchema.parse(req.body)
    const { user, session } = authOf(req)
    const member = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: user.id } },
    })
    if (!member || member.leftAt) throw HttpError.notFound('Casa não encontrada.')
    await prisma.session.update({
      where: { id: session.id },
      data: { activeHouseholdId: householdId },
    })
    res.json(await buildMe(user.id, householdId))
  })

  return router
}
