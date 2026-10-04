import type { CookieOptions, Response } from 'express'

import { isProduction } from '../../config/env'
import type { Session, User } from '../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { generateToken, hashToken } from '../../lib/tokens'

const DAY_MS = 24 * 60 * 60 * 1000

/** Sessions last 30 days and slide forward while in use. */
export const SESSION_TTL_MS = 30 * DAY_MS
/** Refresh the expiry at most once a day, to avoid a write on every request. */
const REFRESH_AFTER_MS = DAY_MS

/**
 * `__Host-` cookies must be Secure, Path=/ and have no Domain: the browser then refuses
 * to let any other (sub)domain set or overwrite them. Only possible over HTTPS, so
 * development uses a plain name.
 */
export const SESSION_COOKIE = isProduction ? '__Host-spendly_session' : 'spendly_session'

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true, // page JavaScript can't read it → XSS can't steal the session
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax', // not sent on cross-site POST/PUT/DELETE → CSRF protection
    path: '/',
    maxAge: SESSION_TTL_MS,
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, cookieOptions())
}

export function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions()
  res.clearCookie(SESSION_COOKIE, options)
}

interface CreateSessionInput {
  userId: string
  activeHouseholdId: string | null
  userAgent?: string | undefined
  ipAddress?: string | undefined
}

/** Creates a session row and sets the cookie. Returns the session. */
export async function startSession(res: Response, input: CreateSessionInput): Promise<Session> {
  const token = generateToken()
  const session = await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId,
      activeHouseholdId: input.activeHouseholdId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  })
  setSessionCookie(res, token)
  // Opportunistic cleanup of this user's expired sessions.
  await prisma.session.deleteMany({
    where: { userId: input.userId, expiresAt: { lt: new Date() } },
  })
  return session
}

/** Looks up a session by its cookie token; expired sessions are deleted and ignored. */
export async function findSession(token: string): Promise<(Session & { user: User }) | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  return session
}

/** Slides the expiry forward (at most daily). Returns true when the cookie should be re-sent. */
export async function touchSession(session: Session): Promise<boolean> {
  if (Date.now() - session.lastSeenAt.getTime() < REFRESH_AFTER_MS) return false
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  })
  return true
}

export async function endSession(sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } })
}
