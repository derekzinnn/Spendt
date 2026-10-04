import { hash, verify } from '@node-rs/argon2'

/**
 * Passwords are hashed with Argon2id (the library default), the current OWASP
 * recommendation. Parameters below follow OWASP's minimum for Argon2id.
 */
const options = {
  memoryCost: 19_456, // KiB (19 MiB)
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, options)
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain)
}
