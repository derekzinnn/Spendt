import { monthName, parseIsoDate } from '@spendly/shared'
import { CreditCard } from 'lucide-react'
import { Link } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { CategoryIcon } from '@/components/category/CategoryBadge'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useBills } from '@/features/bills/api'
import { useLookups } from '@/features/transactions/lookups'
import { cn } from '@/lib/cn'
import { useMonth } from '@/lib/month'

import { CardHead } from './CardHead'

/** The design's "Próximas contas": date box, what it is, when it falls due. */
export function UpcomingBills() {
  const { month } = useMonth()
  const { data, isPending } = useBills({ month })
  const lookups = useLookups()
  const items = (data?.items ?? []).slice(0, 5)

  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <CardHead
        title="Próximas contas"
        aside={
          <Link to={ROUTES.bills} className="text-[13px] text-steel-700 hover:underline">
            Ver todas
          </Link>
        }
      />
      {isPending ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Nada a pagar até o fim do mês.
        </p>
      ) : (
        items.map((bill) => {
          const category = lookups.category(bill.categoryId)
          const late = bill.bucket === 'overdue'
          const { day, month: billMonth } = parseIsoDate(bill.dueDate)
          return (
            <Link
              key={`${bill.kind}:${bill.id}`}
              to={ROUTES.bills}
              className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-2 transition-colors hover:bg-steel/7"
            >
              <span
                className={cn(
                  'border py-0.5 text-center leading-tight',
                  late ? 'border-foreground' : 'border-border',
                )}
              >
                <span className="block font-display text-lg">{String(day).padStart(2, '0')}</span>
                <span className="block text-[10px] text-muted-foreground uppercase">
                  {monthName(billMonth, 'short')}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {bill.kind === 'invoice' ? (
                  <CreditCard aria-hidden className="size-4 shrink-0 text-steel" />
                ) : category ? (
                  <CategoryIcon icon={category.icon} color={category.color} size="xs" />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm">{bill.description}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {bill.daysUntilDue < 0
                      ? `Venceu há ${-bill.daysUntilDue} dias`
                      : bill.daysUntilDue === 0
                        ? 'Vence hoje'
                        : `em ${bill.daysUntilDue} dias`}
                  </span>
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <Money cents={bill.amountCents} size="sm" />
                {late ? <Badge tone="negative">Atrasada</Badge> : null}
              </span>
            </Link>
          )
        })
      )}
    </Card>
  )
}

/** The design's "Cartões" list: current invoice, its dates and the limit ruler per card. */
