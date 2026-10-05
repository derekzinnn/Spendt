import { zodResolver } from '@hookform/resolvers/zod'
import { formatBRL, isoDateSchema, MAX_INSTALLMENTS, todayIso, type CardDto } from '@spendly/shared'
import { CalendarClock } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { AmountInput } from '@/components/money/AmountInput'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect } from '@/components/ui/form'
import { Input, Label } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useHouseholdContext } from '@/features/auth/api'
import { useCategories } from '@/features/categories/api'
import { showFormError } from '@/lib/form-errors'
import { useIsDesktop } from '@/lib/use-media-query'

import { useCreatePurchase, useDeletePurchase } from './api'
import { announcePurchase, useInvoicePreview } from './purchase-helpers'

const formSchema = z.object({
  creditCardId: z.string().min(1, 'Escolha o cartão'),
  kind: z.enum(['PURCHASE', 'REFUND']),
  amountCents: z
    .int()
    .nullable()
    .refine((v) => v !== null && v > 0, 'Informe o valor'),
  installments: z.coerce.number<string | number>().int().min(1).max(MAX_INSTALLMENTS),
  date: isoDateSchema,
  description: z.string().trim().min(1, 'Descreva a compra').max(120),
  categoryId: z.string(),
  paidById: z.string(),
})
type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

interface PurchaseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cards: CardDto[]
  /** Pre-selected card (the one on screen). */
  cardId?: string | undefined
}

export function PurchaseSheet({ open, onOpenChange, cards, cardId }: PurchaseSheetProps) {
  const isDesktop = useIsDesktop()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        title="Nova compra no cartão"
        description="À vista ou parcelada — cada parcela cai na fatura certa."
      >
        <PurchaseForm cards={cards} cardId={cardId} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function PurchaseForm({
  cards,
  cardId,
  onDone,
}: {
  cards: CardDto[]
  cardId: string | undefined
  onDone: () => void
}) {
  const { member, members } = useHouseholdContext()
  const categories = (useCategories().data ?? []).filter(
    (c) => !c.archivedAt && c.kind === 'EXPENSE',
  )
  const parents = categories.filter((c) => !c.parentId)
  const create = useCreatePurchase()
  const remove = useDeletePurchase()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      creditCardId: cardId ?? cards[0]?.id ?? '',
      kind: 'PURCHASE',
      amountCents: null,
      installments: 1,
      date: todayIso(),
      description: '',
      categoryId: '',
      paidById: member.id,
    },
  })
  const { errors } = form.formState
  const [selectedCardId, kind, amount, installments, date] = useWatch({
    control: form.control,
    name: ['creditCardId', 'kind', 'amountCents', 'installments', 'date'],
  })
  const card = cards.find((c) => c.id === selectedCardId)
  const preview = useInvoicePreview(card, date || undefined)
  const count = Number(installments) || 1

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      {
        creditCardId: values.creditCardId,
        kind: values.kind,
        amountCents: values.amountCents ?? 0,
        installments: values.kind === 'REFUND' ? 1 : values.installments,
        date: values.date,
        description: values.description,
        categoryId: values.categoryId || null,
        paidById: values.paidById || null,
      },
      {
        onSuccess: (result) => {
          announcePurchase(result, () => {
            const first = result.items[0]
            if (first) remove.mutate({ id: first.id, scope: 'all' })
          })
          onDone()
        },
        onError: (error) => showFormError(error, form.setError),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <Segmented
              aria-label="Tipo"
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

        <Field label="Cartão" htmlFor="purchase-card" error={errors.creditCardId?.message}>
          <NativeSelect id="purchase-card" {...form.register('creditCardId')}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.lastFour ? ` · ${c.lastFour}` : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Controller
          control={form.control}
          name="amountCents"
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1">
              <Label htmlFor="purchase-amount">
                {kind === 'REFUND' ? 'Valor do estorno' : 'Valor total'}
              </Label>
              <AmountInput
                id="purchase-amount"
                size="hero"
                flow={kind === 'REFUND' ? 'in' : 'out'}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(fieldState.error)}
              />
              {fieldState.error ? (
                <p className="text-xs font-medium">{fieldState.error.message}</p>
              ) : null}
            </div>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          {kind === 'PURCHASE' ? (
            <Field label="Parcelas" htmlFor="purchase-installments">
              <NativeSelect id="purchase-installments" {...form.register('installments')}>
                {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'À vista' : `${n}x`}
                    {n > 1 && amount ? ` de ${formatBRL(Math.floor(amount / n))}` : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Data da compra" htmlFor="purchase-date" error={errors.date?.message}>
            <Input id="purchase-date" type="date" {...form.register('date')} />
          </Field>
        </div>

        {preview ? (
          <p className="flex items-center gap-2 border-l-2 border-steel bg-steel-100 px-3 py-2 text-[13px] text-steel-800">
            <CalendarClock className="size-4 shrink-0" />
            <span>
              {preview.label}
              {kind === 'PURCHASE' && count > 1
                ? ` — as outras ${count - 1} parcelas nas faturas seguintes`
                : ''}
            </span>
          </p>
        ) : null}

        <Field label="Descrição" htmlFor="purchase-description" error={errors.description?.message}>
          <Input
            id="purchase-description"
            placeholder="Ex.: Supermercado, Passagens"
            autoComplete="off"
            aria-invalid={Boolean(errors.description)}
            {...form.register('description')}
          />
        </Field>

        <Field label="Categoria" htmlFor="purchase-category" error={errors.categoryId?.message}>
          <NativeSelect id="purchase-category" {...form.register('categoryId')}>
            <option value="">Sem categoria</option>
            {parents.map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                <option value={parent.id}>{parent.name}</option>
                {categories
                  .filter((c) => c.parentId === parent.id)
                  .map((child) => (
                    <option key={child.id} value={child.id}>
                      {parent.name} › {child.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>

        {members.length > 1 ? (
          <Controller
            control={form.control}
            name="paidById"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <Label>Quem usou o cartão</Label>
                <Segmented
                  fill
                  aria-label="Quem usou o cartão"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={members.map((m) => ({ value: m.id, label: m.displayName }))}
                />
              </div>
            )}
          />
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-border bg-background px-5 py-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={create.isPending || cards.length === 0}>
          {create.isPending
            ? 'Lançando…'
            : kind === 'REFUND'
              ? 'Lançar estorno'
              : count > 1
                ? `Lançar em ${count}x`
                : 'Lançar compra'}
        </Button>
      </div>
    </form>
  )
}
