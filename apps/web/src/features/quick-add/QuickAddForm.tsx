import { zodResolver } from '@hookform/resolvers/zod'
import {
  formatBRL,
  MAX_INSTALLMENTS,
  NEUTRAL_PALETTE_KEY,
  PALETTE_KEYS,
  positiveCentsSchema,
  todayIso,
  type CategoryDto,
  type PaletteKey,
} from '@spendly/shared'
import { CreditCard, Plus, X } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { ROUTES } from '@/app/navigation'
import { CATEGORY_ICONS } from '@/components/category/category-icons'
import { AmountInput } from '@/components/money/AmountInput'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { useAccounts } from '@/features/accounts/api'
import { useHouseholdContext } from '@/features/auth/api'
import { useCards, useCreatePurchase, useDeletePurchase } from '@/features/cards/api'
import { announcePurchase, useInvoicePreview } from '@/features/cards/purchase-helpers'
import { useCategories, useCreateCategory } from '@/features/categories/api'
import { cn } from '@/lib/cn'

const quickAddSchema = z.object({
  type: z.enum(['EXPENSE', 'INCOME']),
  amountCents: positiveCentsSchema.nullable().refine((value) => value !== null, 'Digite o valor'),
  categoryId: z.string().min(1, 'Escolha a categoria'),
  accountId: z.string().min(1, 'Escolha a conta'),
  /** Who paid / received — information only: everything belongs to the couple. */
  paidById: z.string(),
  description: z.string().max(120),
})

type QuickAddValues = z.input<typeof quickAddSchema>

const VISIBLE_CATEGORIES = 8
/** Prefix of a card in the "Conta / cartão" choice (accounts use their plain id). */
const CARD = 'card:'
const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR')

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
 * Uses the household's real categories, accounts, cards and members. Card purchases are saved
 * for real (with installments); account entries are a preview until Phase 3.
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
    },
  })
  const { control, handleSubmit, setValue, reset } = form
  const [type, amountCents, categoryId, accountId] = useWatch({
    control,
    name: ['type', 'amountCents', 'categoryId', 'accountId'],
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
  const invoicePreview = useInvoicePreview(card, todayIso())

  const term = normalize(query)
  const visible: CategoryDto[] = term
    ? active.filter((c) => normalize(c.name).includes(term)).slice(0, 12)
    : active.filter((c) => !c.parentId).slice(0, VISIBLE_CATEGORIES)
  const selected = active.find((c) => c.id === categoryId)
  if (selected && !visible.includes(selected)) visible.unshift(selected)

  const canCreate =
    term.length > 0 && !active.some((c) => !c.parentId && normalize(c.name) === term)

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
        onError: (error) => toast.error(error.message),
      },
    )
  }

  const submit = handleSubmit((values) => {
    if (card) {
      createPurchase.mutate(
        {
          creditCardId: card.id,
          kind: 'PURCHASE',
          description:
            values.description.trim() ||
            (active.find((c) => c.id === values.categoryId)?.name ?? 'Compra'),
          amountCents: values.amountCents ?? 0,
          date: todayIso(),
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
          onError: (error) => toast.error(error.message),
        },
      )
      return
    }
    const category = active.find((c) => c.id === values.categoryId)
    toast(`Lançamento salvo · ${formatBRL(values.amountCents ?? 0)}`, {
      description: `${category?.name ?? '—'} · prévia: lançamentos em conta chegam na Fase 3`,
      action: { label: 'Desfazer', onClick: () => toast('Lançamento desfeito') },
    })
    reset({ ...values, amountCents: null, categoryId: '', description: '' })
    onDone?.()
  })

  /** Enter saves from the amount and description fields (when everything is filled). */
  function saveOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (canSave) void submit()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-3">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Segmented
              aria-label="Tipo de lançamento"
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value)
                setValue('categoryId', '')
                // Cards take expenses only: drop a chosen card when switching to income.
                if (value === 'INCOME' && form.getValues('accountId').startsWith(CARD))
                  setValue('accountId', '')
              }}
              options={[
                { value: 'EXPENSE', label: 'Despesa' },
                { value: 'INCOME', label: 'Receita' },
              ]}
            />
          )}
        />
        {onClose ? (
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
            <X />
          </Button>
        ) : null}
      </div>

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

      <section aria-label="Categoria" className="flex flex-col gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (canCreate) createInline()
            else if (visible.length === 1 && visible[0])
              setValue('categoryId', visible[0].id, { shouldValidate: true })
          }}
          placeholder="Categoria — buscar ou criar"
          aria-label="Buscar ou criar categoria"
        />
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
                {parent ? <span className="text-muted-foreground">{parent.name} ›</span> : null}
                {category.name}
              </button>
            )
          })}
          {canCreate ? (
            <button
              type="button"
              onClick={createInline}
              disabled={createCategory.isPending}
              className="inline-flex min-h-(--control-h) cursor-pointer items-center gap-1.5 border border-dashed border-steel px-2.5 text-[13px] text-steel-700 transition-colors hover:bg-steel-100 disabled:opacity-45 [&_svg]:size-3.5"
            >
              <Plus aria-hidden />
              Criar “{query.trim()}”
            </button>
          ) : null}
          {categoriesQuery.isPending ? (
            <p className="text-[13px] text-muted-foreground">Carregando categorias…</p>
          ) : visible.length === 0 && !canCreate ? (
            <p className="text-[13px] text-muted-foreground">Nenhuma categoria encontrada.</p>
          ) : null}
        </div>
      </section>

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Input
            {...field}
            onKeyDown={saveOnEnter}
            placeholder="Descrição (opcional)"
            aria-label="Descrição"
            autoComplete="off"
          />
        )}
      />

      <Controller
        control={control}
        name="accountId"
        render={({ field }) => (
          <section aria-labelledby="qa-account" className="flex flex-col gap-1.5">
            <span id="qa-account" className="text-xs text-muted-foreground">
              {type === 'INCOME' ? 'Onde entrou' : 'Conta / cartão'}
            </span>
            {accounts.length === 0 && cards.length === 0 && !accountsQuery.isPending ? (
              <p className="border border-dashed border-border-strong p-3 text-[13px] text-muted-foreground">
                Nenhuma conta ainda.{' '}
                <Link to={ROUTES.accounts} onClick={onDone} className="text-primary underline">
                  Cadastrar conta
                </Link>{' '}
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="qa-account"
                className="flex flex-wrap gap-1.5"
              >
                {cards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={field.value === CARD + c.id}
                    onClick={() => field.onChange(CARD + c.id)}
                    className={pickClass(field.value === CARD + c.id)}
                  >
                    <CreditCard aria-hidden />
                    {c.name}
                  </button>
                ))}
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    role="radio"
                    aria-checked={field.value === account.id}
                    onClick={() => field.onChange(account.id)}
                    className={pickClass(field.value === account.id)}
                  >
                    {account.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      />

      {card ? (
        <div className="flex items-center gap-3">
          <label htmlFor="qa-installments" className="text-xs text-muted-foreground">
            Parcelas
          </label>
          <NativeSelect
            id="qa-installments"
            value={installments}
            onChange={(event) => setInstallments(Number(event.target.value))}
            className="w-40"
          >
            {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1
                  ? 'À vista'
                  : `${n}x${amountCents ? ` de ${formatBRL(Math.floor(amountCents / n))}` : ''}`}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {members.length > 1 ? (
        <Controller
          control={control}
          name="paidById"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {type === 'INCOME' ? 'Recebido por' : 'Pago por'}
              </span>
              <Segmented
                fill
                aria-label={type === 'INCOME' ? 'Recebido por' : 'Pago por'}
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
          disabled={!canSave || createPurchase.isPending}
          className="px-5 text-[15px]"
        >
          Salvar
        </Button>
      </div>
    </form>
  )
}
