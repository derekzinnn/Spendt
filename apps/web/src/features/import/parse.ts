import { MAX_CENTS, type ImportRow, type IsoDate } from '@spendly/shared'

import type { Grid } from '@/lib/spreadsheet'

/**
 * Turning a bank's spreadsheet into our rows.
 *
 * Every bank exports something different, so the screen lets the person say which column is
 * which. These helpers only guess a starting point and parse the values — all pure, so the
 * odd formats (31/12/2026, "R$ 1.234,56", "-45,90", a separate credit column) are testable.
 */

export type ColumnRole = 'date' | 'description' | 'amount' | 'credit' | 'ignore'

export interface Mapping {
  /** Index in the sheet's row for each role; -1 when the file has no such column. */
  date: number
  description: number
  amount: number
  /** Optional second column: banks that split "saída" and "entrada". */
  credit: number
  /** Skip the header line. */
  hasHeader: boolean
  /** Card statements: a purchase is written positive, so the signs mean the opposite. */
  invertSigns: boolean
}

const HEADER_HINTS: Record<Exclude<ColumnRole, 'ignore'>, string[]> = {
  date: ['data', 'date', 'dia', 'lancamento', 'competencia', 'vencimento'],
  description: ['descri', 'historico', 'histórico', 'lancamento', 'estabelecimento', 'detalhe'],
  amount: ['valor', 'amount', 'debito', 'débito', 'saida', 'saída', 'quantia'],
  credit: ['credito', 'crédito', 'entrada', 'receita'],
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Looks at the first line and, failing that, at what the cells look like. */
export function guessMapping(grid: Grid): Mapping {
  const header = grid[0] ?? []
  const hasHeader = header.some((cell) => HEADER_HINTS.date.some((hint) => hintMatch(cell, hint)))
  const find = (role: Exclude<ColumnRole, 'ignore'>) =>
    hasHeader
      ? header.findIndex((cell) => HEADER_HINTS[role].some((hint) => hintMatch(cell, hint)))
      : -1

  const sample = grid[hasHeader ? 1 : 0] ?? []
  // A date reads as a number too ("01/10/2026"), so a date column is never the amount.
  const byShape = {
    date: sample.findIndex((cell) => parseDate(cell) !== null),
    amount: sample.findIndex((cell) => parseDate(cell) === null && parseAmount(cell) !== null),
    description: sample.findIndex(
      (cell) => parseDate(cell) === null && parseAmount(cell) === null && cell.trim().length > 2,
    ),
  }

  const date = pick(find('date'), byShape.date)
  const amount = pick(find('amount'), byShape.amount)
  const description = pick(find('description'), byShape.description)
  const credit = find('credit')
  return {
    date,
    description: description === amount || description === date ? -1 : description,
    amount,
    credit: credit === amount ? -1 : credit,
    hasHeader,
    invertSigns: false,
  }
}

const pick = (preferred: number, fallback: number) => (preferred >= 0 ? preferred : fallback)

/** A header cell matches a hint when it contains it — "Valor (R$)" still means valor. */
const hintMatch = (cell: string, hint: string) => normalize(cell).includes(normalize(hint))

/**
 * Calendar dates from the shapes statements use: 31/12/2026, 31-12-26, 2026-12-31. Two-digit
 * years are 20xx — no bank exports the nineties.
 */
export function parseDate(value: string): IsoDate | null {
  const text = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return valid(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const br = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(text)
  if (!br) return null
  const year = Number(br[3])
  return valid(year < 100 ? 2000 + year : year, Number(br[2]), Number(br[1]))
}

function valid(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

/**
 * Money in cents, signed. Handles "R$ 1.234,56", "1,234.56", "-45,90", "45,90-" (some banks
 * put the sign last) and "(45,90)". Returns null when the cell isn't a number at all.
 */
export function parseAmount(value: string): number | null {
  let text = value.trim()
  if (text === '') return null
  const parenthesized = /^\((.*)\)$/.exec(text)
  if (parenthesized) text = `-${parenthesized[1] ?? ''}`
  if (/-\s*$/.test(text)) text = `-${text.replace(/-\s*$/, '')}`

  const negative = text.trimStart().startsWith('-')
  const digits = text.replace(/[^\d.,]/g, '')
  if (!/\d/.test(digits)) return null

  // Whichever separator comes last is the decimal one; the other only groups thousands.
  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')
  const normalized =
    lastComma > lastDot
      ? digits.replace(/\./g, '').replace(',', '.')
      : lastDot > lastComma
        ? digits.replace(/,/g, '')
        : digits.replace(/[.,]/g, '')

  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  const cents = Math.round(Math.abs(amount) * 100)
  if (cents === 0 || cents > MAX_CENTS) return null
  return negative ? -cents : cents
}

export interface ParsedLine {
  /** Line number in the file, for the error message. */
  line: number
  row: ImportRow | null
  problem: string | null
}

/**
 * Applies the mapping to every line. A line we can't read keeps its place with a reason, so
 * the person sees exactly which ones will be skipped instead of a silent shorter list.
 *
 * Direction: with a separate credit column, anything there is money in. Otherwise the sign
 * decides — and `invertSigns` covers card statements, where a purchase comes out positive.
 */
export function parseRows(grid: Grid, mapping: Mapping): ParsedLine[] {
  const body = mapping.hasHeader ? grid.slice(1) : grid
  const offset = mapping.hasHeader ? 2 : 1
  return body.map((cells, index) => {
    const line = index + offset
    const date = parseDate(cells[mapping.date] ?? '')
    if (!date) return { line, row: null, problem: 'Data não reconhecida' }

    const description = (cells[mapping.description] ?? '').trim().slice(0, 120)
    if (!description) return { line, row: null, problem: 'Sem descrição' }

    const debit = parseAmount(cells[mapping.amount] ?? '')
    const credit = mapping.credit >= 0 ? parseAmount(cells[mapping.credit] ?? '') : null
    const value = credit ?? debit
    if (value === null) return { line, row: null, problem: 'Valor não reconhecido' }

    const incoming = credit !== null ? true : mapping.invertSigns ? value < 0 : value > 0
    return {
      line,
      row: {
        date,
        description,
        amountCents: Math.abs(value),
        type: incoming ? 'INCOME' : 'EXPENSE',
      },
      problem: null,
    }
  })
}
