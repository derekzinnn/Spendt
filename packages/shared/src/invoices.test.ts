import { describe, expect, it } from 'vitest'

import { addDays, addMonthsToDate } from './dates'
import {
  installmentDate,
  invoiceStatus,
  resolveInstallmentCycle,
  resolveInvoiceCycle,
  type InvoicePeriod,
} from './invoices'

const card = (closingDay: number, dueDay: number) => ({ closingDay, dueDay })

describe('date arithmetic', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('adds months clamping the day', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDate('2027-12-15', 2)).toBe('2028-02-15')
    expect(addMonthsToDate('2026-03-31', -1)).toBe('2026-02-28')
  })
})

describe('resolveInvoiceCycle — the edge-case table', () => {
  it('closes 31, due 10 · purchase 27/02/2027 → closes 28/02 (clamped), due 10/03', () => {
    expect(resolveInvoiceCycle(card(31, 10), '2027-02-27')).toMatchObject({
      closingDate: '2027-02-28',
      dueDate: '2027-03-10',
      referenceMonth: '2027-03-01',
      periodStart: '2027-01-31',
      existing: false,
    })
  })

  it('closes 31, due 10 · purchase 28/02/2027 (= clamped closing) → next cycle', () => {
    expect(resolveInvoiceCycle(card(31, 10), '2027-02-28')).toMatchObject({
      periodStart: '2027-02-28',
      closingDate: '2027-03-31',
      dueDate: '2027-04-10',
      referenceMonth: '2027-04-01',
    })
  })

  it('closes 31, due 10 · purchase 28/02/2028 (leap) → closes 29/02, due 10/03', () => {
    expect(resolveInvoiceCycle(card(31, 10), '2028-02-28')).toMatchObject({
      closingDate: '2028-02-29',
      dueDate: '2028-03-10',
    })
  })

  it('closes 25, due 5 · purchase 24/10 → closes 25/10, due 05/11 ("fatura de novembro")', () => {
    expect(resolveInvoiceCycle(card(25, 5), '2026-10-24')).toMatchObject({
      periodStart: '2026-09-25',
      closingDate: '2026-10-25',
      dueDate: '2026-11-05',
      referenceMonth: '2026-11-01',
    })
  })

  it('closes 25, due 5 · purchase exactly on 25/10 → closes 25/11, due 05/12', () => {
    expect(resolveInvoiceCycle(card(25, 5), '2026-10-25')).toMatchObject({
      periodStart: '2026-10-25',
      closingDate: '2026-11-25',
      dueDate: '2026-12-05',
    })
  })

  it('closes 5, due 15 · purchase 03/10 → closes 05/10, due 15/10 (same month)', () => {
    expect(resolveInvoiceCycle(card(5, 15), '2026-10-03')).toMatchObject({
      closingDate: '2026-10-05',
      dueDate: '2026-10-15',
      referenceMonth: '2026-10-01',
    })
  })

  it('due day equal to the closing day rolls to the next month', () => {
    expect(resolveInvoiceCycle(card(10, 10), '2026-10-03')).toMatchObject({
      closingDate: '2026-10-10',
      dueDate: '2026-11-10',
    })
  })

  it('crosses the year', () => {
    expect(resolveInvoiceCycle(card(28, 8), '2026-12-29')).toMatchObject({
      closingDate: '2027-01-28',
      dueDate: '2027-02-08',
      referenceMonth: '2027-02-01',
    })
  })

  it('rejects an invalid calendar date', () => {
    expect(() => resolveInvoiceCycle(card(25, 5), '2026-02-30')).toThrow(RangeError)
  })
})

describe('resolveInvoiceCycle — snapshots', () => {
  const october: InvoicePeriod = {
    referenceMonth: '2026-11-01',
    periodStart: '2026-09-25',
    closingDate: '2026-10-25',
    dueDate: '2026-11-05',
  }

  it('an existing invoice containing the date wins, even after the closing day changed', () => {
    // The card now closes on the 5th, but the snapshot still covers 25/09 → 25/10.
    expect(resolveInvoiceCycle(card(5, 15), '2026-10-20', [october])).toEqual({
      ...october,
      existing: true,
    })
  })

  it('new periods start where the previous snapshot closed (no gap)', () => {
    // Closing day moved from 25 to 5: the next invoice starts on 25/10, not 05/10.
    // Its own cycle would also be due in November, which is taken → the next one.
    expect(resolveInvoiceCycle(card(5, 15), '2026-10-30', [october])).toMatchObject({
      periodStart: '2026-10-25',
      closingDate: '2026-12-05',
      dueDate: '2026-12-15',
      referenceMonth: '2026-12-01',
      existing: false,
    })
    // Before the switch is complete, a purchase right after 05/11 is also December.
    expect(resolveInvoiceCycle(card(5, 15), '2026-11-04', [october]).referenceMonth).toBe(
      '2026-12-01',
    )
  })

  it('a computed period never overlaps a later snapshot', () => {
    const later: InvoicePeriod = {
      referenceMonth: '2026-12-01',
      periodStart: '2026-10-25',
      closingDate: '2026-11-25',
      dueDate: '2026-12-05',
    }
    // Closing day 28 would close on 28/10, but 25/10 already belongs to the later invoice.
    const cycle = resolveInvoiceCycle(card(28, 8), '2026-10-20', [later])
    expect(cycle.closingDate).toBe('2026-10-25')
    expect(cycle.closingDate <= later.periodStart).toBe(true)
  })

  it('one invoice per due month: a purchase after that invoice closed rolls forward', () => {
    const november: InvoicePeriod = {
      referenceMonth: '2026-11-01',
      periodStart: '2026-10-01',
      closingDate: '2026-10-20',
      dueDate: '2026-11-05',
    }
    // 22/10 is after November's (early) closing → December, starting where November closed.
    expect(resolveInvoiceCycle(card(25, 5), '2026-10-22', [november])).toMatchObject({
      periodStart: '2026-10-20',
      closingDate: '2026-11-25',
      referenceMonth: '2026-12-01',
      existing: false,
    })
  })

  it('one invoice per due month: a purchase before a later invoice joins it', () => {
    const december: InvoicePeriod = {
      referenceMonth: '2026-12-01',
      periodStart: '2026-11-10',
      closingDate: '2026-11-25',
      dueDate: '2026-12-05',
    }
    // 05/11 is due in December too, whose invoice already exists (starting 10/11).
    expect(resolveInvoiceCycle(card(25, 5), '2026-11-05', [december])).toEqual({
      ...december,
      existing: true,
    })
  })
})

describe('installments', () => {
  it('shifts the cycle, not the date: 6x from 24/10 on a card closing 25 / due 5', () => {
    const existing: InvoicePeriod[] = []
    const dues = Array.from({ length: 6 }, (_, k) => {
      const cycle = resolveInstallmentCycle(card(25, 5), '2026-10-24', k, existing)
      if (!cycle.existing) existing.push(cycle)
      return cycle.dueDate
    })
    expect(dues).toEqual([
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
      '2027-02-05',
      '2027-03-05',
      '2027-04-05',
    ])
  })

  it('keeps month-end cards on their clamped closing days', () => {
    const existing: InvoicePeriod[] = []
    const closings = Array.from({ length: 3 }, (_, k) => {
      const cycle = resolveInstallmentCycle(card(31, 10), '2027-01-15', k, existing)
      if (!cycle.existing) existing.push(cycle)
      return cycle.closingDate
    })
    expect(closings).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
  })

  it('periods of consecutive installments are contiguous', () => {
    const existing: InvoicePeriod[] = []
    for (let k = 0; k < 4; k++) {
      const cycle = resolveInstallmentCycle(card(31, 10), '2027-01-31', k, existing)
      if (!cycle.existing) existing.push(cycle)
    }
    for (let i = 1; i < existing.length; i++) {
      expect(existing[i]!.periodStart).toBe(existing[i - 1]!.closingDate)
    }
  })

  it('competence date moves month by month, clamped', () => {
    expect([0, 1, 2].map((k) => installmentDate('2027-01-31', k))).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ])
  })
})

describe('invoiceStatus', () => {
  const base = { closingDate: '2026-10-25', dueDate: '2026-11-05' }

  it('open before closing, closed after', () => {
    expect(invoiceStatus({ ...base, totalCents: 1000, paidCents: 0 }, '2026-10-24')).toBe('open')
    expect(invoiceStatus({ ...base, totalCents: 1000, paidCents: 0 }, '2026-10-25')).toBe('closed')
  })

  it('paid, partially paid and overdue', () => {
    expect(invoiceStatus({ ...base, totalCents: 1000, paidCents: 1000 }, '2026-11-01')).toBe('paid')
    expect(invoiceStatus({ ...base, totalCents: 1000, paidCents: 400 }, '2026-11-05')).toBe(
      'partially_paid',
    )
    expect(invoiceStatus({ ...base, totalCents: 1000, paidCents: 400 }, '2026-11-06')).toBe(
      'overdue',
    )
    expect(invoiceStatus({ ...base, totalCents: 1000, paidCents: 0 }, '2026-11-06')).toBe('overdue')
  })

  it('a late purchase on a paid invoice makes it partially paid', () => {
    expect(invoiceStatus({ ...base, totalCents: 1500, paidCents: 1000 }, '2026-11-01')).toBe(
      'partially_paid',
    )
  })

  it('an empty invoice is never overdue', () => {
    expect(invoiceStatus({ ...base, totalCents: 0, paidCents: 0 }, '2026-12-01')).toBe('closed')
  })
})
