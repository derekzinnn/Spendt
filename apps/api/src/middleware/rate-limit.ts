import { rateLimit } from 'express-rate-limit'

import { HttpError } from '../lib/http-error'

/**
 * Brute-force brake for credential endpoints (login, register, invite accept): after
 * `limit` attempts from the same IP within the window, answer 429 until it passes —
 * like an ATM that makes you wait after too many wrong PINs.
 *
 * In-memory store: fine for a single API process. Use a shared store (e.g. Redis) if the
 * API ever runs as several instances.
 */
export function createAuthRateLimit(limit: number, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(HttpError.tooManyRequests()),
  })
}
