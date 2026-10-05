/**
 * Shapes the API returns (JSON). Dates are strings: calendar dates as "YYYY-MM-DD",
 * instants as ISO 8601. Money is always integer cents.
 */
import type { CategoryIconKey } from './category-icons'
import type { IsoDate, MonthKey } from './dates'
import type {
  AccountType,
  CardBrand,
  CategoryKind,
  HouseholdRole,
  RecurrenceFrequency,
  TransactionStatus,
  TransactionType,
} from './enums'
import type { InvoiceStatus } from './invoices'
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

/** An invoice with its derived numbers (never stored). */
export interface InvoiceSummaryDto {
  /** null for the current cycle when no purchase created it yet. */
  id: string | null
  creditCardId: string
  /** Due month, "YYYY-MM" ("fatura de novembro" = "2026-11"). */
  referenceMonth: MonthKey
  periodStart: IsoDate
  /** Exclusive: purchases on this day are already in the next invoice. */
  closingDate: IsoDate
  dueDate: IsoDate
  /** Σ purchases − Σ credits. */
  totalCents: number
  /** Σ payments (TRANSFER rows into this invoice). */
  paidCents: number
  status: InvoiceStatus
  /** Number of purchase/credit rows. */
  itemCount: number
}

export interface CardDto {
  id: string
  name: string
  brand: CardBrand
  color: PaletteKey
  lastFour: string | null
  limitCents: number
  closingDay: number
  dueDay: number
  paymentAccountId: string | null
  holderId: string | null
  archivedAt: string | null
  /** Derived: purchases − credits − payments over every non-deleted row (future installments included). */
  usedCents: number
  availableCents: number
  /** The invoice of today's cycle (purchases made today land here). */
  currentInvoice: InvoiceSummaryDto
}

/** A purchase or credit row inside an invoice. */
export interface CardItemDto {
  id: string
  kind: 'PURCHASE' | 'REFUND'
  date: IsoDate
  description: string
  amountCents: number
  categoryId: string | null
  paidById: string | null
  notes: string | null
  installmentPlanId: string | null
  installmentNumber: number | null
  installmentCount: number | null
}

export interface InvoiceDetailDto extends InvoiceSummaryDto {
  items: CardItemDto[]
}

export interface CardPurchaseResultDto {
  /** Every row created (one per installment). */
  items: CardItemDto[]
  /** Invoice of the first (or only) installment. */
  invoice: InvoiceSummaryDto
  installmentPlanId: string | null
  /** The purchase landed on an invoice that had already been paid in full. */
  landedOnPaidInvoice: boolean
}

export interface DeletedItemsDto {
  /** Ids to send back to POST /card-purchases/restore for "Desfazer". */
  ids: string[]
}

/** One ledger row, as the grid shows it. */
export interface TransactionDto {
  id: string
  type: TransactionType
  status: TransactionStatus
  amountCents: number
  /** Competence date. */
  date: IsoDate
  dueDate: IsoDate | null
  paidDate: IsoDate | null
  description: string
  notes: string | null
  categoryId: string | null
  accountId: string | null
  toAccountId: string | null
  creditCardId: string | null
  invoiceId: string | null
  paidById: string | null
  installmentPlanId: string | null
  installmentNumber: number | null
  installmentCount: number | null
  recurringRuleId: string | null
  createdAt: string
}

export interface TransactionTotalsDto {
  /** Σ INCOME on accounts (card credits count as negative expense instead). */
  incomeCents: number
  /** Σ EXPENSE (accounts + cards) − Σ card credits. */
  expenseCents: number
  /** income − expense. */
  netCents: number
  /** Σ of the rows still PENDING (expenses and incomes). */
  pendingCents: number
  count: number
}

export interface TransactionListDto {
  items: TransactionDto[]
  totals: TransactionTotalsDto
}

export interface RecurringRuleDto {
  id: string
  type: 'EXPENSE' | 'INCOME'
  description: string
  amountCents: number
  categoryId: string | null
  accountId: string | null
  creditCardId: string | null
  paidById: string | null
  frequency: RecurrenceFrequency
  interval: number
  startDate: IsoDate
  endDate: IsoDate | null
  autoConfirm: boolean
  pausedAt: string | null
  /** Next date on or after today, or null when the rule has ended. */
  nextOccurrence: IsoDate | null
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
