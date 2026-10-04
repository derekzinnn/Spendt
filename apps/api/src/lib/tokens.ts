import { createHash, randomBytes } from 'node:crypto'

/**
 * Opaque random tokens (sessions, invites). The raw token goes to the client exactly once;
 * the database only ever sees its SHA-256 — like a coat check that keeps a photo of your
 * ticket instead of the ticket. A leaked database therefore leaks no usable tokens.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
