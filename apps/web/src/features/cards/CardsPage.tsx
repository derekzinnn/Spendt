import {
  addDays,
  CARD_BRAND_LABELS,
  formatBRL,
  formatDateBR,
  formatMonthLabel,
  type CardDto,
  type CardItemDto,
  type InvoiceSummaryDto,
  type PaletteKey,
  type PurchaseScope,
} from '@spendly/shared'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  CreditCard,
  EllipsisVertical,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ROUTES } from '@/app/navigation'
import { CategoryIcon } from '@/components/category/CategoryBadge'
import { KpiCell, KpiGrid } from '@/components/data/Kpi'
import { Ruler } from '@/components/data/Ruler'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/misc'
import { useHouseholdContext } from '@/features/auth/api'
import { useCategories } from '@/features/categories/api'
import { cn } from '@/lib/cn'
import { useMonth } from '@/lib/month'
import { undoToast } from '@/lib/undo-toast'

import {
  useArchiveCard,
  useCardInvoices,
  useCards,
  useDeleteCard,
  useDeletePurchase,
  useInvoice,
  useRestorePurchases,
} from './api'
import { dayMonth, invoiceDates, invoiceName } from './card-meta'
import { CardFormSheet } from './CardFormSheet'
import { InvoiceStatusTag } from './InvoiceStatusTag'
import { PurchaseSheet } from './PurchaseSheet'

const cardPath = (id: string) => `${ROUTES.cards}/${id}`

/** A card in the list: name, status of the current invoice, its total and the limit ruler. */
function CardTile({ card, selected }: { card: CardDto; selected: boolean }) {
  const invoice = card.currentInvoice
  return (
    <Link
      to={cardPath(card.id)}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex flex-col gap-2 border p-3.5 transition-colors duration-150 focus-visible:outline-offset-[-2px]',
        selected ? 'border-steel bg-steel-100' : 'border-border hover:border-steel',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 font-display text-lg leading-tight">
          <CreditCard aria-hidden className="size-4.5 shrink-0" />
          <span className="truncate">{card.name}</span>
          {card.lastFour ? (
            <span className="font-sans text-xs text-muted-foreground">•{card.lastFour}</span>
          ) : null}
        </span>
        <InvoiceStatusTag status={invoice.status} />
      </span>
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <Money cents={invoice.totalCents} size="lg" />
        <span className="text-xs text-muted-foreground">{invoiceDates(invoice)}</span>
      </span>
      <Ruler
        value={card.usedCents}
        max={card.limitCents}
        tick={false}
        label={`Limite usado: ${formatBRL(card.usedCents)} de ${formatBRL(card.limitCents)}`}
      />
      <span className="text-xs text-muted-foreground">
        <Money cents={card.availableCents} size="sm" className="text-xs" tone="muted" /> disponíveis
        de <Money cents={card.limitCents} size="sm" className="text-xs" tone="muted" />
      </span>
    </Link>
  )
}

/** Invoices as a ruled strip of months; the shared month picks the one on screen. */
function InvoiceStrip({
  invoices,
  selectedMonth,
  onSelect,
}: {
  invoices: InvoiceSummaryDto[]
  selectedMonth: string
  onSelect: (month: string) => void
}) {
  const ascending = [...invoices].reverse()
  return (
    <div className="relative overflow-x-auto">
      <div role="tablist" aria-label="Faturas" className="flex min-w-max border border-border">
        {ascending.map((invoice) => {
          const active = invoice.referenceMonth === selectedMonth
          return (
            <button
              key={invoice.referenceMonth}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(invoice.referenceMonth)}
              className={cn(
                'flex min-w-26 cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors not-first:border-l not-first:border-border',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/6',
              )}
            >
              <span className="font-display text-base capitalize">
                {formatMonthLabel(invoice.referenceMonth, 'short')}
              </span>
              <span className={cn('text-xs', !active && 'text-muted-foreground')}>
                {formatBRL(invoice.totalCents)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ItemActions({ item }: { item: CardItemDto }) {
  const remove = useDeletePurchase()
  const restore = useRestorePurchases()
  const run = (scope: PurchaseScope) =>
    remove.mutate(
      { id: item.id, scope },
      {
        onSuccess: ({ ids }) =>
          undoToast(
            ids.length > 1
              ? `${ids.length} parcelas de “${item.description}” excluídas`
              : `“${item.description}” excluído`,
            { onUndo: () => restore.mutate(ids) },
          ),
        onError: (error) => toast.error(error.message),
      },
    )

  const inPlan = item.installmentPlanId !== null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon-sm" aria-label={`Ações de ${item.description}`}>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {inPlan ? (
          <>
            <DropdownMenuLabel className="kicker text-muted-foreground">Excluir</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => run('one')}>
              <Trash2 /> Só esta parcela
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run('following')}>
              <Trash2 /> Esta e as próximas
            </DropdownMenuItem>
            <DropdownMenuItem tone="danger" onSelect={() => run('all')}>
              <Trash2 /> Todas as parcelas
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => run('one')}>
            <Trash2 /> Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InvoiceItems({ invoiceId }: { invoiceId: string }) {
  const { data, isPending } = useInvoice(invoiceId)
  const { members } = useHouseholdContext()
  const categories = useCategories().data
  const byId = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.displayName ?? '—'

  if (isPending) return <Skeleton className="h-48" />
  if (!data) return null
  if (data.items.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={Receipt}
        title="Nenhuma compra nesta fatura"
        description="Compras e estornos aparecem aqui assim que forem lançados."
      />
    )
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-150 border-collapse text-sm">
        <thead>
          <tr className="text-left">
            {['Data', 'Descrição', 'Categoria', 'Pago por'].map((head) => (
              <th
                key={head}
                className="kicker border-b border-border px-2 py-2 font-normal text-muted-foreground"
              >
                {head}
              </th>
            ))}
            <th className="kicker border-b border-border px-2 py-2 text-right font-normal text-muted-foreground">
              Valor
            </th>
            <th className="w-10 border-b border-border" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => {
            const category = item.categoryId ? byId.get(item.categoryId) : undefined
            const parent = category?.parentId ? byId.get(category.parentId) : undefined
            return (
              <tr key={item.id} className="border-b border-foreground/8 hover:bg-foreground/4">
                <td className="px-2 py-2 whitespace-nowrap">{dayMonth(item.date)}</td>
                <td className="px-2 py-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {item.description}
                    {item.installmentNumber ? (
                      <Badge tone="neutral">
                        {item.installmentNumber}/{item.installmentCount}
                      </Badge>
                    ) : null}
                    {item.kind === 'REFUND' ? <Badge tone="primary">Estorno</Badge> : null}
                  </span>
                </td>
                <td className="px-2 py-2">
                  {category ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CategoryIcon icon={category.icon} color={category.color} size="xs" />
                      {parent ? (
                        <span className="text-muted-foreground">{parent.name} ›</span>
                      ) : null}
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">{memberName(item.paidById)}</td>
                <td className="px-2 py-2 text-right">
                  <Money
                    cents={item.amountCents}
                    flow={item.kind === 'REFUND' ? 'in' : 'out'}
                    signed
                  />
                </td>
                <td className="px-1">
                  <ItemActions item={item} />
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td colSpan={4} className="border-t border-foreground px-2 py-2.5">
              Total · {data.itemCount} {data.itemCount === 1 ? 'lançamento' : 'lançamentos'}
            </td>
            <td className="border-t border-foreground px-2 py-2.5 text-right">
              <Money cents={data.totalCents} />
            </td>
            <td className="border-t border-foreground" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CardDetail({
  card,
  onEdit,
  onBuy,
}: {
  card: CardDto
  onEdit: () => void
  onBuy: () => void
}) {
  const { month, setMonth } = useMonth()
  const { members } = useHouseholdContext()
  const invoices = useCardInvoices(card.id)
  const archive = useArchiveCard()
  const navigate = useNavigate()
  const holder = members.find((m) => m.id === card.holderId)
  const selected = invoices.data?.find((inv) => inv.referenceMonth === month)
  const current = card.currentInvoice

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[25px] leading-tight">{card.name}</h2>
          <p className="text-[13px] text-muted-foreground">
            {CARD_BRAND_LABELS[card.brand]}
            {card.lastFour ? ` · final ${card.lastFour}` : ''} ·{' '}
            {holder ? `em nome de ${holder.displayName}` : 'da casa'} · fecha dia {card.closingDay},
            vence dia {card.dueDay}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={onBuy}>
            <Plus /> Compra
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="quiet" size="icon" aria-label={`Ações de ${card.name}`}>
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Editar cartão
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  archive.mutate(
                    { id: card.id, archived: true },
                    {
                      onSuccess: () => {
                        void navigate(ROUTES.cards)
                        undoToast(`“${card.name}” arquivado`, {
                          description: 'Ele some das listas, mas as faturas ficam guardadas.',
                          onUndo: () => archive.mutate({ id: card.id, archived: false }),
                        })
                      },
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                <Archive /> Arquivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <KpiGrid className="xl:grid-cols-3">
        <KpiCell
          emphasis
          label={`Fatura atual · ${invoiceName(current.referenceMonth).toLowerCase()}`}
          value={
            <Money cents={current.totalCents} size="xl" tone="neutral" className="text-steel-800" />
          }
          sub={invoiceDates(current)}
          onClick={() => setMonth(current.referenceMonth)}
        />
        <KpiCell
          label="Limite disponível"
          value={<Money cents={card.availableCents} size="xl" tone="neutral" />}
          sub={`de ${formatBRL(card.limitCents)} · parcelas futuras já contam`}
        />
        <KpiCell
          label="Limite usado"
          value={<Money cents={card.usedCents} size="xl" tone="neutral" />}
          sub={`${card.limitCents > 0 ? Math.round((card.usedCents / card.limitCents) * 100) : 0}% do limite`}
        />
      </KpiGrid>

      {invoices.isPending ? (
        <Skeleton className="h-14" />
      ) : (invoices.data?.length ?? 0) > 0 ? (
        <InvoiceStrip invoices={invoices.data ?? []} selectedMonth={month} onSelect={setMonth} />
      ) : null}

      <Card className="flex flex-col gap-3 p-5">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl">{invoiceName(selected.referenceMonth)}</h3>
                <p className="text-[13px] text-muted-foreground">
                  Compras de {formatDateBR(selected.periodStart)} a{' '}
                  {formatDateBR(addDays(selected.closingDate, -1))} · vence{' '}
                  {formatDateBR(selected.dueDate)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <InvoiceStatusTag status={selected.status} />
                <Money cents={selected.totalCents} size="lg" />
                {selected.paidCents > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    pago {formatBRL(selected.paidCents)}
                  </span>
                ) : null}
              </div>
            </div>
            {selected.id ? <InvoiceItems invoiceId={selected.id} /> : null}
          </>
        ) : (
          <EmptyState
            size="sm"
            icon={Receipt}
            title={`Nenhuma fatura vence em ${formatMonthLabel(month)}`}
            description="Escolha outro mês no topo ou na faixa de faturas, ou lance uma compra."
            action={
              <Button variant="secondary" onClick={() => setMonth(current.referenceMonth)}>
                Ir para a fatura atual
              </Button>
            }
          />
        )}
      </Card>
    </div>
  )
}

function ArchivedCards({ cards }: { cards: CardDto[] }) {
  const archive = useArchiveCard()
  const remove = useDeleteCard()
  const [toDelete, setToDelete] = useState<CardDto | null>(null)
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        Arquivados ({cards.length})
      </summary>
      <Card className="mt-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
          >
            <CreditCard className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {card.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                archive.mutate(
                  { id: card.id, archived: false },
                  {
                    onSuccess: () => toast.success(`“${card.name}” restaurado`),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              <ArchiveRestore /> Restaurar
            </Button>
            <Button
              variant="quiet"
              size="icon-sm"
              aria-label={`Excluir ${card.name}`}
              onClick={() => setToDelete(card)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </Card>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Excluir “${toDelete?.name ?? ''}”?`}
        description="Só dá para excluir cartões sem nenhuma compra. Isso não pode ser desfeito."
        confirmLabel="Excluir de vez"
        pending={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success('Cartão excluído'),
            onError: (e) => toast.error(e.message),
            onSettled: () => setToDelete(null),
          })
        }
      />
    </details>
  )
}

export function CardsPage() {
  const { cardId } = useParams()
  const { data, isPending, isError, error, refetch } = useCards()
  const [cardSheet, setCardSheet] = useState<{ open: boolean; card?: CardDto | undefined }>({
    open: false,
  })
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [params, setParams] = useSearchParams()

  const active = useMemo(() => data?.filter((c) => !c.archivedAt) ?? [], [data])
  const archived = useMemo(() => data?.filter((c) => c.archivedAt) ?? [], [data])
  const usedColors = useMemo<PaletteKey[]>(() => active.map((c) => c.color), [active])
  const selected = active.find((c) => c.id === cardId) ?? active[0]

  return (
    <>
      <PageHeader
        description="Cada compra cai na fatura certa pela data de fechamento; as parcelas vão para as faturas seguintes."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setPurchaseOpen(true)}
              disabled={active.length === 0}
            >
              <Plus /> Nova compra
            </Button>
            <Button onClick={() => setCardSheet({ open: true })}>
              <Plus /> Novo cartão
            </Button>
          </>
        }
      />

      {isPending ? (
        <div className="grid gap-7 lg:grid-cols-[340px_minmax(0,1fr)]" aria-busy="true">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      ) : isError ? (
        <Card>
          <EmptyState
            size="sm"
            icon={CreditCard}
            title="Não deu para carregar os cartões"
            description={error.message}
            action={<Button onClick={() => void refetch()}>Tentar de novo</Button>}
          />
        </Card>
      ) : active.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={CreditCard}
            title="Cadastre o primeiro cartão"
            description="Com o dia de fechamento e de vencimento, cada compra entra sozinha na fatura certa."
            action={
              <Button onClick={() => setCardSheet({ open: true })}>
                <Plus /> Novo cartão
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid items-start gap-7 lg:grid-cols-[340px_minmax(0,1fr)]">
          <nav aria-label="Cartões" className="flex flex-col gap-3">
            {active.map((card) => (
              <CardTile key={card.id} card={card} selected={card.id === selected?.id} />
            ))}
          </nav>
          {selected ? (
            <CardDetail
              card={selected}
              onEdit={() => setCardSheet({ open: true, card: selected })}
              onBuy={() => setPurchaseOpen(true)}
            />
          ) : null}
        </div>
      )}

      {archived.length > 0 ? <ArchivedCards cards={archived} /> : null}

      <CardFormSheet
        open={cardSheet.open}
        onOpenChange={(open) => setCardSheet((current) => ({ ...current, open }))}
        card={cardSheet.card}
        usedColors={usedColors}
      />
      <PurchaseSheet
        // ?compra=1 (from the command palette) opens the purchase sheet.
        open={purchaseOpen || params.get('compra') !== null}
        onOpenChange={(open) => {
          if (!open && params.get('compra')) setParams({}, { replace: true })
          setPurchaseOpen(open)
        }}
        cards={active}
        cardId={selected?.id}
      />
    </>
  )
}
