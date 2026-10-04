import type { HouseholdMember, Session, User } from '../generated/prisma/client'

export interface AuthContext {
  session: Session
  user: User
  /** Membership in the session's active household (null if none / left). */
  member: HouseholdMember | null
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `loadSession` when a valid session cookie is present. */
      auth?: AuthContext
    }
  }
}

export {}
