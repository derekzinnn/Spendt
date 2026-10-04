import { z } from 'zod'

import { idSchema } from './primitives'

/** Trimmed, lowercased e-mail. Lowercasing happens before validation. */
export const emailSchema = z
  .string({ error: 'Informe seu e-mail' })
  .trim()
  .toLowerCase()
  .max(254, 'E-mail longo demais')
  .pipe(z.email('E-mail inválido'))

/** New passwords: at least 8 characters; capped so hashing can't be abused. */
export const newPasswordSchema = z
  .string({ error: 'Informe uma senha' })
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(128, 'A senha pode ter no máximo 128 caracteres')

export const personNameSchema = z
  .string({ error: 'Informe seu nome' })
  .trim()
  .min(1, 'Informe seu nome')
  .max(60, 'Use no máximo 60 caracteres')

export const householdNameSchema = z
  .string()
  .trim()
  .min(1, 'Dê um nome para a casa')
  .max(60, 'Use no máximo 60 caracteres')

export const inviteTokenSchema = z.string().min(20).max(200)

export const registerSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  /** Name of the new household. Ignored when joining through an invite. */
  householdName: householdNameSchema.optional(),
  /** Register and join an existing household instead of creating one. */
  inviteToken: inviteTokenSchema.optional(),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Informe sua senha' }).min(1, 'Informe sua senha').max(128),
})
export type LoginInput = z.infer<typeof loginSchema>

export const switchHouseholdSchema = z.object({ householdId: idSchema })
export type SwitchHouseholdInput = z.infer<typeof switchHouseholdSchema>
