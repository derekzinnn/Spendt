/**
 * Domain enums mirrored from the Prisma schema, plus their pt-BR labels.
 *
 * The API has a compile-time parity check (apps/api/src/lib/enum-parity.ts) that breaks
 * the build if these drift from `schema.prisma`.
 */

export const HOUSEHOLD_ROLES = ['OWNER', 'MEMBER'] as const
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number]
export const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
  OWNER: 'Responsável',
  MEMBER: 'Membro',
}

export const CATEGORY_KINDS = ['EXPENSE', 'INCOME'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]
export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  EXPENSE: 'Despesa',
  INCOME: 'Receita',
}

export const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CASH', 'BENEFIT'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança / reserva',
  CASH: 'Dinheiro',
  BENEFIT: 'Benefício (VR/VA)',
}

export const CARD_BRANDS = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER'] as const
export type CardBrand = (typeof CARD_BRANDS)[number]
export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'American Express',
  HIPERCARD: 'Hipercard',
  OTHER: 'Outra',
}

export const TRANSACTION_TYPES = ['EXPENSE', 'INCOME', 'TRANSFER'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: 'Despesa',
  INCOME: 'Receita',
  TRANSFER: 'Transferência',
}

export const TRANSACTION_STATUSES = ['PAID', 'PENDING'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PAID: 'Pago',
  PENDING: 'Pendente',
}

export const RECURRENCE_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]
export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
}

/** Budget usage (in basis points) at which the dashboard raises an alert. */
export const BUDGET_ALERT_THRESHOLDS_BPS = [8_000, 10_000] as const
