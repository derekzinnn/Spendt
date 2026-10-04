/**
 * The invoice engine: which credit-card invoice ("fatura") a purchase belongs to.
 *
 * Pure functions over calendar dates (YYYY-MM-DD, America/Sao_Paulo). The API feeds them the
 * card's existing invoices (snapshots) and persists what they return; the web uses them for
 * previews ("Entra na fatura de nov · vence 05/11").
 *
 * Rules (see CLAUDE.md → "Invoice assignment rule"):
 * - Closing and due days are clamped to the month length (31 → 28/29 in February).
 * - A purchase ON the closing day goes to the NEXT invoice ("melhor dia de compra").
 * - The due date is the first `dueDay` after the closing date.
 * - Invoices are named by their DUE month: `referenceMonth` = 1st of the due month.
 * - Existing invoices are snapshots and win: changing the card's closing day never moves
 *   purchases already assigned, and new periods never overlap old ones (gap-free).
 * - Installment k goes to the cycle k months after the purchase's cycle (shift the CYCLE,
 *   not the date).
 */
import {
  addDays,
  addMonths,
  addMonthsToDate,
  clampDay,
  firstDayOfMonth,
  monthKeyOf,
  parseIsoDate,
  parseMonthKey,
  toIsoDate,
  type IsoDate,
  type MonthKey,
} from './dates'

export interface CardCycleConfig {
  /** 1–31, clamped to the month length. */
  closingDay: number
  /** 1–31, clamped to the month length. */
  dueDay: number
}

/** An invoice period. `closingDate` is exclusive: purchases on it roll to the next one. */
export interface InvoicePeriod {
  /** 1st day of the due month: "2026-11-01" = "fatura de novembro". */
  referenceMonth: IsoDate
  /** First purchase date included. */
  periodStart: IsoDate
  /** Purchases on/after this date belong to the next invoice. */
  closingDate: IsoDate
  dueDate: IsoDate
}

export interface ResolvedCycle extends InvoicePeriod {
  /** True when an existing invoice (snapshot) was matched instead of a new one computed. */
  existing: boolean
}

/** The clamped closing date of a card in a given month. */
export function closingDateIn(month: MonthKey, closingDay: number): IsoDate {
  const { year, month: m } = parseMonthKey(month)
  return toIsoDate(clampDay(year, m, closingDay))
}

/** The first `dueDay` strictly after the closing date. */
function dueDateAfter(closingDate: IsoDate, dueDay: number): IsoDate {
  const month = monthKeyOf(closingDate)
  const sameMonth = closingDateIn(month, dueDay)
  return sameMonth > closingDate ? sameMonth : closingDateIn(addMonths(month, 1), dueDay)
}

const sortByStart = (a: InvoicePeriod, b: InvoicePeriod) =>
  a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0

/**
 * The invoice a purchase made on `purchaseDate` belongs to.
 *
 * 1. An existing invoice whose period contains the date wins (snapshot).
 * 2. Otherwise the cycle is computed from the card's closing/due days, starting right after
 *    the latest earlier invoice (no gaps) and ending before the next later one (no overlap).
 * 3. There is only ever one invoice per card per due month: if the computed due month already
 *    has an invoice that starts later, the purchase joins it; if that invoice already closed
 *    before the purchase (the closing day changed), the purchase rolls to the next cycle.
 */
export function resolveInvoiceCycle(
  card: CardCycleConfig,
  purchaseDate: IsoDate,
  existing: readonly InvoicePeriod[] = [],
): ResolvedCycle {
  parseIsoDate(purchaseDate) // validates

  const containing = existing.find(
    (inv) => inv.periodStart <= purchaseDate && purchaseDate < inv.closingDate,
  )
  if (containing) return { ...pick(containing), existing: true }

  const month = monthKeyOf(purchaseDate)
  let closingDate = closingDateIn(month, card.closingDay)
  if (purchaseDate >= closingDate) closingDate = closingDateIn(addMonths(month, 1), card.closingDay)

  // Never overlap a later snapshot: end where the next existing invoice starts.
  const sorted = [...existing].sort(sortByStart)
  const next = sorted.find((inv) => inv.periodStart > purchaseDate)

  let dueDate: IsoDate
  let referenceMonth: IsoDate
  for (let guard = 0; ; guard++) {
    if (next && next.periodStart < closingDate) closingDate = next.periodStart
    dueDate = dueDateAfter(closingDate, card.dueDay)
    referenceMonth = firstDayOfMonth(monthKeyOf(dueDate))
    const sameMonth = existing.find((inv) => inv.referenceMonth === referenceMonth)
    if (!sameMonth || guard > 24) break
    // That due month's invoice is later than the purchase → it belongs there.
    if (sameMonth.periodStart > purchaseDate) return { ...pick(sameMonth), existing: true }
    // It already closed before the purchase (closing day changed) → next cycle.
    closingDate = closingDateIn(addMonths(monthKeyOf(closingDate), 1), card.closingDay)
  }

  // Gap-free: start right where the previous invoice closed (or one regular cycle back).
  const regularStart = closingDateIn(addMonths(monthKeyOf(closingDate), -1), card.closingDay)
  const previous = [...sorted].reverse().find((inv) => inv.closingDate <= purchaseDate)
  let periodStart =
    previous && previous.closingDate > regularStart ? previous.closingDate : regularStart
  // After a rollover the regular start can be later than the purchase: start where the
  // previous invoice closed instead.
  if (periodStart > purchaseDate) periodStart = previous?.closingDate ?? purchaseDate

  return { referenceMonth, periodStart, closingDate, dueDate, existing: false }
}

/**
 * The invoice of installment `k` (0-based) of a purchase: the cycle `k` months after the
 * purchase's own cycle. `existing` should include the invoices resolved for earlier
 * installments so the whole plan stays consistent.
 */
export function resolveInstallmentCycle(
  card: CardCycleConfig,
  purchaseDate: IsoDate,
  k: number,
  existing: readonly InvoicePeriod[] = [],
): ResolvedCycle {
  const base = resolveInvoiceCycle(card, purchaseDate, existing)
  if (k === 0) return base
  // Any date inside the target cycle works; the day before its closing date is always in it.
  const targetClosing = closingDateIn(addMonths(monthKeyOf(base.closingDate), k), card.closingDay)
  return resolveInvoiceCycle(card, addDays(targetClosing, -1), existing)
}

/** Competence date of installment `k`: the purchase date `k` months later (clamped). */
export function installmentDate(purchaseDate: IsoDate, k: number): IsoDate {
  return addMonthsToDate(purchaseDate, k)
}

function pick(period: InvoicePeriod): InvoicePeriod {
  return {
    referenceMonth: period.referenceMonth,
    periodStart: period.periodStart,
    closingDate: period.closingDate,
    dueDate: period.dueDate,
  }
}

// ───────────── Status ─────────────

export const INVOICE_STATUSES = ['open', 'closed', 'paid', 'partially_paid', 'overdue'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  partially_paid: 'Paga em parte',
  overdue: 'Vencida',
}

/**
 * Derived, never stored:
 * `paid` if paid ≥ total > 0 · `partially_paid` if 0 < paid < total and today ≤ due ·
 * `overdue` if today > due and paid < total · `closed` if today ≥ closing · else `open`.
 */
export function invoiceStatus(
  invoice: { totalCents: number; paidCents: number; closingDate: IsoDate; dueDate: IsoDate },
  today: IsoDate,
): InvoiceStatus {
  const { totalCents: total, paidCents: paid } = invoice
  if (total > 0 && paid >= total) return 'paid'
  if (today > invoice.dueDate && paid < total) return 'overdue'
  if (paid > 0 && paid < total) return 'partially_paid'
  if (today >= invoice.closingDate) return 'closed'
  return 'open'
}
