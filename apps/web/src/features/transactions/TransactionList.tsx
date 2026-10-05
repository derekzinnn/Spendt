import {
  capitalize,
  parseIsoDate,
  type TransactionDto,
  type TransactionTotalsDto,
} from '@spendly/shared'
import { ArrowLeftRight, Repeat } from 'lucide-react'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'

import type { Lookups } from './lookups'

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })

function dayTitle(date: string) {
  const { day, month } = parseIsoDate(date)
  const name = weekday.format(new Date(`${date}T00:00:00Z`))
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')} · ${capitalize(name)}`
}

/** Phones: rows grouped by day, tap to edit; the month's total on top. */
export function TransactionList({
  items,
  totals,
  lookups,
  onEdit,
}: {
  items: TransactionDto[]
  totals: TransactionTotalsDto
  lookups: Lookups
  onEdit: (row: TransactionDto) => void
}) {
  const days = new Map<string, TransactionDto[]>()
  for (const item of items) days.set(item.date, [...(days.get(item.date) ?? []), item])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-y border-foreground py-2 text-sm font-medium">
        <span>
          {totals.count} {totals.count === 1 ? 'lançamento' : 'lançamentos'}
        </span>
        <Money cents={totals.netCents} signed />
      </div>
      {[...days.entries()].map(([date, rows]) => (
        <section key={date} aria-label={dayTitle(date)}>
          <h3 className="kicker mb-1 text-muted-foreground">{dayTitle(date)}</h3>
          <ul className="flex flex-col">
            {rows.map((row) => {
              const category = lookups.category(row.categoryId)
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-b border-border py-2 text-left"
                  >
                    {row.type === 'TRANSFER' ? (
                      <span className="grid size-5.5 shrink-0 place-items-center text-muted-foreground">
                        <ArrowLeftRight className="size-4" />
                      </span>
                    ) : category ? (
                      <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                    ) : (
                      <span className="size-5.5 shrink-0 border border-dashed border-border-strong" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-[15px]">
                        <span className="truncate">{row.description}</span>
                        {row.recurringRuleId ? (
                          <Repeat
                            aria-label="Recorrente"
                            className="size-3.5 shrink-0 text-muted-foreground"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {lookups.sourceLabel(row)}
                        {row.installmentNumber
                          ? ` · ${row.installmentNumber}/${row.installmentCount}`
                          : ''}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Money
                        cents={row.amountCents}
                        {...(row.type === 'TRANSFER'
                          ? {}
                          : { flow: row.type === 'INCOME' ? ('in' as const) : ('out' as const) })}
                        signed={row.type !== 'TRANSFER'}
                      />
                      {row.status === 'PENDING' ? <Badge tone="outline">Pendente</Badge> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
