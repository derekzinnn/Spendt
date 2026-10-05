import { z } from 'zod'

import { idSchema, isoDateSchema, positiveCentsSchema } from './primitives'

/**
 * Import and export of bank / card statements.
 *
 * The file itself never reaches the API: the browser reads the CSV/XLSX, maps its columns and
 * sends plain JSON rows. So the API stays JSON-only (the Origin check and the session cookie
 * keep working unchanged) and the person always sees what will be written before it is.
 */

/** One line read from the file, already mapped to our columns. */
export const importRowSchema = z.object({
  date: isoDateSchema,
  description: z.string().trim().min(1, 'Descreva o lançamento').max(120),
  /** Always positive; the direction is in `type`. */
  amountCents: positiveCentsSchema,
  type: z.enum(['EXPENSE', 'INCOME']),
})
export type ImportRow = z.infer<typeof importRowSchema>

/** What the person confirmed after reviewing: the category may have been corrected. */
export const reviewedImportRowSchema = importRowSchema.extend({
  categoryId: idSchema.nullable().default(null),
})
export type ReviewedImportRow = z.infer<typeof reviewedImportRowSchema>

export const MAX_IMPORT_ROWS = 2000

/** Where the rows land: an account statement or a card statement (dates pick the invoice). */
const target = {
  accountId: idSchema.nullable().default(null),
  creditCardId: idSchema.nullable().default(null),
}

const oneTarget = (value: { accountId: string | null; creditCardId: string | null }) =>
  Boolean(value.accountId) !== Boolean(value.creditCardId)
const TARGET_MESSAGE = 'Escolha a conta ou o cartão do extrato'

const rows = <T extends z.ZodType>(row: T) =>
  z
    .array(row)
    .min(1, 'Nenhuma linha para importar')
    .max(MAX_IMPORT_ROWS, `Importe no máximo ${MAX_IMPORT_ROWS} linhas por vez`)

export const previewImportSchema = z
  .object({ ...target, rows: rows(importRowSchema) })
  .refine(oneTarget, { message: TARGET_MESSAGE, path: ['accountId'] })
export type PreviewImportInput = z.infer<typeof previewImportSchema>

export const commitImportSchema = z
  .object({ ...target, rows: rows(reviewedImportRowSchema) })
  .refine(oneTarget, { message: TARGET_MESSAGE, path: ['accountId'] })
export type CommitImportInput = z.infer<typeof commitImportSchema>

/** Export window: a month, a year, or any range the person picks. */
export const exportQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((value) => value.from <= value.to, {
    message: 'O período começa depois de terminar',
    path: ['to'],
  })
export type ExportQuery = z.infer<typeof exportQuerySchema>
