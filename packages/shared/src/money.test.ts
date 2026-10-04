import { describe, expect, it } from 'vitest'

import { allocateCents, formatBRL, formatCentsPlain, formatMoneyParts, parseBRL } from './money'

const NBSP = '\u00A0'

describe('formatBRL', () => {
  it('formats cents as Brazilian reais', () => {
    expect(formatBRL(123456)).toBe(`R$${NBSP}1.234,56`)
    expect(formatBRL(5)).toBe(`R$${NBSP}0,05`)
    expect(formatBRL(0)).toBe(`R$${NBSP}0,00`)
  })

  it('handles signs', () => {
    expect(formatBRL(-500)).toBe(`-R$${NBSP}5,00`)
    expect(formatBRL(500, { sign: 'always' })).toBe(`+R$${NBSP}5,00`)
    expect(formatBRL(-500, { sign: 'never' })).toBe(`R$${NBSP}5,00`)
    expect(formatBRL(0, { sign: 'always' })).toBe(`R$${NBSP}0,00`)
  })

  it('supports compact notation', () => {
    expect(formatBRL(123456, { compact: true })).toBe(`R$${NBSP}1,2${NBSP}mil`)
  })

  it('rejects non-integer cents', () => {
    expect(() => formatBRL(10.5)).toThrow(TypeError)
  })
})

describe('formatMoneyParts', () => {
  it('splits a value into styleable parts', () => {
    expect(formatMoneyParts(-123456)).toEqual({
      sign: '-',
      symbol: 'R$',
      integer: '1.234',
      decimal: ',',
      fraction: '56',
    })
  })

  it('formats plain amounts for inputs', () => {
    expect(formatCentsPlain(123456)).toBe('1.234,56')
  })
})

describe('parseBRL', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234,5', 123450],
    ['R$ 12', 1200],
    [`R$${NBSP}12,00`, 1200],
    ['12.50', 1250],
    ['12.5', 1250],
    ['1.234', 123400],
    ['1.234.567,89', 123456789],
    ['-3,00', -300],
    ['\u22123,00', -300],
    [',5', 50],
    ['0', 0],
  ])('parses %s', (input, expected) => {
    expect(parseBRL(input)).toBe(expected)
  })

  it.each(['', 'abc', '12,345', '1.23.4', '1,2,3', '12.345.6', '12a'])('rejects %s', (input) => {
    expect(parseBRL(input)).toBeNull()
  })

  it('rejects amounts larger than the database column', () => {
    expect(parseBRL('99.999.999,99')).toBeNull()
  })
})

describe('allocateCents', () => {
  it('never loses a cent', () => {
    expect(allocateCents(1000, [1, 1, 1])).toEqual([334, 333, 333])
    expect(allocateCents(101, [5000, 5000])).toEqual([51, 50])
    expect(allocateCents(120000, [1, 1, 1, 1, 1, 1])).toEqual(Array(6).fill(20000))
  })

  it('respects custom weights', () => {
    expect(allocateCents(10000, [7000, 3000])).toEqual([7000, 3000])
    expect(allocateCents(999, [6000, 4000])).toEqual([599, 400])
  })

  it('validates input', () => {
    expect(() => allocateCents(-1, [1])).toThrow(RangeError)
    expect(() => allocateCents(100, [])).toThrow(RangeError)
    expect(() => allocateCents(100, [0, 0])).toThrow(RangeError)
  })
})
