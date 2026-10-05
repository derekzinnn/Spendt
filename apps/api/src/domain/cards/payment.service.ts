import {
  formatBRL,
  formatMonthLabel,
  todayIso,
  type InvoiceSummaryDto,
  type PayInvoiceInput,
} from '@spendly/shared'

import { toDbDate } from '../../lib/db-dates'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'

import { loadInvoices, toInvoiceSummary } from './invoice.service'

export interface InvoicePaymentResult {
  /** The TRANSFER row created — send its id back to "Desfazer". */
  transactionId: string
  invoice: InvoiceSummaryDto
  /** True when this payment settled the invoice in full. */
  settled: boolean
}

/**
 * Paying a credit-card invoice is a TRANSFER from an account into the invoice: it lowers the
 * account balance and frees the card's limit, both derived from this one row (integration
 * rule 3). Partial payments are allowed; paying more than what is left is not.
 */
export async function payInvoice(
  householdId: string,
  invoiceId: string,
  memberId: string,
  input: PayInvoiceInput,
): Promise<InvoicePaymentResult> {
  const [row] = await loadInvoices(householdId, { id: invoiceId })
  if (!row) throw HttpError.notFound('Fatura não encontrada.')

  const [account, card] = await Promise.all([
    prisma.account.findFirst({
      where: { id: input.accountId, householdId, archivedAt: null },
      select: { id: true },
    }),
    prisma.creditCard.findFirst({
      where: { id: row.creditCardId, householdId },
      select: { name: true },
    }),
  ])
  if (!account) throw HttpError.field('accountId', 'Escolha uma conta ativa da casa.')

  const summary = toInvoiceSummary(row)
  const remaining = summary.totalCents - summary.paidCents
  if (summary.totalCents <= 0) {
    throw HttpError.field('amountCents', 'Esta fatura não tem valor a pagar.', 409, 'INVOICE_EMPTY')
  }
  if (remaining <= 0) {
    throw HttpError.field('amountCents', 'Esta fatura já está paga.', 409, 'INVOICE_PAID')
  }
  if (input.amountCents > remaining) {
    throw HttpError.field(
      'amountCents',
      `Falta só ${formatBRL(remaining)} nesta fatura.`,
      409,
      'OVERPAYMENT',
    )
  }

  const date = input.date ?? todayIso()
  const payment = await prisma.transaction.create({
    data: {
      householdId,
      type: 'TRANSFER',
      status: 'PAID',
      amountCents: input.amountCents,
      date: toDbDate(date),
      paidDate: toDbDate(date),
      description: `Pagamento ${card?.name ?? 'fatura'} · ${formatMonthLabel(summary.referenceMonth, 'month')}`,
      accountId: input.accountId,
      creditCardId: row.creditCardId,
      invoiceId: row.id,
      paidById: memberId,
      createdById: memberId,
    },
    select: { id: true },
  })

  const [updated] = await loadInvoices(householdId, { id: invoiceId })
  return {
    transactionId: payment.id,
    invoice: toInvoiceSummary(updated!),
    settled: input.amountCents >= remaining,
  }
}
