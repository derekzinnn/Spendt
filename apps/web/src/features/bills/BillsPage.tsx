import {
  BILL_BUCKET_LABELS,
  firstDayOfMonth,
  formatBRL,
  formatDateBR,
  formatMonthLabel,
  monthName,
  parseIsoDate,
  type BillBucket,
  type BillDto,
} from '@spendly/shared'
import { CalendarCheck2, CircleAlert, CreditCard, Repeat } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { KpiCell, KpiGrid } from '@/components/data/Kpi'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { useLookups } from '@/features/transactions/lookups'
import { cn } from '@/lib/cn'
import { useMonth } from '@/lib/month'

import { useBills } from './api'
import { BillsCalendar } from './BillsCalendar'
import { PayDialog } from './PayDialog'

const BUCKETS: BillBucket[] = ['overdue', 'today', 'week', 'later']

/** "Venceu há 3 dias" · "Vence hoje" · "Vence amanhã" · "em 6 dias" · "25/11". */
function whenLabel(bill: BillDto) {
  const days = bill.daysUntilDue
  if (days < -1) return `Venceu há ${-days} dias`
  if (days === -1) return 'Venceu ontem'
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  if (days <= 7) return `em ${days} dias`
  return `Vence ${formatDateBR(bill.dueDate)}`
}

/** The design's date box: day over the month in small caps. */
function DateBox({ date, late }: { date: string; late: boolean }) {
  const { day, month } = parseIsoDate(date)
  return (
    <div
      className={cn(
        'w-11 shrink-0 border py-0.5 text-center leading-tight',
        late ? 'border-foreground' : 'border-border',
      )}
    >
      <div className="font-display text-lg">{String(day).padStart(2, '0')}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{monthName(month, 'short')}</div>
    </div>
  )
}

function BillRow({
  bill,
  onPay,
  paid = false,
}: {
  bill: BillDto
  onPay: (bill: BillDto) => void
  paid?: boolean
}) {
  const lookups = useLookups()
  const category = lookups.category(bill.categoryId)
  const account = lookups.account(bill.accountId)
  const late = bill.bucket === 'overdue'

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <DateBox date={bill.dueDate} late={late && !paid} />
      <div className="flex min-w-0 items-center gap-2">
        {bill.kind === 'invoice' ? (
          <CreditCard aria-hidden className="size-4.5 shrink-0 text-steel" />
        ) : category ? (
          <CategoryIcon icon={category.icon} color={category.color} size="sm" />
        ) : (
          <span
            aria-hidden
            className="size-5.5 shrink-0 border border-dashed border-border-strong"
          />
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate">
            {bill.description}
            {bill.recurringRuleId ? (
              <Repeat aria-label="Recorrente" className="size-3.5 shrink-0 text-muted-foreground" />
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {paid ? 'Paga' : whenLabel(bill)}
            {account ? ` · ${account.name}` : bill.kind === 'invoice' ? ' · fatura' : ''}
            {bill.kind === 'invoice' && bill.paidCents > 0
              ? ` · ${formatBRL(bill.paidCents)} já pagos`
              : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end gap-1">
          <Money cents={bill.amountCents} />
          {late && !paid ? <Badge tone="negative">Atrasada</Badge> : null}
        </div>
        {paid ? null : (
          <Button variant="secondary" size="sm" onClick={() => onPay(bill)}>
            Pagar
          </Button>
        )}
      </div>
    </li>
  )
}

export function BillsPage() {
  const { month } = useMonth()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'calendario' ? 'calendario' : 'lista'
  const [paying, setPaying] = useState<BillDto | null>(null)
  const { data, isPending } = useBills({ month })

  const items = data?.items ?? []
  const overdue = items.filter(
    (bill) => bill.bucket === 'overdue' && bill.dueDate < firstDayOfMonth(month),
  )
  const groups = BUCKETS.map((bucket) => ({
    bucket,
    bills: items.filter((bill) => bill.bucket === bucket),
  })).filter((group) => group.bills.length > 0)

  return (
    <>
      <PageHeader
        description={`Tudo que ainda falta pagar até o fim de ${formatMonthLabel(month, 'month')} — faturas entram sozinhas na data de vencimento.`}
        actions={
          <Segmented
            aria-label="Visão"
            value={view}
            onValueChange={(value) =>
              setParams(value === 'calendario' ? { view: 'calendario' } : {}, { replace: true })
            }
            options={[
              { value: 'lista', label: 'Lista' },
              { value: 'calendario', label: 'Calendário' },
            ]}
          />
        }
      />

      <KpiGrid className="xl:grid-cols-3">
        <KpiCell
          label="Atrasadas"
          value={
            isPending ? (
              <Skeleton className="my-1 h-7 w-32" />
            ) : (
              <Money cents={data?.totals.overdueCents ?? 0} size="xl" tone="neutral" />
            )
          }
          sub={
            (data?.totals.overdueCents ?? 0) > 0 ? 'pague primeiro' : 'nada atrasado — tudo em dia'
          }
        />
        <KpiCell
          emphasis
          label="Ainda a pagar"
          value={
            isPending ? (
              <Skeleton className="my-1 h-7 w-32" />
            ) : (
              <Money
                cents={data?.totals.dueCents ?? 0}
                size="xl"
                tone="neutral"
                className="text-steel-800"
              />
            )
          }
          sub={`${data?.totals.count ?? 0} ${(data?.totals.count ?? 0) === 1 ? 'conta' : 'contas'}`}
        />
        <KpiCell
          label="Já pagas no mês"
          value={<Money cents={data?.totals.paidCents ?? 0} size="xl" tone="neutral" />}
          sub={`${data?.totals.paidCount ?? 0} ${(data?.totals.paidCount ?? 0) === 1 ? 'conta' : 'contas'}`}
        />
      </KpiGrid>

      {isPending ? (
        <Skeleton className="h-96" aria-label="Carregando contas" />
      ) : view === 'calendario' ? (
        <div className="flex flex-col gap-3">
          {/* Overdue bills fell due in an earlier month, so the grid cannot show them. */}
          {overdue.length > 0 ? (
            <p className="flex flex-wrap items-center gap-2 border-l-2 border-foreground bg-foreground/5 px-3 py-2 text-[13px]">
              <CircleAlert className="size-4 shrink-0" />
              {overdue.length === 1
                ? '1 conta atrasada de antes deste mês'
                : `${overdue.length} contas atrasadas de antes deste mês`}{' '}
              · {formatBRL(data?.totals.overdueCents ?? 0)}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParams({}, { replace: true })}
                className="ml-auto"
              >
                Ver na lista
              </Button>
            </p>
          ) : null}
          <BillsCalendar month={month} bills={items} onSelect={setPaying} />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={CalendarCheck2}
            title={`Nada a pagar até o fim de ${formatMonthLabel(month, 'month')}`}
            description="Contas pendentes e faturas aparecem aqui sozinhas na data de vencimento."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.bucket} aria-label={BILL_BUCKET_LABELS[group.bucket]}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <h2 className="kicker text-muted-foreground">{BILL_BUCKET_LABELS[group.bucket]}</h2>
                <span className="text-[13px] text-muted-foreground">
                  {formatBRL(group.bills.reduce((sum, bill) => sum + bill.amountCents, 0))}
                </span>
              </div>
              <Card className="px-4">
                <ul>
                  {group.bills.map((bill) => (
                    <BillRow key={`${bill.kind}:${bill.id}`} bill={bill} onPay={setPaying} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      {(data?.paid.length ?? 0) > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            Pagas em {formatMonthLabel(month, 'month')} ({data?.paid.length})
          </summary>
          <Card className="mt-3 px-4">
            <ul>
              {data?.paid.map((bill) => (
                <BillRow key={`${bill.kind}:${bill.id}`} bill={bill} onPay={setPaying} paid />
              ))}
            </ul>
          </Card>
        </details>
      ) : null}

      <PayDialog bill={paying} onOpenChange={(open) => !open && setPaying(null)} />
    </>
  )
}
