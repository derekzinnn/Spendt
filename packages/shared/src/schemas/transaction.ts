import { z } from 'zod'

import {
  idSchema,
  isoDateSchema,
  monthKeySchema,
  positiveCentsSchema,
  transactionStatusSchema,
  transactionTypeSchema,
} from './primitives'

const descriptionSchema = z
  .string({ error: 'Descreva o lançamento' })
  .trim()
  .min(1, 'Descreva o lançamento')
  .max(120, 'Use no máximo 120 caracteres')

const notesSchema = z.string().trim().max(500).nullable()

/**
 * An account movement: expense, income or transfer between two accounts.
 * Card purchases go through `createCardPurchaseSchema` (they need an invoice).
 *
 * Shapes (mirrors the database CHECKs):
 * - EXPENSE / INCOME: PAID needs an account; PENDING (a bill) needs a due date and may not
 *   know its account yet.
 * - TRANSFER: from `accountId` to a different `toAccountId`, never a category.
 */
export const createTransactionSchema = z
  .object({
    type: transactionTypeSchema,
    status: transactionStatusSchema.default('PAID'),
    amountCents: positiveCentsSchema,
    /** Competence date: when it happened (or is expected to). */
    date: isoDateSchema,
    /** Bills: when it must be paid. Shows in "Contas a pagar" while PENDING. */
    dueDate: isoDateSchema.nullable().optional(),
    description: descriptionSchema,
    notes: notesSchema.optional(),
    categoryId: idSchema.nullable().optional(),
    accountId: idSchema.nullable().optional(),
    toAccountId: idSchema.nullable().optional(),
    /** Who paid / received — information only. Defaults to the person logged in. */
    paidById: idSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'TRANSFER') {
      if (!value.accountId)
        ctx.addIssue({ code: 'custom', path: ['accountId'], message: 'Escolha a conta de origem' })
      if (!value.toAccountId)
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Escolha a conta de destino',
        })
      if (value.accountId && value.accountId === value.toAccountId)
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Origem e destino precisam ser contas diferentes',
        })
      if (value.categoryId)
        ctx.addIssue({
          code: 'custom',
          path: ['categoryId'],
          message: 'Transferências não têm categoria',
        })
      return
    }
    if (value.toAccountId)
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'Só transferências têm destino',
      })
    if (value.status === 'PAID' && !value.accountId)
      ctx.addIssue({ code: 'custom', path: ['accountId'], message: 'Escolha a conta' })
    if (value.status === 'PENDING' && !value.dueDate)
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Informe o vencimento' })
  })
export type CreateTransactionInput = z.input<typeof createTransactionSchema>
export type TransactionInput = z.output<typeof createTransactionSchema>

/**
 * Every field optional; the type never changes. The API validates the merged row with the
 * same rules as creation. Card rows only accept description, category, paid-by and notes.
 */
export const updateTransactionSchema = z.object({
  status: transactionStatusSchema.optional(),
  amountCents: positiveCentsSchema.optional(),
  date: isoDateSchema.optional(),
  dueDate: isoDateSchema.nullable().optional(),
  /** When a PENDING row is marked PAID; defaults to today. */
  paidDate: isoDateSchema.nullable().optional(),
  description: descriptionSchema.optional(),
  notes: notesSchema.optional(),
  categoryId: idSchema.nullable().optional(),
  accountId: idSchema.nullable().optional(),
  toAccountId: idSchema.nullable().optional(),
  paidById: idSchema.nullable().optional(),
})
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>

export const TRANSACTION_KIND_FILTERS = ['all', 'expense', 'income', 'transfer', 'pending'] as const
export type TransactionKindFilter = (typeof TRANSACTION_KIND_FILTERS)[number]

export const listTransactionsQuerySchema = z.object({
  /** Competence month, "YYYY-MM". */
  month: monthKeySchema,
  kind: z.enum(TRANSACTION_KIND_FILTERS).default('all'),
  /** A parent category also matches its subcategories. */
  categoryId: idSchema.optional(),
  accountId: idSchema.optional(),
  creditCardId: idSchema.optional(),
  paidById: idSchema.optional(),
  q: z.string().trim().max(80).optional(),
})
export type ListTransactionsQuery = z.input<typeof listTransactionsQuerySchema>
