/**
 * Calendar helpers.
 *
 * Business dates (purchase date, due date, closing date…) are *calendar dates*: no time,
 * no timezone, always "YYYY-MM-DD". They are produced in the household timezone
 * (America/Sao_Paulo) at the moment of entry and never shifted afterwards.
 *
 * All math here is plain integer calendar arithmetic, so it is immune to the
 * server's or browser's local timezone.
 */

export const APP_TIMEZONE = 'America/Sao_Paulo'
export const APP_LOCALE = 'pt-BR'

/** A calendar date, "YYYY-MM-DD". */
export type IsoDate = string
/** A calendar month, "YYYY-MM". */
export type MonthKey = string

export interface CalendarDate {
  year: number
  /** 1–12 */
  month: number
  day: number
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_KEY = /^(\d{4})-(\d{2})$/

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Day 31 in February becomes 28 (or 29). The heart of closing/due-day logic. */
export function clampDay(year: number, month: number, day: number): CalendarDate {
  return { year, month, day: Math.min(day, daysInMonth(year, month)) }
}

export function toIsoDate({ year, month, day }: CalendarDate): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

export function parseIsoDate(value: IsoDate): CalendarDate {
  if (!isIsoDate(value)) throw new RangeError(`Invalid calendar date: "${value}"`)
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  return { year, month, day }
}

/** Today's calendar date in the household timezone. */
export function todayIso(now: Date = new Date(), timeZone: string = APP_TIMEZONE): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** "2026-10-03" → "03/10/2026" */
export function formatDateBR(value: IsoDate): string {
  const { year, month, day } = parseIsoDate(value)
  return `${pad(day)}/${pad(month)}/${pad(year, 4)}`
}

/** "03/10/2026" → "2026-10-03" (null when invalid). */
export function parseDateBR(value: string): IsoDate | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const iso = `${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`
  return isIsoDate(iso) ? iso : null
}

// ───────────── Months ─────────────

export function isMonthKey(value: string): boolean {
  const match = MONTH_KEY.exec(value)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

export function toMonthKey(year: number, month: number): MonthKey {
  return `${pad(year, 4)}-${pad(month)}`
}

export function parseMonthKey(value: MonthKey): { year: number; month: number } {
  if (!isMonthKey(value)) throw new RangeError(`Invalid month key: "${value}"`)
  const [year, month] = value.split('-').map(Number) as [number, number]
  return { year, month }
}

export function monthKeyOf(date: IsoDate): MonthKey {
  return date.slice(0, 7)
}

export function currentMonthKey(now: Date = new Date(), timeZone: string = APP_TIMEZONE): MonthKey {
  return monthKeyOf(todayIso(now, timeZone))
}

export function addMonths(value: MonthKey, amount: number): MonthKey {
  const { year, month } = parseMonthKey(value)
  const index = year * 12 + (month - 1) + amount
  return toMonthKey(Math.floor(index / 12), (index % 12) + 1)
}

/** Whole months from `from` to `to` (positive when `to` is later). */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const a = parseMonthKey(from)
  const b = parseMonthKey(to)
  return (b.year - a.year) * 12 + (b.month - a.month)
}

export function firstDayOfMonth(value: MonthKey): IsoDate {
  return `${value}-01`
}

export function lastDayOfMonth(value: MonthKey): IsoDate {
  const { year, month } = parseMonthKey(value)
  return toIsoDate({ year, month, day: daysInMonth(year, month) })
}

const monthFormatters = {
  long: new Intl.DateTimeFormat(APP_LOCALE, { month: 'long', timeZone: 'UTC' }),
  short: new Intl.DateTimeFormat(APP_LOCALE, { month: 'short', timeZone: 'UTC' }),
}

/** 1 → "janeiro" / "jan" */
export function monthName(month: number, style: 'long' | 'short' = 'long'): string {
  return monthFormatters[style].format(new Date(Date.UTC(2000, month - 1, 1))).replace('.', '')
}

/** "2026-10" → "outubro de 2026" (long) · "out/2026" (short) · "outubro" (month) */
export function formatMonthLabel(
  value: MonthKey,
  style: 'long' | 'short' | 'month' = 'long',
): string {
  const { year, month } = parseMonthKey(value)
  if (style === 'short') return `${monthName(month, 'short')}/${year}`
  if (style === 'month') return monthName(month)
  return `${monthName(month)} de ${year}`
}

export function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase(APP_LOCALE) + value.slice(1)
}
