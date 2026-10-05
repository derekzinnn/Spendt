import { formatBRL, formatDateBR, todayIso, type BillDto } from '@spendly/shared'
import { Dialog } from 'radix-ui'
import { useState } from 'react'
import { toast } from 'sonner'

import { AmountInput } from '@/components/money/AmountInput'
import { Money } from '@/components/money/Money'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { overlayClassName } from '@/components/ui/sheet'
import { useAccounts } from '@/features/accounts/api'
import { useDeleteTransaction, useUpdateTransaction } from '@/features/transactions/api'
import { errorMessage } from '@/lib/form-errors'
import { undoToast } from '@/lib/undo-toast'

import { usePayBill, usePayInvoice } from './api'

/**
 * Paying in one step: which account it leaves, when, and (for an invoice) how much — partial
 * payments are allowed. "Desfazer" puts everything back, since a payment is just one row.
 */
export function PayDialog({
  bill,
  onOpenChange,
}: {
  bill: BillDto | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog.Root open={bill !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClassName} />
        <Dialog.Content
          aria-describedby={undefined}
          className="blueprint fixed inset-x-3 bottom-3 z-50 border border-border bg-background p-5 shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:duration-220 data-[state=open]:ease-out-soft data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 desk:inset-x-auto desk:top-1/2 desk:bottom-auto desk:left-1/2 desk:w-110 desk:-translate-x-1/2 desk:-translate-y-1/2"
        >
          <Dialog.Title className="text-xl">
            {bill?.kind === 'invoice' ? 'Pagar fatura' : 'Pagar conta'}
          </Dialog.Title>
          {bill ? <PayForm bill={bill} onDone={() => onOpenChange(false)} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PayForm({ bill, onDone }: { bill: BillDto; onDone: () => void }) {
  const accounts = (useAccounts().data ?? []).filter((a) => !a.archivedAt)
  const payBill = usePayBill()
  const payInvoice = usePayInvoice()
  const remove = useDeleteTransaction()
  const update = useUpdateTransaction()

  const [accountId, setAccountId] = useState(bill.accountId ?? accounts[0]?.id ?? '')
  const [date, setDate] = useState(todayIso())
  const [cents, setCents] = useState<number | null>(bill.amountCents)
  const isInvoice = bill.kind === 'invoice'
  const pending = payBill.isPending || payInvoice.isPending

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!accountId) return toast('Escolha a conta')
    if (isInvoice) {
      if (!cents) return toast('Informe o valor')
      payInvoice.mutate(
        { id: bill.id, accountId, amountCents: cents, date },
        {
          onSuccess: ({ transactionId, settled }) => {
            undoToast(`${formatBRL(cents)} · ${bill.description}`, {
              description: settled ? 'Fatura paga' : 'Pagamento parcial registrado',
              // A payment is one TRANSFER row: undoing it is deleting that row.
              onUndo: () => remove.mutate({ id: transactionId }),
            })
            onDone()
          },
          onError: (error) => toast.error(errorMessage(error)),
        },
      )
      return
    }
    payBill.mutate(
      { id: bill.id, accountId, paidDate: date },
      {
        onSuccess: (row) => {
          undoToast(`“${row.description}” paga`, {
            description: `${formatBRL(row.amountCents)} · ${formatDateBR(date)}`,
            // The bill was not deleted, only confirmed: undoing it makes it pending again.
            onUndo: () => update.mutate({ id: row.id, status: 'PENDING' }),
          })
          onDone()
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
      <div className="flex items-baseline justify-between gap-3 border-y border-border py-2.5">
        <span className="min-w-0 truncate">{bill.description}</span>
        <Money cents={bill.amountCents} size="lg" />
      </div>
      {isInvoice && bill.paidCents > 0 ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          Já pago: {formatBRL(bill.paidCents)} de {formatBRL(bill.totalCents)}
        </p>
      ) : null}

      <Field label="Pagar com" htmlFor="pay-account">
        <NativeSelect
          id="pay-account"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">Escolha a conta</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {formatBRL(account.balanceCents)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className={isInvoice ? 'grid grid-cols-2 gap-3' : ''}>
        <Field label={isInvoice ? 'Quanto pagar' : 'Data do pagamento'} htmlFor="pay-first">
          {isInvoice ? (
            <AmountInput id="pay-first" value={cents} onChange={setCents} />
          ) : (
            <Input
              id="pay-first"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          )}
        </Field>
        {isInvoice ? (
          <Field label="Data" htmlFor="pay-date">
            <Input
              id="pay-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        ) : null}
      </div>
      {isInvoice ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          Dá para pagar só uma parte: o que sobrar continua na fatura.
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? 'Pagando…' : `Pagar ${formatBRL(isInvoice ? (cents ?? 0) : bill.amountCents)}`}
        </Button>
      </div>
    </form>
  )
}
