import type { RequestHandler } from 'express'

import { HttpError } from '../lib/http-error'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * CSRF defense in depth (on top of SameSite=Lax cookies): a state-changing request that
 * comes from a browser carries an `Origin` header, and it must be our own site. Requests
 * without any Origin/Referer are not from a browser page (curl, server-to-server), so a
 * cookie can't have been "borrowed" — they pass and still need a valid session.
 */
export function originCheck(allowedOrigin: string): RequestHandler {
  const allowed = originOf(allowedOrigin)
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next()

    const origin = originOf(req.get('origin')) ?? originOf(req.get('referer'))
    if (origin === null) return next()

    const self = `${req.protocol}://${req.get('host') ?? ''}`
    if (origin === allowed || origin === self) return next()

    next(HttpError.forbidden('Origem da requisição não permitida.', 'BAD_ORIGIN'))
  }
}
