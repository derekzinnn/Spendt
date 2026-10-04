/**
 * Money helpers.
 *
 * Every amount in Spendly is an integer number of cents (centavos): R$ 1.234,56 → 123456.
 * Floats only exist at the very edge, to hand a number to Intl for display.
 */

/** An integer amount of cents. */
export type Cents = number

/** Largest amount a Postgres `integer` column can hold: R$ 21.474.836,47. */
export const MAX_CENTS = 2_147_483_647

export type SignDisplay = 'auto' | 'always' | 'never'

export interface FormatMoneyOptions {
  /** `auto`: "-R$ 5,00" · `always`: "+R$ 5,00" · `never`: absolute value. */
  sign?: SignDisplay
  /** "R$ 1,2 mil" instead of "R$ 1.234,56". */
  compact?: boolean
}

export interface MoneyParts {
  sign: '' | '+' | '-'
  symbol: string
  integer: string
  decimal: string
  fraction: string
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(compact: boolean): Intl.NumberFormat {
  const key = compact ? 'compact' : 'standard'
  let cached = formatters.get(key)
  if (!cached) {
    cached = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    })
    formatters.set(key, cached)
  }
  return cached
}

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`Expected an integer amount of cents, received ${cents}`)
  }
}

function signFor(cents: Cents, sign: SignDisplay): MoneyParts['sign'] {
  if (sign === 'never' || cents === 0) return ''
  if (cents < 0) return '-'
  return sign === 'always' ? '+' : ''
}

/** Formats cents as BRL: `formatBRL(123456)` → "R$ 1.234,56". */
export function formatBRL(
  cents: Cents,
  { sign = 'auto', compact = false }: FormatMoneyOptions = {},
): string {
  assertCents(cents)
  const body = formatter(compact).format(Math.abs(cents) / 100)
  return `${signFor(cents, sign)}${body}`
}

/**
 * Splits a formatted amount into styleable pieces, so the UI can render the currency
 * symbol and the cents with less visual weight than the integer part.
 */
export function formatMoneyParts(
  cents: Cents,
  { sign = 'auto' }: Pick<FormatMoneyOptions, 'sign'> = {},
): MoneyParts {
  assertCents(cents)
  const parts: MoneyParts = {
    sign: signFor(cents, sign),
    symbol: 'R$',
    integer: '',
    decimal: ',',
    fraction: '',
  }
  for (const part of formatter(false).formatToParts(Math.abs(cents) / 100)) {
    switch (part.type) {
      case 'currency':
        parts.symbol = part.value
        break
      case 'integer':
      case 'group':
        parts.integer += part.value
        break
      case 'decimal':
        parts.decimal = part.value
        break
      case 'fraction':
        parts.fraction = part.value
        break
      default:
        break
    }
  }
  return parts
}

/** "1234,5" style without the currency symbol, used by inputs. */
export function formatCentsPlain(cents: Cents): string {
  const { sign, integer, decimal, fraction } = formatMoneyParts(cents)
  return `${sign}${integer}${decimal}${fraction}`
}

const THOUSANDS_GROUPED = /^\d{1,3}(\.\d{3})+$/
const PLAIN_DIGITS = /^\d*$/

/**
 * Parses what a person types or pastes into cents.
 * Accepts "1.234,56", "1234,5", "R$ 12", "12.50", "-3,00".
 * Returns `null` when the text is not an unambiguous amount.
 */
export function parseBRL(input: string): Cents | null {
  let text = input.replace(/[\s\u00A0]/g, '').replace(/R\$/gi, '')
  let negative = false
  if (/^[-\u2212]/.test(text)) {
    negative = true
    text = text.slice(1)
  }
  if (text === '' || !/^[\d.,]+$/.test(text)) return null

  let integerPart: string
  let fractionPart = ''

  const lastComma = text.lastIndexOf(',')
  if (lastComma !== -1) {
    // Brazilian format: comma is the decimal separator, dots group thousands.
    integerPart = text.slice(0, lastComma)
    fractionPart = text.slice(lastComma + 1)
    if (!(PLAIN_DIGITS.test(integerPart) || THOUSANDS_GROUPED.test(integerPart))) return null
  } else if (text.includes('.')) {
    // "12.5" / "12.50" is a decimal dot; "1.234" / "1.234.567" groups thousands.
    const decimalDot = /^(\d+)\.(\d{1,2})$/.exec(text)
    if (decimalDot) {
      integerPart = decimalDot[1] ?? ''
      fractionPart = decimalDot[2] ?? ''
    } else if (THOUSANDS_GROUPED.test(text)) {
      integerPart = text
    } else {
      return null
    }
  } else {
    integerPart = text
  }

  if (!/^\d{0,2}$/.test(fractionPart)) return null
  const integerDigits = integerPart.replace(/\./g, '') || '0'
  if (integerDigits.length > 13) return null

  const cents = Number(integerDigits) * 100 + Number(fractionPart.padEnd(2, '0'))
  if (cents > MAX_CENTS) return null
  return negative ? -cents : cents
}

/**
 * Splits `totalCents` proportionally to `weights` without losing a single cent
 * (largest-remainder method). Ties go to the earliest weight, so callers control
 * who absorbs leftover cents by ordering the weights.
 *
 * allocateCents(1000, [1, 1, 1]) → [334, 333, 333]
 */
export function allocateCents(totalCents: Cents, weights: readonly number[]): Cents[] {
  assertCents(totalCents)
  if (totalCents < 0) throw new RangeError('allocateCents expects a non-negative total')
  if (weights.length === 0) throw new RangeError('allocateCents needs at least one weight')
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new RangeError('Weights must be finite and non-negative')
  }
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  if (weightSum === 0) throw new RangeError('At least one weight must be positive')

  const exact = weights.map((w) => (totalCents * w) / weightSum)
  const result = exact.map(Math.floor)
  let leftover = totalCents - result.reduce((sum, c) => sum + c, 0)

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (const { index } of byRemainder) {
    if (leftover === 0) break
    result[index] = (result[index] ?? 0) + 1
    leftover -= 1
  }
  return result
}
