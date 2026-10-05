import {
  addDays,
  firstDayOfMonth,
  lastDayOfMonth,
  listBillsQuerySchema,
  todayIso,
  type BillBucket,
  type BillDto,
  type BillsDto,
  type IsoDate,
  type ListBillsQuery,
  type PayBillInput,
} from '@spendly/shared'

import type { Transaction } from '../../generated/prisma/client'

import { fromDbDate, toDbDate } from '../../lib/db-dates'
import { prisma } from '../../lib/prisma'
import { loadInvoices, type InvoiceRow } from '../cards/invoice.service'
import { ensureOccurrences } from '../recurring/recurring.service'
import { updateTransaction } from '../transactions/transaction.service'

/** Whole days from `today` to `date` (negative when it already passed). */
function daysUntil(date: IsoDate, today: IsoDate): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )
}

function bucketOf(days: number): BillBucket {
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  return days <= 7 ? 'week' : 'later'
}

const byDueDate = (a: BillDto, b: BillDto) =>
  a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.amountCents - b.amountCents

function billOf(base: Omit<BillDto, 'bucket' | 'daysUntilDue'>, today: IsoDate): BillDto {
  const daysUntilDue = daysUntil(base.dueDate, today)
  return { ...base, daysUntilDue, bucket: bucketOf(daysUntilDue) }
}

/** An invoice becomes a bill while it still has something left to pay. */
function invoiceBill(row: InvoiceRow, cardName: string, accountId: string | null, today: IsoDate) {
  const totalCents = row.purchasesCents - row.creditsCents
  return billOf(
    {
      kind: 'invoice',
      id: row.id,
      dueDate: row.dueDate,
      description: `Fatura ${cardName}`,
      amountCents: totalCents - row.paidCents,
      totalCents,
      paidCents: row.paidCents,
      categoryId: null,
      creditCardId: row.creditCardId,
      accountId,
      paidById: null,
      recurringRuleId: null,
    },
    today,
  )
}

function transactionBill(row: Transaction, today: IsoDate, dueDate: IsoDate) {
  return billOf(
    {
      kind: 'transaction',
      id: row.id,
      dueDate,
      description: row.description,
      amountCents: row.amountCents,
      totalCents: row.amountCents,
      paidCents: row.status === 'PAID' ? row.amountCents : 0,
      categoryId: row.categoryId,
      creditCardId: null,
      accountId: row.accountId,
      paidById: row.paidById,
      recurringRuleId: row.recurringRuleId,
    },
    today,
  )
}

/**
 * "Contas a pagar": everything still owed up to the end of the month being viewed — pending
 * expense rows with a due date, plus credit-card invoices with a balance. Overdue bills from
 * earlier months are always included, so nothing gets lost by changing the month.
 */
export async function listBills(householdId: string, rawQuery: ListBillsQuery): Promise<BillsDto> {
  const { month } = listBillsQuerySchema.parse(rawQuery)
  const today = todayIso()
  const windowEnd = lastDayOfMonth(month)
  const monthStart = firstDayOfMonth(month)
  await ensureOccurrences(householdId, windowEnd)

  const [rows, invoiceRows, cards] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId,
        deletedAt: null,
        type: 'EXPENSE',
        creditCardId: null,
        dueDate: { not: null, lte: toDbDate(windowEnd) },
      },
      orderBy: { dueDate: 'asc' },
    }),
    loadInvoices(householdId),
    prisma.creditCard.findMany({
      where: { householdId },
      select: { id: true, name: true, paymentAccountId: true },
    }),
  ])
  const cardById = new Map(cards.map((card) => [card.id, card]))

  const items: BillDto[] = []
  const paid: BillDto[] = []

  for (const row of rows) {
    const dueDate = fromDbDate(row.dueDate!)
    const bill = transactionBill(row, today, dueDate)
    if (row.status === 'PENDING') items.push(bill)
    else if (dueDate >= monthStart) paid.push(bill)
  }

  for (const row of invoiceRows) {
    if (row.dueDate > windowEnd) continue
    const card = cardById.get(row.creditCardId)
    if (!card) continue
    const bill = invoiceBill(row, card.name, card.paymentAccountId, today)
    if (bill.totalCents <= 0) continue
    if (bill.amountCents > 0) items.push(bill)
    else if (row.dueDate >= monthStart) paid.push(bill)
  }

  items.sort(byDueDate)
  paid.sort(byDueDate)

  const sum = (list: BillDto[]) => list.reduce((total, bill) => total + bill.amountCents, 0)
  return {
    items,
    paid,
    totals: {
      overdueCents: sum(items.filter((bill) => bill.bucket === 'overdue')),
      dueCents: sum(items),
      paidCents: paid.reduce((total, bill) => total + bill.totalCents, 0),
      count: items.length,
      paidCount: paid.length,
    },
  }
}

/** Marks a pending bill as paid, from an account, on a date (defaults to today). */
export async function payBill(householdId: string, id: string, input: PayBillInput) {
  const paidDate = input.paidDate ?? todayIso()
  return updateTransaction(householdId, id, {
    status: 'PAID',
    accountId: input.accountId,
    paidDate,
  })
}

/** Bills due in the next `days` days (and anything overdue) — for the dashboard. */
export async function upcomingBills(householdId: string, days = 30): Promise<BillDto[]> {
  const today = todayIso()
  const { items } = await listBills(householdId, { month: addDays(today, days).slice(0, 7) })
  const limit = addDays(today, days)
  return items.filter((bill) => bill.dueDate <= limit)
}
