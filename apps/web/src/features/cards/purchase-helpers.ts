import {
  formatBRL,
  monthKeyOf,
  resolveInstallmentCycle,
  type CardDto,
  type CardPurchaseResultDto,
  type InvoicePeriod,
  type IsoDate,
} from '@spendly/shared'
import { toast } from 'sonner'

import { undoToast } from '@/lib/undo-toast'

import { useCardInvoices } from './api'
import { dayMonth, invoiceName } from './card-meta'

/**
 * Where a purchase will land, computed with the same engine the API uses — fed with the
 * card's existing invoices so snapshots are respected. Returns null until a card is chosen.
 */
export function useInvoicePreview(card: CardDto | undefined, date: IsoDate | undefined) {
  const invoices = useCardInvoices(card?.id).data
  if (!card || !date) return null
  const periods: InvoicePeriod[] = (invoices ?? []).map((inv) => ({
    referenceMonth: `${inv.referenceMonth}-01`,
    periodStart: inv.periodStart,
    closingDate: inv.closingDate,
    dueDate: inv.dueDate,
  }))
  try {
    const cycle = resolveInstallmentCycle(card, date, 0, periods)
    return {
      label: `Entra na ${invoiceName(monthKeyOf(cycle.referenceMonth)).toLowerCase()} · vence ${dayMonth(cycle.dueDate)}`,
      cycle,
    }
  } catch {
    return null
  }
}

/** Success toast for a new purchase, with "Desfazer" (soft-deletes every installment). */
export function announcePurchase(result: CardPurchaseResultDto, onUndo: () => void) {
  const first = result.items[0]
  const count = result.items.length
  const what =
    first?.kind === 'REFUND'
      ? `Estorno de ${formatBRL(first.amountCents)}`
      : count > 1
        ? `${count}x de ${formatBRL(first?.amountCents ?? 0)}`
        : formatBRL(first?.amountCents ?? 0)
  undoToast(`${what} · ${invoiceName(result.invoice.referenceMonth).toLowerCase()}`, {
    description: `Vence ${dayMonth(result.invoice.dueDate)}${count > 1 ? ' — as demais parcelas nas próximas faturas' : ''}`,
    onUndo,
  })
  if (result.landedOnPaidInvoice) {
    toast.warning('Essa fatura já estava paga', {
      description: 'A compra entrou nela mesmo assim — agora falta pagar a diferença.',
    })
  }
}
