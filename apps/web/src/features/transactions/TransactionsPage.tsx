import {
  formatMonthLabel,
  TRANSACTION_KIND_FILTERS,
  type TransactionDto,
  type TransactionKindFilter,
} from '@spendly/shared'
import { Plus, Search, Sheet as SheetIcon, X } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { useMonth } from '@/lib/month'
import { useIsDesktop } from '@/lib/use-media-query'

import { ExportMenu } from '@/features/import/ExportMenu'

import { useTransactions } from './api'
import { useLookups } from './lookups'
import { RecurringPanel } from './RecurringPanel'
import { TransactionGrid } from './TransactionGrid'
import { TransactionList } from './TransactionList'
import { TransactionSheet, type TransactionSheetState } from './TransactionSheet'

const KIND_LABELS: Record<TransactionKindFilter, string> = {
  all: 'Todos',
  expense: 'Despesas',
  income: 'Receitas',
  transfer: 'Transferências',
  pending: 'Pendentes',
}

/** Filters that come from drill-downs (dashboard, cards…) and show as removable chips. */
const CHIP_PARAMS = ['categoryId', 'accountId', 'creditCardId', 'paidById'] as const

export function TransactionsPage() {
  const { month } = useMonth()
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const lookups = useLookups()
  const [sheet, setSheet] = useState<TransactionSheetState>({ open: false })

  // Each view has its own URL. The old `?view=recorrencias` links still work.
  const view =
    pathname === ROUTES.recurring || params.get('view') === 'recorrencias'
      ? 'recorrencias'
      : 'lancamentos'
  const kindParam = params.get('kind') ?? 'all'
  const kind = (TRANSACTION_KIND_FILTERS as readonly string[]).includes(kindParam)
    ? (kindParam as TransactionKindFilter)
    : 'all'
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDeferredValue(search.trim())

  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  // Keep the search in the URL (shareable, survives reloads) without a request per keystroke.
  useEffect(() => {
    setParam('q', q || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the deferred text changes
  }, [q])

  const query = {
    month,
    kind,
    ...Object.fromEntries(
      CHIP_PARAMS.flatMap((key) => (params.get(key) ? [[key, params.get(key)!]] : [])),
    ),
    ...(q ? { q } : {}),
  }
  const { data, isPending, isError, error, refetch } = useTransactions(query)

  const chips = CHIP_PARAMS.flatMap((key) => {
    const id = params.get(key)
    if (!id) return []
    const label =
      key === 'categoryId'
        ? lookups.category(id)?.name
        : key === 'accountId'
          ? lookups.account(id)?.name
          : key === 'creditCardId'
            ? lookups.card(id)?.name
            : lookups.member(id)?.displayName
    return [{ key, label: label ?? '…' }]
  })
  const filtered = kind !== 'all' || chips.length > 0 || q !== ''

  const clearFilters = () => {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }
  const edit = (transaction: TransactionDto) => setSheet({ open: true, transaction })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          aria-label="Visão"
          value={view}
          onValueChange={(value) =>
            void navigate(value === 'recorrencias' ? ROUTES.recurring : ROUTES.transactions)
          }
          options={[
            { value: 'lancamentos', label: 'Lançamentos' },
            { value: 'recorrencias', label: 'Recorrências' },
          ]}
        />
        {view === 'lancamentos' ? (
          <div className="flex flex-wrap items-center gap-3">
            <ExportMenu month={month} />
            <Button variant="secondary" onClick={() => setSheet({ open: true })}>
              <Plus /> Novo lançamento
            </Button>
          </div>
        ) : null}
      </div>

      {view === 'recorrencias' ? (
        <RecurringPanel lookups={lookups} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative overflow-x-auto">
              <Segmented
                aria-label="Tipo"
                value={kind}
                onValueChange={(value) => setParam('kind', value === 'all' ? null : value)}
                options={TRANSACTION_KIND_FILTERS.map((value) => ({
                  value,
                  label: KIND_LABELS[value],
                }))}
              />
            </div>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setParam(chip.key, null)}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 bg-steel-100 px-2.5 text-xs text-steel-800 hover:bg-steel-200"
                aria-label={`Remover filtro ${chip.label}`}
              >
                {chip.label}
                <X className="size-3" />
              </button>
            ))}
            <div className="relative ml-auto w-full sm:w-60">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar descrição"
                aria-label="Buscar descrição"
                className="pl-8"
              />
            </div>
          </div>

          {isPending ? (
            <Skeleton className="h-96" aria-label="Carregando lançamentos" />
          ) : isError ? (
            <Card>
              <EmptyState
                size="sm"
                icon={SheetIcon}
                title="Não deu para carregar os lançamentos"
                description={error.message}
                action={<Button onClick={() => void refetch()}>Tentar de novo</Button>}
              />
            </Card>
          ) : data.items.length === 0 ? (
            <Card>
              <EmptyState
                icon={SheetIcon}
                title={
                  filtered
                    ? 'Nada por aqui com esses filtros'
                    : `Nenhum lançamento em ${formatMonthLabel(month)}`
                }
                description={
                  filtered
                    ? 'Limpe os filtros ou use a barra acima para lançar.'
                    : 'Use a barra acima, o botão + ou Ctrl+K para lançar o primeiro.'
                }
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => setSheet({ open: true })}>
                      <Plus /> Novo lançamento
                    </Button>
                  )
                }
              />
            </Card>
          ) : isDesktop ? (
            <TransactionGrid
              items={data.items}
              totals={data.totals}
              lookups={lookups}
              onEdit={edit}
            />
          ) : (
            <TransactionList
              items={data.items}
              totals={data.totals}
              lookups={lookups}
              onEdit={edit}
            />
          )}
        </>
      )}

      <TransactionSheet
        // ?novo=1 (from the command palette) opens the detailed form.
        state={params.get('novo') ? { open: true } : sheet}
        onOpenChange={(open) => {
          if (!open) setParam('novo', null)
          setSheet((current) => ({ ...current, open }))
        }}
      />
    </>
  )
}
