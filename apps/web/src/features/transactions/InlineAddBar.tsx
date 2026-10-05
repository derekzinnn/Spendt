import { currentMonthKey, firstDayOfMonth, todayIso, type MonthKey } from '@spendly/shared'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { AmountInput } from '@/components/money/AmountInput'
import { useCreatePurchase, useDeletePurchase } from '@/features/cards/api'
import { announcePurchase } from '@/features/cards/purchase-helpers'
import { errorMessage } from '@/lib/form-errors'
import { undoToast } from '@/lib/undo-toast'

import { useCreateTransaction, useDeleteTransaction } from './api'
import { CategoryOptions } from './CategoryOptions'
import type { Lookups } from './lookups'

const CARD = 'card:'
const fieldClass = 'flex flex-col px-3 py-2 not-last:border-r not-last:border-border'
const bareInput =
  'w-full bg-transparent py-0.5 text-[15px] text-foreground outline-none placeholder:text-subtle-foreground'

/**
 * The spreadsheet's "next row": description, value, category, account or card — Enter adds.
 * The category decides expense vs income; dated today (or the 1st of the month on screen).
 */
export function InlineAddBar({ month, lookups }: { month: MonthKey; lookups: Lookups }) {
  const [description, setDescription] = useState('')
  const [cents, setCents] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [chosenSource, setSource] = useState('')
  const descriptionRef = useRef<HTMLInputElement>(null)
  const create = useCreateTransaction()
  const remove = useDeleteTransaction()
  const createPurchase = useCreatePurchase()
  const removePurchase = useDeletePurchase()

  const category = lookups.category(categoryId || null)
  const type = category?.kind === 'INCOME' ? 'INCOME' : 'EXPENSE'
  const date = month === currentMonthKey() ? todayIso() : firstDayOfMonth(month)
  const accounts = lookups.accounts.filter((a) => !a.archivedAt)
  // Accounts load after mount: until something is chosen, default to the first one.
  const source = chosenSource || accounts[0]?.id || ''
  const cards = lookups.cards.filter((c) => !c.archivedAt)

  function reset() {
    setDescription('')
    setCents(null)
    descriptionRef.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!cents) return toast('Informe o valor')
    const text = description.trim() || category?.name || 'Lançamento'
    if (source.startsWith(CARD)) {
      if (type === 'INCOME') return toast.error('Receitas entram em uma conta, não no cartão.')
      createPurchase.mutate(
        {
          creditCardId: source.slice(CARD.length),
          description: text,
          amountCents: cents,
          date,
          categoryId: categoryId || null,
        },
        {
          onSuccess: (result) => {
            announcePurchase(result, () => {
              const first = result.items[0]
              if (first) removePurchase.mutate({ id: first.id, scope: 'all' })
            })
            reset()
          },
          onError: (error) => toast.error(errorMessage(error)),
        },
      )
      return
    }
    create.mutate(
      {
        type,
        amountCents: cents,
        date,
        description: text,
        categoryId: categoryId || null,
        accountId: source || null,
      },
      {
        onSuccess: (row) => {
          undoToast(`“${row.description}” adicionado`, {
            onUndo: () => remove.mutate({ id: row.id }),
          })
          reset()
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Adicionar lançamento"
      className="blueprint grid grid-cols-[minmax(10rem,2fr)_minmax(8rem,1fr)_minmax(10rem,1.4fr)_minmax(9rem,1.2fr)_auto] border border-border"
    >
      <label className={fieldClass}>
        <span className="text-[11px] text-muted-foreground">Descrição</span>
        <input
          ref={descriptionRef}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ex.: Padaria"
          className={bareInput}
        />
      </label>
      <label className={fieldClass}>
        <span className="text-[11px] text-muted-foreground">Valor</span>
        <AmountInput
          value={cents}
          onChange={setCents}
          aria-label="Valor"
          className="h-auto border-0 bg-transparent px-0"
          flow={type === 'INCOME' ? 'in' : 'out'}
        />
      </label>
      <label className={fieldClass}>
        <span className="text-[11px] text-muted-foreground">Categoria</span>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={bareInput}
        >
          <option value="">Sem categoria</option>
          <CategoryOptions categories={lookups.categories} kind="EXPENSE" />
          <option disabled>──────────</option>
          <CategoryOptions categories={lookups.categories} kind="INCOME" />
        </select>
      </label>
      <label className={fieldClass}>
        <span className="text-[11px] text-muted-foreground">Conta / cartão</span>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className={bareInput}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          {cards.length > 0 ? (
            <optgroup label="Cartões">
              {cards.map((c) => (
                <option key={c.id} value={CARD + c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
      <button
        type="submit"
        disabled={create.isPending || createPurchase.isPending}
        className="min-h-13 cursor-pointer bg-primary px-5 font-display text-[15px] text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-45"
      >
        Adicionar ↵
      </button>
    </form>
  )
}
