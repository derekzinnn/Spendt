import type { Request, RequestHandler } from 'express'

import {
  clearSessionCookie,
  findSession,
  SESSION_COOKIE,
  setSessionCookie,
  touchSession,
} from '../domain/auth/session'
import type { HouseholdMember } from '../generated/prisma/client'
import { HttpError } from '../lib/http-error'
import { prisma } from '../lib/prisma'
import type { AuthContext } from '../types/express'

/**
 * Reads the session cookie (if any) and puts `{ session, user, member }` on `req.auth`.
 * Never rejects: routes decide whether they need a session via `requireAuth`.
 */
export const loadSession: RequestHandler = async (req, res, next) => {
  const cookies = req.cookies as Record<string, unknown> | undefined
  const token = cookies?.[SESSION_COOKIE]
  if (typeof token !== 'string' || token.length === 0) return next()

  const session = await findSession(token)
  if (!session) {
    clearSessionCookie(res)
    return next()
  }

  let member: HouseholdMember | null = null
  if (session.activeHouseholdId) {
    member = await prisma.householdMember.findUnique({
      where: {
        householdId_userId: { householdId: session.activeHouseholdId, userId: session.userId },
      },
    })
    if (member?.leftAt) member = null
  }

  if (await touchSession(session)) setSessionCookie(res, token)

  const { user, ...sessionRow } = session
  req.auth = { session: sessionRow, user, member }
  next()
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.auth ? undefined : HttpError.unauthorized())
}

export const requireHousehold: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(HttpError.unauthorized())
  if (!req.auth.member) {
    return next(HttpError.forbidden('Entre em uma casa para continuar.', 'NO_HOUSEHOLD'))
  }
  next()
}

export const requireOwner: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(HttpError.unauthorized())
  if (req.auth.member?.role !== 'OWNER') {
    return next(HttpError.forbidden('Só quem administra a casa pode fazer isso.'))
  }
  next()
}

/** The authenticated context. Use behind `requireAuth`. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw HttpError.unauthorized()
  return req.auth
}

/**
 * The household scope for the request — the ONLY source of `householdId` for business
 * queries. Use behind `requireHousehold`.
 */
export function scopeOf(req: Request): { householdId: string; member: HouseholdMember } {
  const member = req.auth?.member
  if (!member) throw HttpError.forbidden('Entre em uma casa para continuar.', 'NO_HOUSEHOLD')
  return { householdId: member.householdId, member }
}
