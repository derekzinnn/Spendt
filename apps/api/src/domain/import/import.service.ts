import {
  resolveInvoiceCycle,
  type CommitImportInput,
  type DeletedItemsDto,
  type ImportPreviewDto,
  type ImportPreviewRowDto,
  type InvoicePeriod,
  type PreviewImportInput,
} from '@spendly/shared'

import { toDbDate } from '../../lib/db-dates'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'
import { findCard } from '../cards/card.service'
import { loadInvoices, upsertInvoice } from '../cards/invoice.service'

import { guessCategory, type PastRow } from './match'

/** How many past rows we look at to guess categories — a year of a busy household. */
const PAST_LIMIT = 1500

interface Target {
  accountId: string | null
  creditCardId: string | null
}

/** The statement belongs to one of the household's own accounts or cards — never a foreign id. */
async function resolveTarget(householdId: string, target: Target) {
  if (target.creditCardId) {
    const card = await findCard(householdId, target.creditCardId)
    if (card.archivedAt) {
      throw HttpError.field('creditCardId', 'Este cartão está arquivado.', 409, 'CARD_ARCHIVED')
    }
    return { card, account: null }
  }
  const account = await prisma.account.findFirst({
    where: { id: target.accountId ?? '', householdId },
  })
  if (!account) throw HttpError.notFound('Conta não encontrada.')
  if (account.archivedAt) {
    throw HttpError.field('accountId', 'Esta conta está arquivada.', 409, 'ACCOUNT_ARCHIVED')
  }
  return { card: null, account }
}

/**
 * What the household already filed, grouped by description + category with a count, so the
 * guess follows the habit and not a single old row.
 */
async function pastRows(householdId: string): Promise<PastRow[]> {
  const grouped = await prisma.transaction.groupBy({
    by: ['description', 'categoryId'],
    where: { householdId, deletedAt: null, categoryId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: PAST_LIMIT,
  })
  return grouped.flatMap((row) =>
    row.categoryId
      ? [{ description: row.description, categoryId: row.categoryId, count: row._count._all }]
      : [],
  )
}

/**
 * Reads a statement without writing anything: for each line, the category the couple would
 * probably use and whether the ledger already has that exact day and amount.
 */
export async function previewImport(
  householdId: string,
  input: PreviewImportInput,
): Promise<ImportPreviewDto> {
  const { card, account } = await resolveTarget(householdId, input)
  const past = await pastRows(householdId)

  const dates = input.rows.map((row) => toDbDate(row.date))
  const existing = await prisma.transaction.findMany({
    where: {
      householdId,
      deletedAt: null,
      date: { in: dates },
      ...(card ? { creditCardId: card.id } : { accountId: account?.id }),
    },
    select: { id: true, date: true, amountCents: true, type: true },
  })

  // A line is "already there" when the same day carries the same amount in the same direction.
  const taken = new Set<string>()
  const key = (date: string, amountCents: number, type: string) => `${date}|${amountCents}|${type}`
  const byKey = new Map<string, string[]>()
  for (const row of existing) {
    const k = key(row.date.toISOString().slice(0, 10), row.amountCents, row.type)
    byKey.set(k, [...(byKey.get(k) ?? []), row.id])
  }

  const rows: ImportPreviewRowDto[] = input.rows.map((row, index) => {
    const candidates = byKey.get(key(row.date, row.amountCents, row.type)) ?? []
    const duplicateOfId = candidates.find((id) => !taken.has(id)) ?? null
    if (duplicateOfId) taken.add(duplicateOfId)
    return {
      index,
      date: row.date,
      description: row.description,
      amountCents: row.amountCents,
      type: row.type,
      categoryId: guessCategory(row.description, past),
      duplicateOfId,
    }
  })

  return {
    rows,
    duplicateCount: rows.filter((row) => row.duplicateOfId).length,
    guessedCount: rows.filter((row) => row.categoryId).length,
  }
}

/** Categories must exist in this household and match the row's direction. */
async function assertCategories(householdId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, 'EXPENSE' | 'INCOME'>()
  const found = await prisma.category.findMany({
    where: { id: { in: ids }, householdId, archivedAt: null },
    select: { id: true, kind: true },
  })
  if (found.length !== new Set(ids).size) {
    throw HttpError.field('categoryId', 'Escolha categorias ativas desta casa.')
  }
  return new Map(found.map((row) => [row.id, row.kind]))
}

/**
 * Writes the confirmed lines. Account rows are PAID movements on their date; card rows land
 * on the invoice their date belongs to, exactly like a purchase typed by hand.
 *
 * Everything goes in one database transaction and comes back as a list of ids, so a wrong
 * file is one "Desfazer" away.
 */
export async function commitImport(
  householdId: string,
  memberId: string,
  input: CommitImportInput,
): Promise<DeletedItemsDto & { count: number }> {
  const { card, account } = await resolveTarget(householdId, input)
  const kinds = await assertCategories(
    householdId,
    input.rows.flatMap((row) => (row.categoryId ? [row.categoryId] : [])),
  )
  for (const row of input.rows) {
    if (row.categoryId && kinds.get(row.categoryId) !== row.type) {
      throw HttpError.field(
        'categoryId',
        `"${row.description}" está com uma categoria de outro tipo.`,
      )
    }
  }

  const ids = await prisma.$transaction(async (tx) => {
    const periods: InvoicePeriod[] = card
      ? await loadInvoices(householdId, { creditCardId: card.id }, tx)
      : []
    const created: string[] = []
    for (const row of input.rows) {
      let invoiceId: string | null = null
      if (card) {
        const cycle = resolveInvoiceCycle(card, row.date, periods)
        const invoice = await upsertInvoice(tx, householdId, card.id, cycle)
        if (!cycle.existing) periods.push(cycle)
        invoiceId = invoice.id
      }
      const made = await tx.transaction.create({
        data: {
          householdId,
          type: row.type,
          status: 'PAID',
          amountCents: row.amountCents,
          date: toDbDate(row.date),
          // Card rows live on an invoice and have no paid date of their own.
          paidDate: card ? null : toDbDate(row.date),
          description: row.description,
          categoryId: row.categoryId,
          accountId: account?.id ?? null,
          creditCardId: card?.id ?? null,
          invoiceId,
          paidById: memberId,
          createdById: memberId,
        },
        select: { id: true },
      })
      created.push(made.id)
    }
    return created
  })

  return { ids, count: ids.length }
}

/**
 * "Desfazer" for a whole import: soft-deletes the rows it created, in one statement. The
 * invoices it may have opened stay — they are empty and the next purchase reuses them.
 */
export async function undoImport(householdId: string, ids: string[]): Promise<{ count: number }> {
  const { count } = await prisma.transaction.updateMany({
    where: { id: { in: ids }, householdId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return { count }
}
