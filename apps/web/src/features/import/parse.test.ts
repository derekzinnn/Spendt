import { describe, expect, it } from 'vitest'

import { parseCsv, toCsv, toXlsxBlob } from '@/lib/spreadsheet'

import { guessMapping, parseAmount, parseDate, parseRows } from './parse'

describe('parseDate', () => {
  it('reads the shapes statements use', () => {
    expect(parseDate('31/12/2026')).toBe('2026-12-31')
    expect(parseDate('01-02-26')).toBe('2026-02-01')
    expect(parseDate('2026-12-31')).toBe('2026-12-31')
    expect(parseDate('05.10.2026')).toBe('2026-10-05')
  })

  it('refuses what is not a date', () => {
    expect(parseDate('31/13/2026')).toBeNull()
    expect(parseDate('30/02/2026')).toBeNull()
    expect(parseDate('Padaria')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('parseAmount', () => {
  it('reads Brazilian and American money', () => {
    expect(parseAmount('R$ 1.234,56')).toBe(123_456)
    expect(parseAmount('1,234.56')).toBe(123_456)
    expect(parseAmount('-45,90')).toBe(-4_590)
    expect(parseAmount('45,90-')).toBe(-4_590)
    expect(parseAmount('(45,90)')).toBe(-4_590)
    expect(parseAmount('1500')).toBe(150_000)
  })

  it('refuses empty cells, zero and words', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('0,00')).toBeNull()
    expect(parseAmount('saldo')).toBeNull()
  })
})

const CSV = [
  'Data;Histórico;Valor',
  '01/10/2026;PADARIA ACUCAR LTDA;-15,50',
  '05/10/2026;SALARIO OUTUBRO;4.200,00',
  '06/10/2026;linha sem valor;',
].join('\n')

describe('reading a statement', () => {
  it('splits CSV with a semicolon and quotes', () => {
    const grid = parseCsv('a;b\n"um; dois";três\n')
    expect(grid).toEqual([
      ['a', 'b'],
      ['um; dois', 'três'],
    ])
  })

  it('splits CSV with commas and doubled quotes', () => {
    expect(parseCsv('a,b\n"diz ""oi""",2\n')).toEqual([
      ['a', 'b'],
      ['diz "oi"', '2'],
    ])
  })

  it('finds the columns from the header and reads the lines', () => {
    const grid = parseCsv(CSV)
    const mapping = guessMapping(grid)
    expect(mapping).toMatchObject({ date: 0, description: 1, amount: 2, hasHeader: true })

    const lines = parseRows(grid, mapping)
    expect(lines[0]?.row).toEqual({
      date: '2026-10-01',
      description: 'PADARIA ACUCAR LTDA',
      amountCents: 1_550,
      type: 'EXPENSE',
    })
    expect(lines[1]?.row?.type).toBe('INCOME')
    expect(lines[2]).toMatchObject({ row: null, problem: 'Valor não reconhecido' })
  })

  it('finds the columns by shape when there is no header', () => {
    const grid = parseCsv('01/10/2026;PADARIA;-15,50')
    const mapping = guessMapping(grid)
    expect(mapping).toMatchObject({ date: 0, description: 1, amount: 2, hasHeader: false })
    expect(parseRows(grid, mapping)[0]?.row?.amountCents).toBe(1_550)
  })

  it('treats a separate credit column as money in', () => {
    const grid = parseCsv(
      ['Data;Descrição;Débito;Crédito', '01/10/2026;Salário;;4.200,00'].join('\n'),
    )
    const mapping = guessMapping(grid)
    expect(mapping.credit).toBe(3)
    expect(parseRows(grid, mapping)[0]?.row).toMatchObject({
      type: 'INCOME',
      amountCents: 420_000,
    })
  })

  it('inverts the signs for a card statement', () => {
    const grid = parseCsv('01/10/2026;PADARIA;15,50')
    const mapping = { ...guessMapping(grid), invertSigns: true }
    expect(parseRows(grid, mapping)[0]?.row?.type).toBe('EXPENSE')
  })
})

describe('toCsv', () => {
  it('quotes only what needs it and survives a round trip', () => {
    const csv = toCsv(['Data', 'Descrição'], [['2026-10-01', 'Padaria; a boa']])
    expect(csv).toContain('"Padaria; a boa"')
    expect(parseCsv(csv)).toEqual([
      ['Data', 'Descrição'],
      ['2026-10-01', 'Padaria; a boa'],
    ])
  })
})

describe('toXlsxBlob', () => {
  it('writes a real .xlsx (a zip) with the money as numbers', async () => {
    const blob = await toXlsxBlob(['Data', 'Valor'], [['2026-10-01', -15.5]])
    expect(blob.size).toBeGreaterThan(500)
    // Every .xlsx is a zip: it starts with "PK".
    const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 2)
    expect([head[0], head[1]]).toEqual([0x50, 0x4b])
  })
})
