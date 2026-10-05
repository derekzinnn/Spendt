import {
  firstDayOfMonth,
  formatBRL,
  lastDayOfMonth,
  parseIsoDate,
  todayIso,
  type BillDto,
  type MonthKey,
} from '@spendly/shared'

import { cn } from '@/lib/cn'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * The month as a grid: each day shows what is due on it. The day of the week comes from
 * plain UTC math on the calendar date, so no timezone can shift a square.
 */
export function BillsCalendar({
  month,
  bills,
  onSelect,
}: {
  month: MonthKey
  bills: BillDto[]
  onSelect: (bill: BillDto) => void
}) {
  const today = todayIso()
  const first = firstDayOfMonth(month)
  const last = lastDayOfMonth(month)
  const leading = new Date(`${first}T00:00:00Z`).getUTCDay()
  const days = parseIsoDate(last).day

  const byDay = new Map<number, BillDto[]>()
  for (const bill of bills) {
    if (bill.dueDate < first || bill.dueDate > last) continue
    const day = parseIsoDate(bill.dueDate).day
    byDay.set(day, [...(byDay.get(day) ?? []), bill])
  }

  return (
    <div className="blueprint border border-border">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((label, index) => (
          <div
            key={index}
            className="kicker border-b border-border px-2 py-1.5 text-center text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: leading }, (_, index) => (
          <div
            key={`pad-${index}`}
            className="min-h-20 border-r border-b border-border last:border-r-0"
          />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1
          const date = `${month}-${String(day).padStart(2, '0')}`
          const dayBills = byDay.get(day) ?? []
          const total = dayBills.reduce((sum, bill) => sum + bill.amountCents, 0)
          const isToday = date === today
          const late = dayBills.some((bill) => bill.bucket === 'overdue')
          return (
            <div
              key={day}
              className={cn(
                'flex min-h-20 flex-col gap-1 border-r border-b border-border p-1.5',
                isToday && 'bg-steel-100',
              )}
            >
              <span
                className={cn(
                  'font-display text-sm',
                  isToday ? 'text-steel-800' : 'text-muted-foreground',
                )}
              >
                {day}
              </span>
              {dayBills.slice(0, 2).map((bill) => (
                <button
                  key={bill.id}
                  type="button"
                  onClick={() => onSelect(bill)}
                  title={`${bill.description} · ${formatBRL(bill.amountCents)}`}
                  className={cn(
                    'cursor-pointer truncate border px-1 py-0.5 text-left text-[11px] transition-colors',
                    bill.bucket === 'overdue'
                      ? 'border-foreground hover:bg-foreground/7'
                      : 'border-steel bg-steel-100 text-steel-800 hover:bg-steel-200',
                  )}
                >
                  {bill.description}
                </button>
              ))}
              {dayBills.length > 2 ? (
                <span className="px-1 text-[11px] text-muted-foreground">
                  +{dayBills.length - 2} · {formatBRL(total)}
                </span>
              ) : null}
              {late ? <span className="sr-only">Contém conta atrasada</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
