import { describe, expect, it } from 'vitest'

import { createAccountSchema } from './account'
import { emailSchema, registerSchema } from './auth'
import { createCategorySchema } from './category'

describe('emailSchema', () => {
  it('trims and lowercases before validating', () => {
    expect(emailSchema.parse('  Derek@Example.COM ')).toBe('derek@example.com')
  })

  it('rejects invalid addresses with a pt-BR message', () => {
    const result = emailSchema.safeParse('derek@')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('E-mail inválido')
  })
})

describe('registerSchema', () => {
  it('requires 8+ character passwords', () => {
    const result = registerSchema.safeParse({ name: 'Derek', email: 'a@b.co', password: 'curta' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['password'])
  })
})

describe('createCategorySchema', () => {
  it('only accepts known icons and palette keys', () => {
    const base = { name: 'Mercado', kind: 'EXPENSE', icon: 'shopping-cart', color: '700' }
    expect(createCategorySchema.safeParse(base).success).toBe(true)
    expect(createCategorySchema.safeParse({ ...base, color: '#ff0000' }).success).toBe(false)
    // Retired hue keys from the first palette are no longer valid tones.
    expect(createCategorySchema.safeParse({ ...base, color: 'clay' }).success).toBe(false)
    expect(createCategorySchema.safeParse({ ...base, icon: 'rocket' }).success).toBe(false)
  })
})

describe('createAccountSchema', () => {
  it('allows negative initial balances and needs a calendar date', () => {
    const input = {
      name: 'Nubank',
      type: 'CHECKING',
      color: '300',
      holderId: null,
      initialBalanceCents: -15000,
      initialBalanceDate: '2026-10-01',
    }
    expect(createAccountSchema.safeParse(input).success).toBe(true)
    expect(
      createAccountSchema.safeParse({ ...input, initialBalanceDate: '01/10/2026' }).success,
    ).toBe(false)
  })
})
