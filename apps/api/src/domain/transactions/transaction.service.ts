import {
  createTransactionSchema,
  firstDayOfMonth,
  lastDayOfMonth,
  todayIso,
  type DeletedItemsDto,
  type ListTransactionsQuery,
  type PurchaseScope,
  type TransactionDto,
  type TransactionInput,
  type TransactionListDto,
  listTransactionsQuerySchema,
  type UpdateTransactionInput,
} from '@spendly/shared'

import type { Prisma } from '../../generated/prisma/client'
import { fromDbDate, toDbDate } from '../../lib/db-dates'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'
import { assertHolder } from '../accounts/account.service'
import { deleteCardPurchase } from '../cards/purchase.service'
import { ensureOccurrences } from '../recurring/recurring.service'

const include = {
  installmentPlan: { select: { installmentCount: true } },
} satisfies Prisma.TransactionInclude

type Row = Prisma.TransactionGetPayload<{ include: typeof include }>

const day = (value: Date | null) => (value ? fromDbDate(value) : null)

/** Most recent matches a whole-ledger search returns before it says "refine a busca". */
const SEARCH_LIMIT = 500

export function toTransactionDto(row: Row): TransactionDto {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amountCents: row.amountCents,
    date: fromDbDate(row.date),
    dueDate: day(row.dueDate),
    paidDate: day(row.paidDate),
    description: row.description,
    notes: row.notes,
    categoryId: row.categoryId,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    creditCardId: row.creditCardId,
    invoiceId: row.invoiceId,
    paidById: row.paidById,
    installmentPlanId: row.installmentPlanId,
    installmentNumber: row.installmentNumber,
    installmentCount: row.installmentPlan?.installmentCount ?? null,
    recurringRuleId: row.recurringRuleId,
    createdAt: row.createdAt.toISOString(),
  }
}

/** The month's totals, over the rows on screen (filters apply). */
export function totalsOf(items: TransactionDto[]) {
  let incomeCents = 0
  let expenseCents = 0
  let pendingCents = 0
  for (const t of items) {
    if (t.type === 'EXPENSE') expenseCents += t.amountCents
    else if (t.type === 'INCOME') {
      // A credit on a card (estorno) lowers spending instead of counting as income.
      if (t.creditCardId) expenseCents -= t.amountCents
      else incomeCents += t.amountCents
    }
    if (t.status === 'PENDING' && t.type !== 'TRANSFER') pendingCents += t.amountCents
  }
  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    pendingCents,
    count: items.length,
  }
}

export async function listTransactions(
  householdId: string,
  rawQuery: ListTransactionsQuery,
): Promise<TransactionListDto> {
  const query = listTransactionsQuerySchema.parse(rawQuery)
  // Recurring rules materialize lazily, up to the month being looked at.
  await ensureOccurrences(householdId, lastDayOfMonth(query.month))
  // Searching looks at the whole ledger: "padaria" is useless if it only finds the month
  // you happen to have open. Without a search the list stays scoped to that month.
  const searching = Boolean(query.q)
  const where: Prisma.TransactionWhereInput = {
    householdId,
    deletedAt: null,
    ...(searching
      ? {}
      : {
          date: {
            gte: toDbDate(firstDayOfMonth(query.month)),
            lte: toDbDate(lastDayOfMonth(query.month)),
          },
        }),
  }
  if (query.kind === 'expense') where.type = 'EXPENSE'
  if (query.kind === 'income') Object.assign(where, { type: 'INCOME', creditCardId: null })
  if (query.kind === 'transfer') where.type = 'TRANSFER'
  if (query.kind === 'pending') where.status = 'PENDING'
  if (query.categoryId) {
    const children = await prisma.category.findMany({
      where: { householdId, parentId: query.categoryId },
      select: { id: true },
    })
    where.categoryId = { in: [query.categoryId, ...children.map((c) => c.id)] }
  }
  const and: Prisma.TransactionWhereInput[] = []
  if (query.accountId)
    and.push({ OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }] })
  if (query.creditCardId) where.creditCardId = query.creditCardId
  if (query.paidById) where.paidById = query.paidById
  if (query.q) and.push({ description: { contains: query.q, mode: 'insensitive' } })
  if (and.length) where.AND = and

  // A whole-ledger search can match a lot; the grid renders every row it is given.
  const limit = searching ? SEARCH_LIMIT : 5000
  const rows = await prisma.transaction.findMany({
    where,
    include,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit + 1,
  })
  const truncated = rows.length > limit
  const items = rows.slice(0, limit).map(toTransactionDto)
  return { items, totals: totalsOf(items), searchedEverything: searching, truncated }
}

async function findRow(householdId: string, id: string): Promise<Row> {
  const row = await prisma.transaction.findFirst({
    where: { id, householdId, deletedAt: null },
    include,
  })
  if (!row) throw HttpError.notFound('Lançamento não encontrado.')
  return row
}

async function assertAccount(
  householdId: string,
  accountId: string | null | undefined,
  field: 'accountId' | 'toAccountId',
  allowArchivedId?: string | null,
) {
  if (!accountId) return
  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId },
    select: { archivedAt: true },
  })
  if (!account || (account.archivedAt && accountId !== allowArchivedId)) {
    throw HttpError.field(field, 'Escolha uma conta ativa da casa.')
  }
}

async function assertCategory(
  householdId: string,
  categoryId: string | null | undefined,
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER',
) {
  if (!categoryId) return
  const category = await prisma.category.findFirst({
    where: { id: categoryId, householdId, archivedAt: null },
    select: { kind: true },
  })
  if (!category || category.kind !== type) {
    throw HttpError.field(
      'categoryId',
      type === 'INCOME' ? 'Escolha uma categoria de receita.' : 'Escolha uma categoria de despesa.',
    )
  }
}

async function validate(householdId: string, input: TransactionInput, current?: Row) {
  await assertAccount(householdId, input.accountId, 'accountId', current?.accountId)
  await assertAccount(householdId, input.toAccountId, 'toAccountId', current?.toAccountId)
  await assertCategory(householdId, input.categoryId, input.type)
  await assertHolder(householdId, input.paidById)
}

export async function createTransaction(
  householdId: string,
  memberId: string,
  input: TransactionInput,
): Promise<TransactionDto> {
  const paidById = input.paidById === undefined ? memberId : input.paidById
  await validate(householdId, { ...input, paidById })
  const row = await prisma.transaction.create({
    data: {
      householdId,
      type: input.type,
      status: input.status,
      amountCents: input.amountCents,
      date: toDbDate(input.date),
      dueDate: input.dueDate ? toDbDate(input.dueDate) : null,
      paidDate: input.status === 'PAID' ? toDbDate(input.date) : null,
      description: input.description,
      notes: input.notes ?? null,
      categoryId: input.type === 'TRANSFER' ? null : (input.categoryId ?? null),
      accountId: input.accountId ?? null,
      toAccountId: input.type === 'TRANSFER' ? (input.toAccountId ?? null) : null,
      paidById,
      createdById: memberId,
    },
    include,
  })
  return toTransactionDto(row)
}

/** Card rows (purchases, credits, invoice payments) keep their invoice: only text fields change. */
const CARD_EDITABLE = new Set(['description', 'notes', 'categoryId', 'paidById'])

export async function updateTransaction(
  householdId: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionDto> {
  const row = await findRow(householdId, id)
  const changed = Object.entries(input).filter(([, value]) => value !== undefined)

  if (row.creditCardId) {
    if (changed.some(([key]) => !CARD_EDITABLE.has(key))) {
      throw new HttpError(
        400,
        'CARD_ROW_LOCKED',
        'Compras no cartão ficam na fatura: para mudar valor ou data, exclua e lance de novo.',
      )
    }
    await assertCategory(householdId, input.categoryId, row.type)
    await assertHolder(householdId, input.paidById)
  } else {
    const current = toTransactionDto(row)
    const merged = createTransactionSchema.parse({
      type: current.type,
      status: input.status ?? current.status,
      amountCents: input.amountCents ?? current.amountCents,
      date: input.date ?? current.date,
      dueDate: input.dueDate !== undefined ? input.dueDate : current.dueDate,
      description: input.description ?? current.description,
      notes: input.notes !== undefined ? input.notes : current.notes,
      categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
      accountId: input.accountId !== undefined ? input.accountId : current.accountId,
      toAccountId: input.toAccountId !== undefined ? input.toAccountId : current.toAccountId,
      paidById: input.paidById !== undefined ? input.paidById : current.paidById,
    })
    await validate(householdId, merged, row)
  }

  // Marking as paid records when; going back to pending clears it.
  let paidDate: Date | null | undefined
  if (input.status === 'PAID' && row.status !== 'PAID')
    paidDate = toDbDate(input.paidDate ?? todayIso())
  else if (input.status === 'PENDING') paidDate = null
  else if (input.paidDate !== undefined) paidDate = input.paidDate ? toDbDate(input.paidDate) : null

  const updated = await prisma.transaction.update({
    where: { id: row.id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
      ...(input.date !== undefined ? { date: toDbDate(input.date) } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? toDbDate(input.dueDate) : null }
        : {}),
      ...(paidDate !== undefined ? { paidDate } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.toAccountId !== undefined ? { toAccountId: input.toAccountId } : {}),
      ...(input.paidById !== undefined ? { paidById: input.paidById } : {}),
    },
    include,
  })
  return toTransactionDto(updated)
}

/** Soft delete (powers "Desfazer"). Installment rows honour the scope. */
export async function deleteTransaction(
  householdId: string,
  id: string,
  scope: PurchaseScope,
): Promise<DeletedItemsDto> {
  const row = await findRow(householdId, id)
  if (row.installmentPlanId) return deleteCardPurchase(householdId, id, scope)
  await prisma.transaction.update({ where: { id: row.id }, data: { deletedAt: new Date() } })
  return { ids: [row.id] }
}

export async function restoreTransactions(householdId: string, ids: string[]) {
  const result = await prisma.transaction.updateMany({
    where: { id: { in: ids }, householdId, deletedAt: { not: null } },
    data: { deletedAt: null },
  })
  return { restored: result.count }
}
