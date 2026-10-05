import { formatBRL } from '@spendly/shared'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { useSummary } from '@/features/dashboard/api'
import { cn } from '@/lib/cn'
import { useMonth } from '@/lib/month'

/**
 * The design's alert strip: one tag per budget at 80% or past 100%, each opening the grid
 * filtered by that category. Nothing here relies on colour — the tag says the number.
 */
export function BudgetAlerts() {
  const { month } = useMonth()
  const alerts = useSummary(month).data?.alerts ?? []
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[13px]">
        <TriangleAlert aria-hidden className="size-4" />
        Orçamentos:
      </span>
      {alerts.map((alert) => {
        const pct = Math.round(alert.usageBps / 100)
        const over = pct >= 100
        return (
          <Link
            key={alert.categoryId}
            to={`${ROUTES.transactions}?categoryId=${alert.categoryId}`}
            title={`${formatBRL(alert.spentCents)} de ${formatBRL(alert.budgetCents)}`}
            className={cn(
              'border px-2.5 py-1 text-xs transition-colors',
              over
                ? 'border-foreground hover:bg-foreground/7'
                : 'border-steel text-steel-800 hover:bg-steel-100',
            )}
          >
            {alert.name} · {pct}%{over ? ' — estourou' : ''}
          </Link>
        )
      })}
    </div>
  )
}
