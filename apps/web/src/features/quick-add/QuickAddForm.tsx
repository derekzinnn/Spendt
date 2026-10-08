import { zodResolver } from '@hookform/resolvers/zod'
import {
  formatBRL,
  isoDateSchema,
  MAX_INSTALLMENTS,
  NEUTRAL_PALETTE_KEY,
  PALETTE_KEYS,
  positiveCentsSchema,
  todayIso,
  type CategoryDto,
  type PaletteKey,
} from '@spendly/shared'
import { ArrowLeft, CalendarClock, CreditCard, Plus, Wallet, X } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { ROUTES } from '@/app/navigation'
import { CATEGORY_ICONS } from '@/components/category/category-icons'
import { AmountInput } from '@/components/money/AmountInput'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { useAccounts } from '@/features/accounts/api'
import { useHouseholdContext } from '@/features/auth/api'
import { useCards, useCreatePurchase, useDeletePurchase } from '@/features/cards/api'
import { announcePurchase, useInvoicePreview } from '@/features/cards/purchase-helpers'
import { useCategories, useCreateCategory } from '@/features/categories/api'
import { useCreateTransaction, useDeleteTransaction } from '@/features/transactions/api'
import { cn } from '@/lib/cn'
import { normalizeSearch } from '@/lib/search-text'
import { errorMessage } from '@/lib/form-errors'
import { undoToast } from '@/lib/undo-toast'

const quickAddSchema = z.object({
  type: z.enum(['EXPENSE', 'INCOME']),
  amountCents: positiveCentsSchema.nullable().refine((value) => value !== null, 'Digite o valor'),
  categoryId: z.string().min(1, 'Escolha a categoria'),
  accountId: z.string().min(1, 'Escolha a conta'),
  /** Who paid / received — information only: everything belongs to the couple. */
  paidById: z.string(),
  description: z.string().max(120),
  /** Card purchases only: the day it happened, and whether it is a credit back. */
  date: isoDateSchema,
  kind: z.enum(['PURCHASE', 'REFUND']),
})

type QuickAddValues = z.input<typeof quickAddSchema>

const VISIBLE_CATEGORIES = 8
/** Prefix of a card in the "Conta / cartão" choice (accounts use their plain id). */
const CARD = 'card:'
/** Step 1's two big targets: a framed card you can hit with a thumb. */
const bigPickClass =
  'flex cursor-pointer flex-col items-start gap-1 border border-border p-4 text-left transition-colors duration-150 hover:bg-foreground/7 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

/** The chips of quick add: hairline boxes; the chosen one takes a steel frame and wash. */
const pickClass = (selected: boolean) =>
  cn(
    'inline-flex min-h-(--control-h) cursor-pointer items-center gap-1.5 border px-2.5 text-[13px] transition-colors duration-150 [&_svg]:size-3.5 [&_svg]:shrink-0',
    selected
      ? 'border-steel bg-steel-100 text-steel-800'
      : 'border-border text-foreground hover:bg-foreground/7',
  )

/**
 * The five-second quick add: amount first, then category, account and who paid.
 * Uses the household's real categories, accounts, cards and members; card purchases can be
 * split in installments. Everything is saved for real, with "Desfazer".
 */
export function QuickAddForm({
  onDone,
  onClose,
  autoFocus = true,
}: {
  onDone?: () => void
  /** Shows the close button next to the type switch (the dialog passes it). */
  onClose?: () => void
  /** Focus the amount on mount (off when embedded in a page, so it doesn't steal focus). */
  autoFocus?: boolean
}) {
  const { member, members } = useHouseholdContext()
  const categoriesQuery = useCategories()
  const accountsQuery = useAccounts()
  const createCategory = useCreateCategory()
  const cardsQuery = useCards()
  const createPurchase = useCreatePurchase()
  const removePurchase = useDeletePurchase()
  const createTransaction = useCreateTransaction()
  const removeTransaction = useDeleteTransaction()
  const [query, setQuery] = useState('')
  const [installments, setInstallments] = useState(1)

  const form = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    mode: 'onChange',
    defaultValues: {
      type: 'EXPENSE',
      amountCents: null,
      categoryId: '',
      accountId: '',
      paidById: member.id,
      description: '',
      date: todayIso(),
      kind: 'PURCHASE',
    },
  })
  const { control, handleSubmit, setValue, reset } = form
  const [type, amountCents, categoryId, accountId, date, kind] = useWatch({
    control,
    name: ['type', 'amountCents', 'categoryId', 'accountId', 'date', 'kind'],
  })

  const active = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => !c.archivedAt && c.kind === type),
    [categoriesQuery.data, type],
  )
  const parentsById = useMemo(() => new Map(active.map((c) => [c.id, c])), [active])
  const accounts = (accountsQuery.data ?? []).filter((a) => !a.archivedAt)
  // Cards only take expenses (refunds live on the Cartões screen).
  const cards = type === 'EXPENSE' ? (cardsQuery.data ?? []).filter((c) => !c.archivedAt) : []
  const card = accountId.startsWith(CARD) ? cards.find((c) => CARD + c.id === accountId) : undefined
  const invoicePreview = useInvoicePreview(card, date)

  // On a card the money comes from the card, not from a person — ask who used it instead,
  // the same question the "Nova compra" sheet asks.
  const paidByLabel = card ? 'Quem usou o cartão' : type === 'INCOME' ? 'Recebido por' : 'Pago por'

  const term = normalizeSearch(query)
  const visible: CategoryDto[] = term
    ? active.filter((c) => normalizeSearch(c.name).includes(term)).slice(0, 12)
    : active.filter((c) => !c.parentId).slice(0, VISIBLE_CATEGORIES)
  const selected = active.find((c) => c.id === categoryId)
  if (selected && !visible.includes(selected)) visible.unshift(selected)

  const canCreate =
    term.length > 0 && !active.some((c) => !c.parentId && normalizeSearch(c.name) === term)

  const hint = !amountCents
    ? 'Digite o valor'
    : !categoryId
      ? 'Escolha a categoria'
      : !accountId
        ? type === 'INCOME'
          ? 'Escolha onde entrou'
          : 'Escolha a conta'
        : card && invoicePreview
          ? invoicePreview.label
          : 'Enter para salvar'
  const canSave = Boolean(amountCents && categoryId && accountId)

  // Integration rule 8: never leave the flow — offer "Criar 'X'" right here.
  function createInline() {
    const name = query.trim()
    const used = new Set(active.filter((c) => !c.parentId).map((c) => c.color))
    const color: PaletteKey =
      PALETTE_KEYS.find((key) => key !== NEUTRAL_PALETTE_KEY && !used.has(key)) ?? '500'
    createCategory.mutate(
      { name, kind: type, icon: 'ellipsis', color },
      {
        onSuccess: (category) => {
          setValue('categoryId', category.id, { shouldValidate: true })
          setQuery('')
          toast(`Categoria “${category.name}” criada`, {
            description: 'Ajuste ícone e tom depois em Categorias.',
          })
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  const submit = handleSubmit((values) => {
    if (card) {
      createPurchase.mutate(
        {
          creditCardId: card.id,
          kind: values.kind,
          description:
            values.description.trim() ||
            (active.find((c) => c.id === values.categoryId)?.name ?? 'Compra'),
          amountCents: values.amountCents ?? 0,
          date: values.date,
          categoryId: values.categoryId,
          installments,
          paidById: values.paidById || null,
        },
        {
          onSuccess: (result) => {
            announcePurchase(result, () => {
              const first = result.items[0]
              if (first) removePurchase.mutate({ id: first.id, scope: 'all' })
            })
            reset({ ...values, amountCents: null, categoryId: '', description: '' })
            setInstallments(1)
            onDone?.()
          },
          onError: (error) => toast.error(errorMessage(error)),
        },
      )
      return
    }
    const category = active.find((c) => c.id === values.categoryId)
    createTransaction.mutate(
      {
        type: values.type,
        amountCents: values.amountCents ?? 0,
        date: todayIso(),
        description: values.description.trim() || (category?.name ?? 'Lançamento'),
        categoryId: values.categoryId,
        accountId: values.accountId,
        paidById: values.paidById || null,
      },
      {
        onSuccess: (row) => {
          undoToast(`${formatBRL(row.amountCents)} · ${category?.name ?? row.description}`, {
            description: values.type === 'INCOME' ? 'Receita lançada' : 'Despesa lançada',
            onUndo: () => removeTransaction.mutate({ id: row.id }),
          })
          reset({ ...values, amountCents: null, categoryId: '', description: '' })
          onDone?.()
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  })

  /** Enter saves from the amount and description fields (when everything is filled). */
  function saveOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (canSave) void submit()
  }

  const [destination, setDestination] = useState<'card' | 'account' | null>(null)

  /** Step 1 picks the destination and preselects the first card/account of that kind. */
  function chooseDestination(next: 'card' | 'account') {
    setDestination(next)
    const first = next === 'card' ? cards[0] : accounts[0]
    if (first) setValue('accountId', next === 'card' ? CARD + first.id : first.id)
  }

  function back() {
    setDestination(null)
    setValue('accountId', '')
  }

  // Step 1 asks only where the money comes from, because that decides the rest of the form:
  // a card needs installments, a date and an invoice; an account needs none of it.
  if (!destination) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl">Onde foi?</h2>
          {onClose ? (
            <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
              <X />
            </Button>
          ) : null}
        </div>

        <div role="group" aria-label="Tipo de destino" className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => chooseDestination('card')}
            disabled={cards.length === 0}
            className={bigPickClass}
          >
            <CreditCard aria-hidden className="size-6 text-steel-700" />
            <span className="font-display text-lg">Cartão</span>
            <span className="text-xs text-muted-foreground">
              {cards.length === 0
                ? 'Nenhum cartão ainda'
                : 'Compra ou estorno, à vista ou parcelada'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => chooseDestination('account')}
            disabled={accounts.length === 0}
            className={bigPickClass}
          >
            <Wallet aria-hidden className="size-6 text-steel-700" />
            <span className="font-display text-lg">Conta</span>
            <span className="text-xs text-muted-foreground">
              {accounts.length === 0 ? 'Nenhuma conta ainda' : 'Corrente, reserva, carteira ou VR'}
            </span>
          </button>
        </div>

        {accounts.length === 0 && cards.length === 0 && !accountsQuery.isPending ? (
          <p className="border border-dashed border-border-strong p-3 text-[13px] text-muted-foreground">
            Nenhuma conta ou cartão ainda.{' '}
            <Link to={ROUTES.accounts} onClick={onDone} className="text-primary underline">
              Cadastrar conta
            </Link>
          </p>
        ) : null}
      </div>
    )
  }

  const onCard = destination === 'card'

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Voltar para a escolha do destino"
            onClick={back}
          >
            <ArrowLeft />
          </Button>
          <h2 className="text-xl">{onCard ? 'Nova compra no cartão' : 'Novo lançamento'}</h2>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
            <X />
          </Button>
        ) : null}
      </div>

      {onCard ? (
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Segmented
              aria-label="Tipo da operação no cartão"
              className="self-start"
              value={field.value}
              onValueChange={field.onChange}
              options={[
                { value: 'PURCHASE', label: 'Compra' },
                { value: 'REFUND', label: 'Estorno / crédito' },
              ]}
            />
          )}
        />
      ) : (
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Segmented
              aria-label="Tipo de lançamento"
              className="self-start"
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value)
                setValue('categoryId', '')
              }}
              options={[
                { value: 'EXPENSE', label: 'Despesa' },
                { value: 'INCOME', label: 'Receita' },
              ]}
            />
          )}
        />
      )}

      <Field label={onCard ? 'Cartão' : 'Conta'} htmlFor="qa-source">
        <NativeSelect
          id="qa-source"
          value={accountId}
          onChange={(event) => setValue('accountId', event.target.value, { shouldValidate: true })}
        >
          {onCard
            ? cards.map((c) => (
                <option key={c.id} value={CARD + c.id}>
                  {c.name}
                  {c.lastFour ? ` · ${c.lastFour}` : ''}
                </option>
              ))
            : accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
        </NativeSelect>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">
          {onCard ? 'Valor total' : type === 'INCOME' ? 'Valor recebido' : 'Valor'}
        </span>
        <Controller
          control={control}
          name="amountCents"
          render={({ field }) => (
            <AmountInput
              size="hero"
              autoFocus={autoFocus}
              aria-label="Valor"
              flow={type === 'INCOME' ? 'in' : 'out'}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              onKeyDown={saveOnEnter}
              name={field.name}
            />
          )}
        />
      </div>

      {onCard ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {kind === 'PURCHASE' ? (
              <Field label="Parcelas" htmlFor="qa-installments">
                <NativeSelect
                  id="qa-installments"
                  value={installments}
                  onChange={(event) => setInstallments(Number(event.target.value))}
                >
                  {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1
                        ? 'À vista'
                        : `${n}x${amountCents ? ` de ${formatBRL(Math.floor(amountCents / n))}` : ''}`}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field label="Data da compra" htmlFor="qa-date">
              <Input id="qa-date" type="date" {...control.register('date')} />
            </Field>
          </div>

          {invoicePreview ? (
            <p className="flex items-center gap-2 border-l-2 border-steel bg-steel-100 px-3 py-2 text-[13px] text-steel-800">
              <CalendarClock aria-hidden className="size-4 shrink-0" />
              <span>
                {invoicePreview.label}
                {kind === 'PURCHASE' && installments > 1
                  ? ` — as outras ${installments - 1} parcelas nas faturas seguintes`
                  : ''}
              </span>
            </p>
          ) : null}
        </>
      ) : null}

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Field label="Descrição" htmlFor="qa-description">
            <Input
              {...field}
              id="qa-description"
              onKeyDown={saveOnEnter}
              placeholder={onCard ? 'Ex.: Supermercado, Passagens' : 'Opcional'}
              autoComplete="off"
            />
          </Field>
        )}
      />

      <section aria-label="Categoria" className="flex flex-col gap-2">
        <Field label="Categoria" htmlFor="qa-category-search">
          <Input
            id="qa-category-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (canCreate) createInline()
              else if (visible.length === 1 && visible[0])
                setValue('categoryId', visible[0].id, { shouldValidate: true })
            }}
            placeholder="Buscar ou criar categoria"
            autoComplete="off"
          />
        </Field>
        <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-1.5">
          {visible.map((category) => {
            const isSelected = categoryId === category.id
            const parent = category.parentId ? parentsById.get(category.parentId) : undefined
            const Icon = CATEGORY_ICONS[category.icon]
            return (
              <button
                key={category.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setValue('categoryId', category.id, { shouldValidate: true })}
                className={pickClass(isSelected)}
              >
                <Icon aria-hidden />
                {parent ? `${parent.name} › ` : ''}
                {category.name}
              </button>
            )
          })}
          {canCreate ? (
            <button
              type="button"
              onClick={createInline}
              disabled={createCategory.isPending}
              className={pickClass(false)}
            >
              <Plus aria-hidden />
              Criar “{query.trim()}”
            </button>
          ) : null}
        </div>
      </section>

      {members.length > 1 ? (
        <Controller
          control={control}
          name="paidById"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{paidByLabel}</span>
              <Segmented
                fill
                aria-label={paidByLabel}
                value={field.value}
                onValueChange={field.onChange}
                options={members.map((m) => ({ value: m.id, label: m.displayName }))}
              />
            </div>
          )}
        />
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <span aria-live="polite" className="flex-1 text-xs text-muted-foreground">
          {hint}
        </span>
        <Button
          type="submit"
          size="lg"
          disabled={!canSave || createPurchase.isPending || createTransaction.isPending}
          className="px-5 text-[15px]"
        >
          {onCard ? 'Lançar compra' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
