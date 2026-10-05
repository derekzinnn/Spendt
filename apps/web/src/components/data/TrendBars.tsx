import {
  capitalize,
  formatMonthLabel,
  monthName,
  parseMonthKey,
  type MonthPointDto,
} from '@spendly/shared'

import { Money } from '@/components/money/Money'
import { cn } from '@/lib/cn'

/**
 * Income × expense over the last months, drawn with plain boxes: income outlined, expense
 * filled, the month on screen in the deepest steel. No chart library in the shell bundle.
 *
 * The bars are decoration (`aria-hidden`) — the table below is the real content.
 */
export function TrendBars({
  points,
  currentMonth,
  onSelect,
}: {
  points: MonthPointDto[]
  currentMonth: string
  onSelect?: (month: string) => void
}) {
  const max = Math.max(1, ...points.flatMap((point) => [point.incomeCents, point.expenseCents]))
  const height = (cents: number) => `${Math.max((cents / max) * 100, cents > 0 ? 2 : 0)}%`

  return (
    <figure className="flex flex-col gap-2">
      <div
        aria-hidden
        className="grid h-42 items-end gap-2.5 border-b border-foreground"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point) => (
          <div key={point.month} className="flex h-full items-end justify-center gap-[3px]">
            <div
              className="w-[40%] max-w-5.5 origin-bottom animate-grow-y border border-steel"
              style={{ height: height(point.incomeCents) }}
            />
            <div
              className={cn(
                'w-[40%] max-w-5.5 origin-bottom animate-grow-y',
                point.month === currentMonth ? 'bg-steel-900' : 'bg-steel-700',
              )}
              style={{ height: height(point.expenseCents) }}
            />
          </div>
        ))}
      </div>
      <div
        className="grid gap-2.5 text-center text-xs"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point) => {
          const label = capitalize(monthName(parseMonthKey(point.month).month, 'short'))
          const isCurrent = point.month === currentMonth
          return onSelect ? (
            <button
              key={point.month}
              type="button"
              onClick={() => onSelect(point.month)}
              aria-label={`Ver ${formatMonthLabel(point.month)}`}
              className={cn(
                'cursor-pointer py-0.5 transition-colors hover:text-foreground',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ) : (
            <span
              key={point.month}
              className={cn(isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground')}
            >
              {label}
            </span>
          )
        })}
      </div>

      <details className="group mt-1 text-[13px]">
        <summary className="w-fit cursor-pointer text-steel-700 hover:underline">
          Ver como tabela
        </summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="kicker border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 font-normal">Mês</th>
              <th className="py-1.5 text-right font-normal">Receitas</th>
              <th className="py-1.5 text-right font-normal">Despesas</th>
              <th className="py-1.5 text-right font-normal">Sobrou</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month} className="border-b border-border last:border-0">
                <td className="py-1.5 capitalize">{formatMonthLabel(point.month, 'short')}</td>
                <td className="py-1.5 text-right">
                  <Money cents={point.incomeCents} size="sm" />
                </td>
                <td className="py-1.5 text-right">
                  <Money cents={point.expenseCents} size="sm" />
                </td>
                <td className="py-1.5 text-right">
                  <Money cents={point.incomeCents - point.expenseCents} size="sm" signed />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
