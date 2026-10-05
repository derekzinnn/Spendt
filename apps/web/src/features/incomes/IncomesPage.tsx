import { formatBRL, formatDateBR, formatMonthLabel, type TransactionDto } from '@spendly/shared'
import { Plus, Repeat, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { KpiCell, KpiGrid } from '@/components/data/Kpi'
import { Ruler } from '@/components/data/Ruler'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberAvatar } from '@/components/member/MemberAvatar'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useTransactions, useUpdateTransaction } from '@/features/transactions/api'
import { useLookups } from '@/features/transactions/lookups'
import {
  TransactionSheet,
  type TransactionSheetState,
} from '@/features/transactions/TransactionSheet'
import { errorMessage } from '@/lib/form-errors'
import { useMonth } from '@/lib/month'
import { undoToast } from '@/lib/undo-toast'

/** Salaries, freelas and anything else coming in this month — received or still expected. */
export function IncomesPage() {
  const { month } = useMonth()
  const lookups = useLookups()
  const { data, isPending } = useTransactions({ month, kind: 'income' })
  const update = useUpdateTransaction()
  const [sheet, setSheet] = useState<TransactionSheetState>({ open: false })

  const items = data?.items ?? []
  const received = items.filter((row) => row.status === 'PAID')
  const expected = items.filter((row) => row.status === 'PENDING')
  const sum = (rows: TransactionDto[]) => rows.reduce((total, row) => total + row.amountCents, 0)
  const receivedCents = sum(received)
  const expectedCents = sum(expected)
  const totalCents = receivedCents + expectedCents

  const markReceived = (row: TransactionDto) => {
    if (!row.accountId) {
      setSheet({ open: true, transaction: row })
      toast('Escolha em qual conta entrou')
      return
    }
    update.mutate(
      { id: row.id, status: 'PAID' },
      {
        onSuccess: () =>
          undoToast(`“${row.description}” recebido`, {
            description: formatBRL(row.amountCents),
            onUndo: () => update.mutate({ id: row.id, status: 'PENDING' }),
          }),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  const byPerson = lookups.members.map((member) => ({
    member,
    cents: sum(items.filter((row) => row.paidById === member.id)),
  }))

  return (
    <>
      <PageHeader
        description={`Tudo que entra em ${formatMonthLabel(month, 'month')} — salários, freelas e rendimentos da casa.`}
        actions={
          <Button onClick={() => setSheet({ open: true, type: 'INCOME' })}>
            <Plus /> Nova receita
          </Button>
        }
      />

      <KpiGrid className="xl:grid-cols-3">
        <KpiCell
          label="Recebido"
          value={
            isPending ? (
              <Skeleton className="my-1 h-7 w-32" />
            ) : (
              <Money cents={receivedCents} size="xl" tone="neutral" />
            )
          }
          sub={`${received.length} ${received.length === 1 ? 'entrada' : 'entradas'}`}
        />
        <KpiCell
          label="A receber"
          value={<Money cents={expectedCents} size="xl" tone="neutral" />}
          sub={expected.length > 0 ? `${expected.length} previstas` : 'nada pendente'}
        />
        <KpiCell
          emphasis
          label="Total do mês"
          value={<Money cents={totalCents} size="xl" tone="neutral" className="text-steel-800" />}
          sub="recebido + previsto"
        />
      </KpiGrid>

      {isPending ? (
        <Skeleton className="h-80" aria-label="Carregando receitas" />
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={TrendingUp}
            title={`Nenhuma receita em ${formatMonthLabel(month, 'month')}`}
            description="Lance o salário como recorrência e ele aparece sozinho todo mês."
            action={
              <Button onClick={() => setSheet({ open: true, type: 'INCOME' })}>
                <Plus /> Nova receita
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="px-4">
            <ul>
              {items.map((row) => {
                const category = lookups.category(row.categoryId)
                const account = lookups.account(row.accountId)
                return (
                  <li
                    key={row.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2.5 last:border-b-0"
                  >
                    {category ? (
                      <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                    ) : (
                      <span
                        aria-hidden
                        className="size-5.5 shrink-0 border border-dashed border-border-strong"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setSheet({ open: true, transaction: row })}
                      className="min-w-0 cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {row.description}
                        {row.recurringRuleId ? (
                          <Repeat
                            aria-label="Recorrente"
                            className="size-3.5 shrink-0 text-muted-foreground"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDateBR(row.date)}
                        {account ? ` · ${account.name}` : ''}
                        {row.paidById
                          ? ` · ${lookups.member(row.paidById)?.displayName ?? ''}`
                          : ''}
                      </span>
                    </button>
                    <span className="flex items-center gap-3">
                      <span className="flex flex-col items-end gap-1">
                        <Money cents={row.amountCents} flow="in" />
                        {row.status === 'PENDING' ? <Badge tone="outline">A receber</Badge> : null}
                      </span>
                      {row.status === 'PENDING' ? (
                        <Button variant="secondary" size="sm" onClick={() => markReceived(row)}>
                          Recebi
                        </Button>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-xl">Quem recebeu</h2>
            <ul className="flex flex-col gap-3">
              {byPerson.map(({ member, cents }) => (
                <li key={member.id} className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-2 text-sm">
                    <MemberAvatar
                      name={member.displayName}
                      color={member.color}
                      size="xs"
                      className="ring-0"
                    />
                    <span className="flex-1 truncate">{member.displayName}</span>
                    <Money cents={cents} size="sm" />
                  </span>
                  <Ruler
                    value={cents}
                    max={totalCents || 1}
                    tick={false}
                    label={`${formatBRL(cents)} de ${formatBRL(totalCents)}`}
                  />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Só informação: tudo o que entra é da casa.
            </p>
          </Card>
        </div>
      )}

      <TransactionSheet
        state={sheet}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
      />
    </>
  )
}
