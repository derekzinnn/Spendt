import { z } from 'zod'

import { idSchema, isoDateSchema, monthKeySchema, positiveCentsSchema } from './primitives'

/**
 * Paying a credit-card invoice: a TRANSFER from an account into the invoice. Partial payments
 * are allowed; paying more than what is left is not (the invoice would go negative).
 */
export const payInvoiceSchema = z.object({
  accountId: idSchema,
  amountCents: positiveCentsSchema,
  /** Defaults to today in São Paulo. */
  date: isoDateSchema.optional(),
})
export type PayInvoiceInput = z.input<typeof payInvoiceSchema>

/** Paying a pending bill (an account row): which account it left and when. */
export const payBillSchema = z.object({
  accountId: idSchema,
  paidDate: isoDateSchema.optional(),
})
export type PayBillInput = z.input<typeof payBillSchema>

export const listBillsQuerySchema = z.object({
  /** Everything still owed up to the end of this month (earlier overdue bills included). */
  month: monthKeySchema,
})
export type ListBillsQuery = z.input<typeof listBillsQuerySchema>
