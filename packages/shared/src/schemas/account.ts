import { z } from 'zod'

import {
  accountTypeSchema,
  centsSchema,
  idSchema,
  isoDateSchema,
  paletteKeySchema,
} from './primitives'

export const accountNameSchema = z
  .string({ error: 'Informe um nome' })
  .trim()
  .min(1, 'Informe um nome')
  .max(40, 'Use no máximo 40 caracteres')

export const createAccountSchema = z.object({
  name: accountNameSchema,
  type: accountTypeSchema,
  color: paletteKeySchema,
  /** Member who holds the account; `null` = joint account. */
  holderId: idSchema.nullable(),
  /** Balance on `initialBalanceDate`; may be negative (cheque especial). */
  initialBalanceCents: centsSchema,
  initialBalanceDate: isoDateSchema,
})
export type CreateAccountInput = z.infer<typeof createAccountSchema>

export const updateAccountSchema = createAccountSchema.partial()
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
