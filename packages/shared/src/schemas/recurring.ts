import { z } from 'zod'

import { idSchema, isoDateSchema, positiveCentsSchema, recurrenceFrequencySchema } from './primitives'

/**
 * Rent, subscriptions, salary… A rule materializes one row per occurrence:
 * - on an account (or none yet): a PENDING bill/income due that day — it feeds "Contas a pagar"
 *   and the forecast; `autoConfirm` turns it PAID once the day arrives (automatic debit);
 * - on a card: a purchase on that day's invoice, created when the day arrives.
 */
export const createRecurringRuleSchema = z
  .object({
    type: z.enum(['EXPENSE', 'INCOME']),
    description: z
      .string({ error: 'Descreva a recorrência' })
      .trim()
      .min(1, 'Descreva a recorrência')
      .max(120, 'Use no máximo 120 caracteres'),
    amountCents: positiveCentsSchema,
    categoryId: idSchema.nullable(),
    accountId: idSchema.nullable(),
    creditCardId: idSchema.nullable(),
    paidById: idSchema.nullable().optional(),
    frequency: recurrenceFrequencySchema.default('MONTHLY'),
    interval: z.int().min(1).max(12).default(1),
    /** First occurrence; its day of the month (or weekday) is the anchor. */
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
    autoConfirm: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.accountId && value.creditCardId)
      ctx.addIssue({
        code: 'custom',
        path: ['creditCardId'],
        message: 'Escolha uma conta ou um cartão, não os dois',
      })
    if (value.creditCardId && value.type === 'INCOME')
      ctx.addIssue({
        code: 'custom',
        path: ['creditCardId'],
        message: 'Receitas entram em uma conta',
      })
    if (value.endDate && value.endDate < value.startDate)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'O fim vem depois do início' })
  })
export type CreateRecurringRuleInput = z.input<typeof createRecurringRuleSchema>
export type RecurringRuleInput = z.output<typeof createRecurringRuleSchema>

/** Changes apply to occurrences not yet paid, from today on. */
export const updateRecurringRuleSchema = z.object({
  description: z.string().trim().min(1).max(120).optional(),
  amountCents: positiveCentsSchema.optional(),
  categoryId: idSchema.nullable().optional(),
  accountId: idSchema.nullable().optional(),
  paidById: idSchema.nullable().optional(),
  endDate: isoDateSchema.nullable().optional(),
  autoConfirm: z.boolean().optional(),
})
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>
