/**
 * Recurring rules (rent, subscriptions, salary): which calendar dates a rule falls on.
 *
 * Pure calendar math. The anchor is the rule's `startDate`: monthly rules repeat its day of
 * the month (31 → clamped to short months, without drifting: Jan 31 → Feb 28 → Mar 31),
 * yearly rules its day and month (Feb 29 → Feb 28 in common years), weekly rules its weekday.
 */
import { addDays, addMonthsToDate, parseIsoDate, type IsoDate } from './dates'
import type { RecurrenceFrequency } from './enums'

export interface RecurrenceConfig {
  startDate: IsoDate
  frequency: RecurrenceFrequency
  /** Every N periods (1 = every month/week/year). */
  interval: number
  endDate?: IsoDate | null
}

/** The n-th occurrence (0-based) — always computed from the anchor, so clamping never drifts. */
export function nthOccurrence(rule: RecurrenceConfig, n: number): IsoDate {
  const step = rule.interval * n
  switch (rule.frequency) {
    case 'WEEKLY':
      return addDays(rule.startDate, 7 * step)
    case 'YEARLY':
      return addMonthsToDate(rule.startDate, 12 * step)
    case 'MONTHLY':
      return addMonthsToDate(rule.startDate, step)
  }
}

/** Every occurrence date in [from, to] (inclusive), respecting start and end dates. */
export function occurrencesBetween(rule: RecurrenceConfig, from: IsoDate, to: IsoDate): IsoDate[] {
  parseIsoDate(from)
  parseIsoDate(to)
  const result: IsoDate[] = []
  const last = rule.endDate && rule.endDate < to ? rule.endDate : to
  // Skip quickly to near `from` (weekly rules can be far behind), then walk.
  let n = 0
  if (from > rule.startDate) {
    const { year: fy, month: fm } = parseIsoDate(from)
    const { year: sy, month: sm } = parseIsoDate(rule.startDate)
    const months = (fy - sy) * 12 + (fm - sm)
    const perStep =
      rule.frequency === 'MONTHLY' ? rule.interval : rule.frequency === 'YEARLY' ? 12 * rule.interval : 0
    if (perStep > 0) n = Math.max(0, Math.floor(months / perStep) - 1)
    else {
      const days = Math.round(
        (Date.parse(`${from}T00:00:00Z`) - Date.parse(`${rule.startDate}T00:00:00Z`)) / 86_400_000,
      )
      n = Math.max(0, Math.floor(days / (7 * rule.interval)) - 1)
    }
  }
  for (let guard = 0; guard < 10_000; guard++, n++) {
    const date = nthOccurrence(rule, n)
    if (date > last) break
    if (date >= from) result.push(date)
  }
  return result
}

/** The first occurrence on or after `from`, or null when the rule has ended. */
export function nextOccurrence(rule: RecurrenceConfig, from: IsoDate): IsoDate | null {
  const horizon = addMonthsToDate(from, 12 * Math.max(1, rule.interval) + 1)
  return occurrencesBetween(rule, from, horizon)[0] ?? null
}
