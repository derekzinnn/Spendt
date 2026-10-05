import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  type ExportDto,
  type ExportQuery,
  type ExportRowDto,
} from '@spendly/shared'

import { fromDbDate, toDbDate } from '../../lib/db-dates'
import { prisma } from '../../lib/prisma'
import { ensureOccurrences } from '../recurring/recurring.service'

const day = (value: Date | null) => (value ? fromDbDate(value) : null)

/**
 * The ledger as a spreadsheet: ids replaced by the names the couple reads, and the amount
 * signed so any column total means something (expenses negative, incomes positive).
 *
 * Transfers are the one row that is neither: they keep their sign at zero effect by showing
 * "Conta → Conta" and a negative amount on the account that paid.
 */
export async function exportTransactions(
  householdId: string,
  { from, to }: ExportQuery,
): Promise<ExportDto> {
  await ensureOccurrences(householdId, to)

  const rows = await prisma.transaction.findMany({
    where: {
      householdId,
      deletedAt: null,
      date: { gte: toDbDate(from), lte: toDbDate(to) },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: {
      category: { select: { name: true, parent: { select: { name: true } } } },
      account: { select: { name: true, type: true } },
      toAccount: { select: { name: true } },
      creditCard: { select: { name: true } },
      paidBy: { select: { displayName: true } },
      installmentPlan: { select: { installmentCount: true } },
    },
  })

  const items: ExportRowDto[] = rows.map((row) => {
    const category = row.category
      ? row.category.parent
        ? `${row.category.parent.name} › ${row.category.name}`
        : row.category.name
      : ''
    const source = row.creditCard
      ? row.account
        ? `${row.account.name} → ${row.creditCard.name}` // paying an invoice
        : row.creditCard.name
      : row.toAccount
        ? `${row.account?.name ?? ''} → ${row.toAccount.name}`
        : (row.account?.name ?? '')
    return {
      date: fromDbDate(row.date),
      dueDate: day(row.dueDate),
      paidDate: day(row.paidDate),
      type: TRANSACTION_TYPE_LABELS[row.type],
      status: TRANSACTION_STATUS_LABELS[row.status],
      description: row.description,
      category,
      source,
      paidBy: row.paidBy?.displayName ?? '',
      installment:
        row.installmentNumber && row.installmentPlan
          ? `${row.installmentNumber}/${row.installmentPlan.installmentCount}`
          : '',
      notes: row.notes ?? '',
      amountCents: row.type === 'INCOME' ? row.amountCents : -row.amountCents,
    }
  })

  return { from, to, rows: items }
}
