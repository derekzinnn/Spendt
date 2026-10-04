import { z } from 'zod'

import { MAX_CENTS } from '../money'
import { categoryIconKeySchema, categoryKindSchema, idSchema, paletteKeySchema } from './primitives'

export const categoryNameSchema = z
  .string({ error: 'Informe um nome' })
  .trim()
  .min(1, 'Informe um nome')
  .max(40, 'Use no máximo 40 caracteres')

/** Monthly budget in cents; `null` = no budget. Only expense categories have budgets. */
export const budgetCentsSchema = z
  .int()
  .min(1, 'O orçamento precisa ser maior que zero')
  .max(MAX_CENTS)

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  kind: categoryKindSchema,
  icon: categoryIconKeySchema,
  color: paletteKeySchema,
  /** Parent category (one level of subcategories). */
  parentId: idSchema.nullish(),
  monthlyBudgetCents: budgetCentsSchema.nullish(),
})
export type CreateCategoryInput = z.infer<typeof createCategorySchema>

/** Kind and parent are fixed after creation (moving categories comes later). */
export const updateCategorySchema = z
  .object({
    name: categoryNameSchema,
    icon: categoryIconKeySchema,
    color: paletteKeySchema,
    monthlyBudgetCents: budgetCentsSchema.nullable(),
  })
  .partial()
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
