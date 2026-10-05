import { parseIsoDate, type RecurringRuleDto } from '@spendly/shared'

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "Todo mês, dia 5" · "A cada 2 meses, dia 10" · "Toda segunda" · "Todo ano, 15/03". */
export function describeFrequency(rule: RecurringRuleDto) {
  const { day, month } = parseIsoDate(rule.startDate)
  const every = rule.interval > 1
  switch (rule.frequency) {
    case 'MONTHLY':
      return every ? `A cada ${rule.interval} meses, dia ${day}` : `Todo mês, dia ${day}`
    case 'WEEKLY': {
      const weekday = WEEKDAYS[new Date(`${rule.startDate}T00:00:00Z`).getUTCDay()]
      return every ? `A cada ${rule.interval} semanas, ${weekday}` : `Toda ${weekday}`
    }
    case 'YEARLY':
      return `Todo ano, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
  }
}
