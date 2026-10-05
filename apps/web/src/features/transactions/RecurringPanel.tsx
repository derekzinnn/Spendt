import { formatDateBR, type RecurringRuleDto } from '@spendly/shared'
import { EllipsisVertical, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/misc'

import { useDeleteRecurringRule, usePauseRecurringRule, useRecurringRules } from './api'
import type { Lookups } from './lookups'
import { describeFrequency } from './recurring-meta'
import { RecurringSheet } from './RecurringSheet'

export function RecurringPanel({ lookups }: { lookups: Lookups }) {
  const { data, isPending } = useRecurringRules()
  const pause = usePauseRecurringRule()
  const remove = useDeleteRecurringRule()
  const [sheet, setSheet] = useState<{ open: boolean; rule?: RecurringRuleDto | undefined }>({
    open: false,
  })
  const [toDelete, setToDelete] = useState<RecurringRuleDto | null>(null)

  const sourceOf = (rule: RecurringRuleDto) =>
    rule.creditCardId
      ? (lookups.card(rule.creditCardId)?.name ?? 'Cartão')
      : (lookups.account(rule.accountId)?.name ?? 'Conta a escolher')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Cada recorrência cria sozinha seus lançamentos: na conta como pendente (aparece em Contas
          a pagar e na previsão); no cartão, entra na fatura no dia.
        </p>
        <Button onClick={() => setSheet({ open: true })}>
          <Plus /> Nova recorrência
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-48" />
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Repeat}
            title="Nenhuma recorrência ainda"
            description="Aluguel, condomínio, internet, assinaturas, salário — cadastre uma vez e pronto."
            action={
              <Button onClick={() => setSheet({ open: true })}>
                <Plus /> Nova recorrência
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul>
            {data?.map((rule) => {
              const category = lookups.category(rule.categoryId)
              return (
                <li
                  key={rule.id}
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${rule.pausedAt ? 'opacity-60' : ''}`}
                >
                  {category ? (
                    <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                  ) : (
                    <Repeat className="size-5 text-muted-foreground" />
                  )}
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 truncate">
                      {rule.description}
                      {rule.pausedAt ? <Badge tone="outline">Pausada</Badge> : null}
                      {rule.autoConfirm ? <Badge tone="neutral">Automático</Badge> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {describeFrequency(rule)} · {sourceOf(rule)}
                      {rule.nextOccurrence
                        ? ` · próxima ${formatDateBR(rule.nextOccurrence)}`
                        : rule.pausedAt
                          ? ''
                          : ' · encerrada'}
                    </span>
                  </span>
                  <Money
                    cents={rule.amountCents}
                    flow={rule.type === 'INCOME' ? 'in' : 'out'}
                    signed
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="quiet"
                        size="icon-sm"
                        aria-label={`Ações de ${rule.description}`}
                      >
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setSheet({ open: true, rule })}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          pause.mutate(
                            { id: rule.id, paused: !rule.pausedAt },
                            {
                              onSuccess: () =>
                                toast.success(
                                  rule.pausedAt ? 'Recorrência retomada' : 'Recorrência pausada',
                                ),
                              onError: (error) => toast.error(error.message),
                            },
                          )
                        }
                      >
                        {rule.pausedAt ? <Play /> : <Pause />}{' '}
                        {rule.pausedAt ? 'Retomar' : 'Pausar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem tone="danger" onSelect={() => setToDelete(rule)}>
                        <Trash2 /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <RecurringSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        rule={sheet.rule}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Excluir “${toDelete?.description ?? ''}”?`}
        description="As próximas ocorrências ainda não pagas somem; o que já foi pago continua nos lançamentos. Para só interromper por um tempo, use Pausar."
        confirmLabel="Excluir recorrência"
        pending={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success('Recorrência excluída'),
            onError: (error) => toast.error(error.message),
            onSettled: () => setToDelete(null),
          })
        }
      />
    </div>
  )
}
