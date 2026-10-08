import { formatDateBR, todayIso, type IsoDate } from '@spendly/shared'

/**
 * "12/10" for this year, "20/12/2025" for any other.
 *
 * A grid scoped to one month never needs the year; a search that spans the whole ledger
 * does, and so does an old pending bill sitting in a current-month list.
 */
export function shortDate(date: IsoDate): string {
  const full = formatDateBR(date)
  return date.slice(0, 4) === todayIso().slice(0, 4) ? full.slice(0, 5) : full
}
