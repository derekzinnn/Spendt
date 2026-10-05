import { describe, expect, it } from 'vitest'

import { nextOccurrence, occurrencesBetween } from './recurrence'

describe('occurrencesBetween', () => {
  it('monthly on the 31st clamps without drifting', () => {
    const rule = { startDate: '2026-01-31', frequency: 'MONTHLY' as const, interval: 1 }
    expect(occurrencesBetween(rule, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  it('respects start, end and the window', () => {
    const rule = {
      startDate: '2026-10-05',
      frequency: 'MONTHLY' as const,
      interval: 1,
      endDate: '2027-01-05',
    }
    expect(occurrencesBetween(rule, '2026-09-01', '2027-06-30')).toEqual([
      '2026-10-05',
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
    ])
    expect(occurrencesBetween(rule, '2026-11-06', '2026-12-31')).toEqual(['2026-12-05'])
  })

  it('every 2 months, weekly and yearly (Feb 29 → Feb 28)', () => {
    expect(
      occurrencesBetween(
        { startDate: '2026-01-10', frequency: 'MONTHLY', interval: 2 },
        '2026-01-01',
        '2026-07-31',
      ),
    ).toEqual(['2026-01-10', '2026-03-10', '2026-05-10', '2026-07-10'])
    expect(
      occurrencesBetween(
        { startDate: '2026-10-01', frequency: 'WEEKLY', interval: 1 },
        '2026-10-10',
        '2026-10-31',
      ),
    ).toEqual(['2026-10-15', '2026-10-22', '2026-10-29'])
    expect(
      occurrencesBetween(
        { startDate: '2028-02-29', frequency: 'YEARLY', interval: 1 },
        '2028-01-01',
        '2030-12-31',
      ),
    ).toEqual(['2028-02-29', '2029-02-28', '2030-02-28'])
  })

  it('finds the next occurrence, or null after the end', () => {
    const rule = { startDate: '2026-10-05', frequency: 'MONTHLY' as const, interval: 1 }
    expect(nextOccurrence(rule, '2026-10-06')).toBe('2026-11-05')
    expect(nextOccurrence({ ...rule, endDate: '2026-10-05' }, '2026-10-06')).toBeNull()
  })
})
