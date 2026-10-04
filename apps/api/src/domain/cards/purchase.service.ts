import {
  allocateCents,
  installmentDate,
  resolveInstallmentCycle,
  todayIso,
  type CardItemDto,
  type CardPurchaseInput,
  type CardPurchaseResultDto,
  type DeletedItemsDto,
  type InvoicePeriod,
  type PurchaseScope,
  type UpdateCardPurchaseInput,
} from '@spendly/shared'

import type { Prisma } from '../../generated/prisma/client'
import { toDbDate } from '../../lib/db-dates'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'
import { assertHolder } from '../accounts/account.service'

import { findCard } from './card.service'
import {
  cardItemInclude,
  loadInvoices,
  toCardItem,
  toInvoiceSummary,
  upsertInvoice,
} from './invoice.service'

async function assertExpenseCategory(householdId: string, categoryId: string | null | undefined) {
  if (!categoryId) return
  const category = await prisma.category.findFirst({
    where: { id: categoryId, householdId, archivedAt: null, kind: 'EXPENSE' },
    select: { id: true },
  })
  if (!category) throw HttpError.field('categoryId', 'Escolha uma categoria de despesa ativa.')
}

/**
 * A card purchase (or credit): assigned to the right invoice by its date, or split into an
 * installment plan with one row per installment — installment k lands on the cycle k months
 * after the purchase's cycle. Extra cents of an uneven split go to the first installments.
 */
export async function createCardPurchase(
  householdId: string,
  memberId: string,
  input: CardPurchaseInput,
): Promise<CardPurchaseResultDto> {
  const card = await findCard(householdId, input.creditCardId)
  if (card.archivedAt) {
    throw HttpError.field('creditCardId', 'Este cartão está arquivado.', 409, 'CARD_ARCHIVED')
  }
  await assertExpenseCategory(householdId, input.categoryId)
  const paidById = input.paidById === undefined ? memberId : input.paidById
  await assertHolder(householdId, paidById)

  const count = input.installments
  const amounts =
    count > 1 ? allocateCents(input.amountCents, Array(count).fill(1)) : [input.amountCents]
  const type = input.kind === 'REFUND' ? 'INCOME' : 'EXPENSE'

  const { rowIds, firstInvoiceId, planId } = await prisma.$transaction(async (tx) => {
    const periods: InvoicePeriod[] = await loadInvoices(householdId, { creditCardId: card.id }, tx)
    const plan =
      count > 1
        ? await tx.installmentPlan.create({
            data: {
              householdId,
              description: input.description,
              totalAmountCents: input.amountCents,
              installmentCount: count,
              purchaseDate: toDbDate(input.date),
            },
          })
        : null

    const ids: string[] = []
    let first: string | undefined
    for (let k = 0; k < count; k++) {
      const cycle = resolveInstallmentCycle(card, input.date, k, periods)
      const invoice = await upsertInvoice(tx, householdId, card.id, cycle)
      if (!cycle.existing) periods.push(cycle)
      first ??= invoice.id
      const row = await tx.transaction.create({
        data: {
          householdId,
          type,
          status: 'PAID',
          amountCents: amounts[k]!,
          date: toDbDate(installmentDate(input.date, k)),
          description: input.description,
          notes: input.notes ?? null,
          categoryId: input.categoryId,
          creditCardId: card.id,
          invoiceId: invoice.id,
          paidById,
          createdById: memberId,
          installmentPlanId: plan?.id ?? null,
          installmentNumber: plan ? k + 1 : null,
        },
        select: { id: true },
      })
      ids.push(row.id)
    }
    return { rowIds: ids, firstInvoiceId: first!, planId: plan?.id ?? null }
  })

  const [items, [invoiceRow]] = await Promise.all([
    prisma.transaction.findMany({
      where: { id: { in: rowIds } },
      include: cardItemInclude,
      orderBy: { installmentNumber: 'asc' },
    }),
    loadInvoices(householdId, { id: firstInvoiceId }),
  ])
  const invoice = toInvoiceSummary(invoiceRow!, todayIso())
  const totalBefore = invoice.totalCents - (type === 'EXPENSE' ? amounts[0]! : -amounts[0]!)
  return {
    items: items.map(toCardItem),
    invoice,
    installmentPlanId: planId,
    // Late entry on an invoice already paid in full: it stays there (partially paid now).
    landedOnPaidInvoice: type === 'EXPENSE' && totalBefore > 0 && invoice.paidCents >= totalBefore,
  }
}

/** The purchase row an edit/delete targets, plus the rows its scope covers. */
async function rowsInScope(householdId: string, id: string, scope: PurchaseScope) {
  const target = await prisma.transaction.findFirst({
    where: {
      id,
      householdId,
      deletedAt: null,
      creditCardId: { not: null },
      type: { in: ['EXPENSE', 'INCOME'] },
    },
  })
  if (!target) throw HttpError.notFound('Compra não encontrada.')
  if (!target.installmentPlanId || scope === 'one') return { target, ids: [target.id] }

  const where: Prisma.TransactionWhereInput = {
    householdId,
    deletedAt: null,
    installmentPlanId: target.installmentPlanId,
    ...(scope === 'following' ? { installmentNumber: { gte: target.installmentNumber ?? 1 } } : {}),
  }
  const rows = await prisma.transaction.findMany({ where, select: { id: true } })
  return { target, ids: rows.map((r) => r.id) }
}

export async function updateCardPurchase(
  householdId: string,
  id: string,
  scope: PurchaseScope,
  input: UpdateCardPurchaseInput,
): Promise<CardItemDto[]> {
  const { target, ids } = await rowsInScope(householdId, id, scope)
  await assertExpenseCategory(householdId, input.categoryId)
  await assertHolder(householdId, input.paidById)

  const data: Prisma.TransactionUpdateManyMutationInput & {
    categoryId?: string | null
    paidById?: string | null
  } = {
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.paidById !== undefined ? { paidById: input.paidById } : {}),
  }
  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({ where: { id: { in: ids }, householdId }, data })
    if (scope === 'all' && target.installmentPlanId && input.description !== undefined) {
      await tx.installmentPlan.update({
        where: { id: target.installmentPlanId },
        data: { description: input.description },
      })
    }
  })
  const rows = await prisma.transaction.findMany({
    where: { id: { in: ids } },
    include: cardItemInclude,
    orderBy: [{ date: 'asc' }, { installmentNumber: 'asc' }],
  })
  return rows.map(toCardItem)
}

/** Soft delete (powers "Desfazer"); returns the ids to restore. */
export async function deleteCardPurchase(
  householdId: string,
  id: string,
  scope: PurchaseScope,
): Promise<DeletedItemsDto> {
  const { ids } = await rowsInScope(householdId, id, scope)
  await prisma.transaction.updateMany({
    where: { id: { in: ids }, householdId },
    data: { deletedAt: new Date() },
  })
  return { ids }
}

export async function restoreCardPurchases(householdId: string, ids: string[]) {
  const result = await prisma.transaction.updateMany({
    where: { id: { in: ids }, householdId, deletedAt: { not: null }, creditCardId: { not: null } },
    data: { deletedAt: null },
  })
  return { restored: result.count }
}
