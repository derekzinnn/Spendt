import { formatBRL } from '@spendly/shared'
import { CreditCard } from 'lucide-react'
import { Link } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { Ruler } from '@/components/data/Ruler'
import { Money } from '@/components/money/Money'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useCards } from '@/features/cards/api'
import { invoiceDates } from '@/features/cards/card-meta'
import { InvoiceStatusTag } from '@/features/cards/InvoiceStatusTag'

import { CardHead } from './CardHead'

/** The design's "Cartões" list: current invoice, its dates and the limit ruler per card. */
export function CardsGlance() {
  const cards = useCards()
  const active = cards.data?.filter((c) => !c.archivedAt) ?? []

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <CardHead
        title="Cartões"
        aside={
          <Link to={ROUTES.cards} className="text-[13px] text-steel-700 hover:underline">
            Ver faturas
          </Link>
        }
      />
      {cards.isPending ? (
        <Skeleton className="h-40" />
      ) : active.length === 0 ? (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Nenhum cartão ainda.{' '}
          <Link to={ROUTES.cards} className="text-steel-700 underline">
            Cadastrar cartão
          </Link>
        </p>
      ) : (
        active.map((card) => (
          <Link
            key={card.id}
            to={`${ROUTES.cards}/${card.id}`}
            className="flex flex-col gap-2 border border-border p-3.5 transition-colors duration-150 hover:border-steel"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 font-display text-lg leading-tight">
                <CreditCard aria-hidden className="size-4.5 shrink-0" />
                <span className="truncate">{card.name}</span>
              </span>
              <InvoiceStatusTag status={card.currentInvoice.status} />
            </span>
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <Money cents={card.currentInvoice.totalCents} size="lg" className="text-[26px]" />
              <span className="text-xs text-muted-foreground">
                {invoiceDates(card.currentInvoice)}
              </span>
            </span>
            <Ruler
              value={card.usedCents}
              max={card.limitCents}
              tick={false}
              label={`Limite usado: ${formatBRL(card.usedCents)} de ${formatBRL(card.limitCents)}`}
            />
            <span className="text-xs text-muted-foreground">
              {formatBRL(card.availableCents)} disponíveis de {formatBRL(card.limitCents)}
            </span>
          </Link>
        ))
      )}
    </Card>
  )
}
