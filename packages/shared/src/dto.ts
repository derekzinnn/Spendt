/**
 * Shapes the API returns (JSON). Dates are strings: calendar dates as "YYYY-MM-DD",
 * instants as ISO 8601. Money is always integer cents.
 */
import type { CategoryIconKey } from './category-icons'
import type { IsoDate } from './dates'
import type { AccountType, CategoryKind, HouseholdRole } from './enums'
import type { PaletteKey } from './palette'

export interface UserDto {
  id: string
  name: string
  email: string
}

export interface HouseholdDto {
  id: string
  name: string
  currency: string
  timezone: string
}

export interface MemberDto {
  id: string
  userId: string
  displayName: string
  color: PaletteKey
  role: HouseholdRole
  /** True for the member that belongs to the requesting user. */
  isMe: boolean
}

export interface MembershipDto {
  householdId: string
  householdName: string
  role: HouseholdRole
}

/** GET /api/auth/me — everything the app shell needs to boot. */
export interface MeDto {
  user: UserDto
  /** Active household (null only if the user belongs to none). */
  household: HouseholdDto | null
  member: MemberDto | null
  members: MemberDto[]
  memberships: MembershipDto[]
}

export interface InviteDto {
  id: string
  email: string
  invitedByName: string
  createdAt: string
  expiresAt: string
}

/** Returned once, on creation: the only time the invite link is known. */
export interface CreatedInviteDto extends InviteDto {
  url: string
}

/** Public preview shown on the accept-invite page. */
export interface InvitePreviewDto {
  householdName: string
  invitedByName: string
  email: string
  expiresAt: string
  /** Whether an account already exists for the invited e-mail. */
  hasAccount: boolean
}

export interface CategoryDto {
  id: string
  parentId: string | null
  name: string
  kind: CategoryKind
  icon: CategoryIconKey
  color: PaletteKey
  monthlyBudgetCents: number | null
  sortOrder: number
  archivedAt: string | null
}

export interface AccountDto {
  id: string
  name: string
  type: AccountType
  color: PaletteKey
  holderId: string | null
  initialBalanceCents: number
  initialBalanceDate: IsoDate
  /** Derived: initial balance + PAID movements dated on/after the initial balance date. */
  balanceCents: number
  archivedAt: string | null
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/** Field-level problems, as sent in `error.details` for validation and conflict errors. */
export interface FieldIssue {
  path: string
  message: string
}
