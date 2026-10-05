import { formatBRL, formatMonthLabel, type CategorySpendDto } from '@spendly/shared'
import { PieChart } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { CategoryIcon } from '@/components/category/CategoryBadge'
import { Donut } from '@/components/data/Donut'
import { Ruler } from '@/components/data/Ruler'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useSummary } from '@/features/dashboard/api'
import { cn } from '@/lib/cn'
import { useMonth } from '@/lib/month'

import { CardHead } from './CardHead'

/** Past five categories the donut stops being readable: the rest become one "Outros" slice. */
const MAX_SLICES = 5

/**
 * Where the money went: a ring plus a ranked list with each budget's ruler. Every row opens
 * the transactions grid already filtered by that category (integration rule 6).
 */
export function CategorySpending() {
  const { month } = useMonth()
  const navigate = useNavigate()
  const { data, isPending } = useSummary(month)
  const [active, setActive] = useState<string | null>(null)

  const spending = (data?.byCategory ?? []).filter((row) => row.spentCents > 0)
  const totalCents = spending.reduce((sum, row) => sum + row.spentCents, 0)
  const head = spending.slice(0, MAX_SLICES)
  const rest = spending.slice(MAX_SLICES)
  const restCents = rest.reduce((sum, row) => sum + row.spentCents, 0)

  const slices = [
    ...head.map((row) => ({
      id: row.categoryId,
      label: row.name,
      cents: row.spentCents,
      color: row.color,
    })),
    ...(restCents > 0
      ? [{ id: 'outros', label: 'Outros', cents: restCents, color: 'neutral' as const }]
      : []),
  ]

  const openCategory = (categoryId: string) => {
    if (categoryId === 'outros') return void navigate(ROUTES.transactions)
    void navigate(`${ROUTES.transactions}?categoryId=${categoryId}`)
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <CardHead
        title="Gastos por categoria"
        aside={
          <span className="hidden text-xs text-muted-foreground desk:inline">
            clique para ver os lançamentos
          </span>
        }
      />
      {isPending ? (
        <Skeleton className="h-56" />
      ) : spending.length === 0 ? (
        <EmptyState
          size="sm"
          icon={PieChart}
          title={`Nenhum gasto em ${formatMonthLabel(month, 'month')}`}
          description="Assim que lançar algo, o mês aparece dividido por categoria aqui."
          action={
            <Button asChild variant="secondary">
              <Link to={ROUTES.transactions}>Ir para lançamentos</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <Donut
            slices={slices}
            totalCents={totalCents}
            activeId={active}
            onActivate={setActive}
            onSelect={openCategory}
          />
          <ol
            className="flex min-w-60 flex-1 flex-col"
            aria-label="Gastos por categoria, do maior para o menor"
          >
            {head.map((row) => (
              <CategoryRow
                key={row.categoryId}
                row={row}
                active={active === row.categoryId}
                onActivate={setActive}
                onSelect={openCategory}
              />
            ))}
            {restCents > 0 ? (
              <li className="flex items-center gap-2 border-b border-border px-1.5 py-2.5 text-sm">
                <span className="size-5.5 shrink-0 bg-graphite-500" aria-hidden />
                <span className="flex-1 truncate text-muted-foreground">
                  Outros · {rest.length} categorias
                </span>
                <Money cents={restCents} size="sm" />
              </li>
            ) : null}
          </ol>
        </div>
      )}
    </Card>
  )
}

function CategoryRow({
  row,
  active,
  onActivate,
  onSelect,
}: {
  row: CategorySpendDto
  active: boolean
  onActivate: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const pct = row.usageBps === null ? null : Math.round(row.usageBps / 100)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row.categoryId)}
        onMouseEnter={() => onActivate(row.categoryId)}
        onMouseLeave={() => onActivate(null)}
        onFocus={() => onActivate(row.categoryId)}
        onBlur={() => onActivate(null)}
        className={cn(
          'flex w-full cursor-pointer flex-col gap-1.5 border-b border-border px-1.5 py-2.5 text-left transition-colors duration-150 hover:bg-steel/7',
          active && 'bg-steel/7',
        )}
      >
        <span className="flex items-center gap-2 text-sm">
          <CategoryIcon icon={row.icon} color={row.color} size="sm" />
          <span className="flex-1 truncate">{row.name}</span>
          {pct !== null && pct >= 80 ? (
            <Badge tone={pct >= 100 ? 'warning' : 'primary'}>
              {pct >= 100 ? 'estourou' : `${pct}%`}
            </Badge>
          ) : null}
          <Money cents={row.spentCents} size="sm" />
        </span>
        {row.budgetCents ? (
          <span className="flex items-center gap-2">
            <Ruler
              value={row.spentCents}
              max={row.budgetCents}
              className="flex-1"
              label={`${formatBRL(row.spentCents)} de ${formatBRL(row.budgetCents)}`}
            />
            <span className="min-w-24 text-right text-[11px] text-muted-foreground">
              de {formatBRL(row.budgetCents)}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 flex-1 bg-muted">
              <span
                className="block h-full origin-left animate-grow-x bg-steel/40"
                style={{ width: `${Math.round(row.shareBps / 100)}%` }}
              />
            </span>
            <span className="min-w-24 text-right text-[11px] text-muted-foreground">
              {Math.round(row.shareBps / 100)}% do mês
            </span>
          </span>
        )}
      </button>
    </li>
  )
}
