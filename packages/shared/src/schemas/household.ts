import { z } from 'zod'

import { emailSchema, householdNameSchema } from './auth'
import { paletteKeySchema } from './primitives'

export const updateHouseholdSchema = z.object({ name: householdNameSchema })
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>

export const updateMemberSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Informe como você quer ser chamado')
      .max(30, 'Use no máximo 30 caracteres'),
    color: paletteKeySchema,
  })
  .partial()
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

export const createInviteSchema = z.object({ email: emailSchema })
export type CreateInviteInput = z.infer<typeof createInviteSchema>
