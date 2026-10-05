import { currentMonthKey, formatBRL } from '@spendly/shared'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { KpiCell, KpiGrid } from '@/components/data/Kpi'
import { Money } from '@/components/money/Money'
import { Skeleton } from '@/components/ui/misc'
import { useAccounts } from '@/features/accounts/api'
import { useBills } from '@/features/bills/api'
import { useSummary } from '@/features/dashboard/api'
import { useMonth } from '@/lib/month'

export function Kpis() {
  const { month } = useMonth()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const summary = useSummary(month)
  const bills = useBills({ month })
  const active = accounts.data?.filter((a) => !a.archivedAt) ?? []
  const balance = active.reduce((sum, a) => sum + a.balanceCents, 0)
  const totals = summary.data?.totals
  // Everything still to pay: bills and invoices alike (the projection has both).
  const toPayCents = bills.data?.totals.dueCents ?? totals?.pendingExpenseCents ?? 0
  const toReceiveCents = totals?.pendingIncomeCents ?? 0
  const isCurrent = month === currentMonthKey()
  const loading = (value: ReactNode, pendingQuery: boolean) =>
    pendingQuery ? <Skeleton className="my-1 h-7 w-36" /> : value

  return (
    <KpiGrid>
      <KpiCell
        icon={<ArrowUpRight />}
        label="Receitas"
        value={loading(
          <Money cents={totals?.incomeCents ?? 0} size="xl" tone="neutral" />,
          summary.isPending,
        )}
        sub={toReceiveCents > 0 ? `${formatBRL(toReceiveCents)} ainda a receber` : 'tudo recebido'}
        onClick={() => void navigate(`${ROUTES.transactions}?kind=income`)}
      />
      <KpiCell
        icon={<ArrowDownRight />}
        label="Despesas"
        value={loading(
          <Money cents={totals?.expenseCents ?? 0} size="xl" tone="neutral" />,
          summary.isPending,
        )}
        sub={toPayCents > 0 ? `${formatBRL(toPayCents)} ainda a pagar` : 'contas e cartões do mês'}
        onClick={() => void navigate(`${ROUTES.transactions}?kind=expense`)}
      />
      <KpiCell
        label="Saldo nas contas"
        value={loading(<Money cents={balance} size="xl" tone="neutral" />, accounts.isPending)}
        sub="só o que já foi pago"
      />
      <KpiCell
        emphasis
        label="Previsão fim do mês"
        value={
          isCurrent ? (
            loading(
              <Money
                cents={balance + toReceiveCents - toPayCents}
                size="xl"
                tone="neutral"
                className="text-steel-800"
              />,
              summary.isPending || accounts.isPending || bills.isPending,
            )
          ) : (
            <span className="font-display text-[1.875rem] leading-[1.1]">—</span>
          )
        }
        sub={isCurrent ? 'saldo + a receber − contas e faturas a pagar' : 'só para o mês atual'}
      />
    </KpiGrid>
  )
}
