import {
  capitalize,
  formatDateBR,
  formatMonthLabel,
  type IsoDate,
  type MonthKey,
} from '@spendly/shared'
/** "fatura de novembro" / "Fatura de nov/2026". */
export function invoiceName(referenceMonth: MonthKey, style: 'long' | 'short' = 'long') {
  return style === 'short'
    ? `Fatura de ${formatMonthLabel(referenceMonth, 'short')}`
    : `Fatura de ${formatMonthLabel(referenceMonth, 'month')}`
}

/** "dd/mm" for compact dates inside a known year. */
export const dayMonth = (date: IsoDate) => formatDateBR(date).slice(0, 5)

/** Closing date is exclusive: the last day of purchases is the day before. */
export function invoiceDates(invoice: { closingDate: IsoDate; dueDate: IsoDate }) {
  return `fecha ${dayMonth(invoice.closingDate)} · vence ${dayMonth(invoice.dueDate)}`
}

export const monthTitle = (month: MonthKey) => capitalize(formatMonthLabel(month, 'month'))
