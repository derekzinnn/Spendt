import {
  invoiceStatus,
  monthKeyOf,
  resolveInvoiceCycle,
  todayIso,
  type CardCycleConfig,
  type CardItemDto,
  type InvoiceDetailDto,
  type InvoicePeriod,
  type InvoiceSummaryDto,
  type IsoDate,
} from '@spendly/shared'

import type { Prisma } from '../../generated/prisma/client'
import { fromDbDate, toDbDate } from '../../lib/db-dates'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export interface InvoiceRow extends InvoicePeriod {
  id: string
  creditCardId: string
  purchasesCents: number
  creditsCents: number
  paidCents: number
  itemCount: number
}

/**
 * Every invoice of the household (or of one card) with its derived numbers, in one query:
 * total = purchases − credits; paid = PAID transfers into it. Soft-deleted rows don't count.
 */
export async function loadInvoices(
  householdId: string,
  filter: { creditCardId?: string; id?: string } = {},
  db: Db = prisma,
): Promise<InvoiceRow[]> {
  const rows = await db.$queryRaw<
    {
      id: string
      creditCardId: string
      referenceMonth: Date
      periodStart: Date
      closingDate: Date
      dueDate: Date
      purchases: bigint
      credits: bigint
      paid: bigint
      items: bigint
    }[]
  >`
    SELECT i.id, i."creditCardId", i."referenceMonth", i."periodStart", i."closingDate", i."dueDate",
           COALESCE(SUM(t."amountCents") FILTER (WHERE t.type = 'EXPENSE'), 0)::bigint AS purchases,
           COALESCE(SUM(t."amountCents") FILTER (WHERE t.type = 'INCOME'), 0)::bigint AS credits,
           COALESCE(SUM(t."amountCents") FILTER (WHERE t.type = 'TRANSFER' AND t.status = 'PAID'), 0)::bigint AS paid,
           COUNT(t.id) FILTER (WHERE t.type IN ('EXPENSE', 'INCOME'))::bigint AS items
      FROM "Invoice" i
      LEFT JOIN "Transaction" t
        ON t."invoiceId" = i.id
       AND t."householdId" = i."householdId"
       AND t."deletedAt" IS NULL
     WHERE i."householdId" = ${householdId}::uuid
       AND (${filter.creditCardId ?? null}::uuid IS NULL OR i."creditCardId" = ${filter.creditCardId ?? null}::uuid)
       AND (${filter.id ?? null}::uuid IS NULL OR i.id = ${filter.id ?? null}::uuid)
     GROUP BY i.id
     ORDER BY i."referenceMonth" ASC`
  return rows.map((r) => ({
    id: r.id,
    creditCardId: r.creditCardId,
    referenceMonth: fromDbDate(r.referenceMonth),
    periodStart: fromDbDate(r.periodStart),
    closingDate: fromDbDate(r.closingDate),
    dueDate: fromDbDate(r.dueDate),
    purchasesCents: Number(r.purchases),
    creditsCents: Number(r.credits),
    paidCents: Number(r.paid),
    itemCount: Number(r.items),
  }))
}

export function toInvoiceSummary(row: InvoiceRow, today: IsoDate = todayIso()): InvoiceSummaryDto {
  const totalCents = row.purchasesCents - row.creditsCents
  return {
    id: row.id,
    creditCardId: row.creditCardId,
    referenceMonth: monthKeyOf(row.referenceMonth),
    periodStart: row.periodStart,
    closingDate: row.closingDate,
    dueDate: row.dueDate,
    totalCents,
    paidCents: row.paidCents,
    status: invoiceStatus(
      { totalCents, paidCents: row.paidCents, closingDate: row.closingDate, dueDate: row.dueDate },
      today,
    ),
    itemCount: row.itemCount,
  }
}

/**
 * The invoice purchases made today land on: the existing one whose period contains today,
 * or — when nothing created it yet — the computed cycle with zero totals (`id: null`).
 */
export function currentInvoiceOf(
  card: CardCycleConfig & { id: string },
  invoices: InvoiceRow[],
  today: IsoDate = todayIso(),
): InvoiceSummaryDto {
  const cycle = resolveInvoiceCycle(card, today, invoices)
  const row = invoices.find((inv) => inv.referenceMonth === cycle.referenceMonth)
  if (row) return toInvoiceSummary(row, today)
  const empty = { purchasesCents: 0, creditsCents: 0, paidCents: 0, itemCount: 0 }
  const virtual = { ...cycle, ...empty, id: '', creditCardId: card.id }
  return { ...toInvoiceSummary(virtual, today), id: null }
}

/** Creates the invoice for a resolved cycle, or returns the one already stored (snapshot). */
export async function upsertInvoice(
  db: Db,
  householdId: string,
  creditCardId: string,
  period: InvoicePeriod,
) {
  return db.invoice.upsert({
    where: {
      creditCardId_referenceMonth: {
        creditCardId,
        referenceMonth: toDbDate(period.referenceMonth),
      },
    },
    create: {
      householdId,
      creditCardId,
      referenceMonth: toDbDate(period.referenceMonth),
      periodStart: toDbDate(period.periodStart),
      closingDate: toDbDate(period.closingDate),
      dueDate: toDbDate(period.dueDate),
    },
    update: {},
  })
}

/** Every invoice of a card, newest due month first (future installments included). */
export async function listCardInvoices(
  householdId: string,
  creditCardId: string,
): Promise<InvoiceSummaryDto[]> {
  const card = await prisma.creditCard.findFirst({
    where: { id: creditCardId, householdId },
    select: { id: true },
  })
  if (!card) throw HttpError.notFound('Cartão não encontrado.')
  const today = todayIso()
  const rows = await loadInvoices(householdId, { creditCardId })
  return rows.map((row) => toInvoiceSummary(row, today)).reverse()
}

export const cardItemInclude = {
  installmentPlan: { select: { installmentCount: true } },
} satisfies Prisma.TransactionInclude

export function toCardItem(
  row: Prisma.TransactionGetPayload<{ include: typeof cardItemInclude }>,
): CardItemDto {
  return {
    id: row.id,
    kind: row.type === 'INCOME' ? 'REFUND' : 'PURCHASE',
    date: fromDbDate(row.date),
    description: row.description,
    amountCents: row.amountCents,
    categoryId: row.categoryId,
    paidById: row.paidById,
    notes: row.notes,
    installmentPlanId: row.installmentPlanId,
    installmentNumber: row.installmentNumber,
    installmentCount: row.installmentPlan?.installmentCount ?? null,
  }
}

export async function getInvoiceDetail(householdId: string, id: string): Promise<InvoiceDetailDto> {
  const [row] = await loadInvoices(householdId, { id })
  if (!row) throw HttpError.notFound('Fatura não encontrada.')
  const items = await prisma.transaction.findMany({
    where: { householdId, invoiceId: id, deletedAt: null, type: { in: ['EXPENSE', 'INCOME'] } },
    include: cardItemInclude,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  return { ...toInvoiceSummary(row), items: items.map(toCardItem) }
}
