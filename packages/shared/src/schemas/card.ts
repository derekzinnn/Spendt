import { z } from 'zod'

import {
  cardBrandSchema,
  idSchema,
  isoDateSchema,
  paletteKeySchema,
  positiveCentsSchema,
} from './primitives'

export const cardNameSchema = z
  .string({ error: 'Informe um nome' })
  .trim()
  .min(1, 'Informe um nome')
  .max(40, 'Use no máximo 40 caracteres')

const cardDaySchema = (message: string) =>
  z.int({ error: message }).min(1, message).max(31, message)

export const createCardSchema = z.object({
  name: cardNameSchema,
  brand: cardBrandSchema,
  color: paletteKeySchema,
  /** Last four digits, just to tell cards apart on screen. */
  lastFour: z
    .string()
    .regex(/^\d{4}$/, 'Use os 4 últimos números')
    .nullable(),
  limitCents: positiveCentsSchema,
  /** Purchases ON this day already go to the next invoice. 1–31, clamped to the month. */
  closingDay: cardDaySchema('Dia de fechamento entre 1 e 31'),
  dueDay: cardDaySchema('Dia de vencimento entre 1 e 31'),
  /** Account that usually pays the invoice. */
  paymentAccountId: idSchema.nullable(),
  /** Member whose name is on the card; `null` = shared. Information only. */
  holderId: idSchema.nullable(),
})
export type CreateCardInput = z.infer<typeof createCardSchema>

export const updateCardSchema = createCardSchema.partial()
export type UpdateCardInput = z.infer<typeof updateCardSchema>

export const MAX_INSTALLMENTS = 24

const descriptionSchema = z
  .string({ error: 'Descreva a compra' })
  .trim()
  .min(1, 'Descreva a compra')
  .max(120, 'Use no máximo 120 caracteres')

/**
 * A purchase on a credit card (or a credit/estorno with `kind: 'REFUND'`). The API assigns
 * the invoice from the date; with `installments > 1` it creates an installment plan and one
 * row per installment, each in its own invoice.
 */
export const createCardPurchaseSchema = z
  .object({
    creditCardId: idSchema,
    kind: z.enum(['PURCHASE', 'REFUND']).default('PURCHASE'),
    description: descriptionSchema,
    /** Total amount (the plan total when in installments). */
    amountCents: positiveCentsSchema,
    date: isoDateSchema,
    categoryId: idSchema.nullable(),
    installments: z.int().min(1).max(MAX_INSTALLMENTS, `No máximo ${MAX_INSTALLMENTS}x`).default(1),
    /** Who used the card — information only. Defaults to the person logged in. */
    paidById: idSchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.kind === 'PURCHASE' || v.installments === 1, {
    path: ['installments'],
    message: 'Estornos não são parcelados',
  })
  .refine((v) => v.amountCents >= v.installments, {
    path: ['installments'],
    message: 'Cada parcela precisa de pelo menos R$ 0,01',
  })
export type CreateCardPurchaseInput = z.input<typeof createCardPurchaseSchema>
export type CardPurchaseInput = z.output<typeof createCardPurchaseSchema>

/** Which rows of an installment plan an edit or delete applies to. */
export const PURCHASE_SCOPES = ['one', 'following', 'all'] as const
export type PurchaseScope = (typeof PURCHASE_SCOPES)[number]
export const PURCHASE_SCOPE_LABELS: Record<PurchaseScope, string> = {
  one: 'Só esta parcela',
  following: 'Esta e as próximas',
  all: 'Todas as parcelas',
}
export const purchaseScopeSchema = z.enum(PURCHASE_SCOPES).default('one')

/** Non-financial fields; to change amount, date or installments, delete and re-create. */
export const updateCardPurchaseSchema = z.object({
  description: descriptionSchema.optional(),
  categoryId: idSchema.nullable().optional(),
  paidById: idSchema.nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})
export type UpdateCardPurchaseInput = z.infer<typeof updateCardPurchaseSchema>

export const restoreTransactionsSchema = z.object({
  ids: z.array(idSchema).min(1).max(200),
})
