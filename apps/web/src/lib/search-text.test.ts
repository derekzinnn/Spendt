import { describe, expect, it } from 'vitest'

import { normalizeSearch } from './search-text'

describe('normalizeSearch', () => {
  it('drops the accents, so typing without them still finds the category', () => {
    expect(normalizeSearch('Saúde')).toBe('saude')
    expect(normalizeSearch('Alimentação')).toBe('alimentacao')
    expect(normalizeSearch('Itaú')).toBe('itau')
    expect(normalizeSearch('Férias & Lazer')).toBe('ferias & lazer')
  })

  it('lowercases and trims', () => {
    expect(normalizeSearch('  MERCADO  ')).toBe('mercado')
  })

  it('makes "saude" match "Saúde" — the bug this exists to prevent', () => {
    expect(normalizeSearch('Saúde').includes(normalizeSearch('saude'))).toBe(true)
  })
})
