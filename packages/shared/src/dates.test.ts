import { describe, expect, it } from 'vitest'

import {
  addMonths,
  clampDay,
  formatDateBR,
  formatMonthLabel,
  isIsoDate,
  lastDayOfMonth,
  monthsBetween,
  parseDateBR,
  todayIso,
} from './dates'

describe('calendar math', () => {
  it('clamps day 31 to the end of short months', () => {
    expect(clampDay(2027, 2, 31)).toEqual({ year: 2027, month: 2, day: 28 })
    expect(clampDay(2028, 2, 31)).toEqual({ year: 2028, month: 2, day: 29 })
    expect(clampDay(2026, 4, 31)).toEqual({ year: 2026, month: 4, day: 30 })
    expect(clampDay(2026, 10, 15)).toEqual({ year: 2026, month: 10, day: 15 })
  })

  it('validates calendar dates', () => {
    expect(isIsoDate('2026-10-03')).toBe(true)
    expect(isIsoDate('2027-02-29')).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-13-01')).toBe(false)
  })

  it('adds months across year boundaries', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-10', 14)).toBe('2027-12')
    expect(monthsBetween('2026-10', '2027-03')).toBe(5)
    expect(lastDayOfMonth('2027-02')).toBe('2027-02-28')
  })
})

describe('timezone', () => {
  it('uses the São Paulo calendar date, not UTC', () => {
    // 02:30 UTC on the 25th is still 23:30 on the 24th in São Paulo (UTC-3).
    expect(todayIso(new Date('2026-10-25T02:30:00Z'))).toBe('2026-10-24')
    expect(todayIso(new Date('2026-10-25T03:30:00Z'))).toBe('2026-10-25')
  })
})

describe('pt-BR formatting', () => {
  it('formats and parses dd/mm/yyyy', () => {
    expect(formatDateBR('2026-10-03')).toBe('03/10/2026')
    expect(parseDateBR('3/10/2026')).toBe('2026-10-03')
    expect(parseDateBR('31/02/2026')).toBeNull()
  })

  it('labels months in Portuguese', () => {
    expect(formatMonthLabel('2026-10')).toBe('outubro de 2026')
    expect(formatMonthLabel('2026-10', 'short')).toBe('out/2026')
    expect(formatMonthLabel('2026-03', 'month')).toBe('março')
  })
})
