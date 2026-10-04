import { zodResolver } from '@hookform/resolvers/zod'
import {
  addDays,
  CARD_BRAND_LABELS,
  CARD_BRANDS,
  cardBrandSchema,
  cardNameSchema,
  NEUTRAL_PALETTE_KEY,
  PALETTE_KEYS,
  paletteKeySchema,
  resolveInvoiceCycle,
  todayIso,
  type CardDto,
  type PaletteKey,
} from '@spendly/shared'
import { Users } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { MemberAvatar } from '@/components/member/MemberAvatar'
import { AmountInput } from '@/components/money/AmountInput'
import { ColorPicker } from '@/components/pickers/ColorPicker'
import { Button } from '@/components/ui/button'
import { ChoiceChips, Field, NativeSelect } from '@/components/ui/form'
import { Input, Label } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useAccounts } from '@/features/accounts/api'
import { useHouseholdContext } from '@/features/auth/api'
import { showFormError } from '@/lib/form-errors'
import { useIsDesktop } from '@/lib/use-media-query'

import { useCreateCard, useUpdateCard } from './api'
import { dayMonth, monthTitle } from './card-meta'

const SHARED = 'shared'
const NONE = ''
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

const formSchema = z.object({
  name: cardNameSchema,
  brand: cardBrandSchema,
  color: paletteKeySchema,
  lastFour: z.string().regex(/^(\d{4})?$/, 'Use os 4 últimos números'),
  limitCents: z
    .int()
    .min(1, 'Informe o limite')
    .nullable()
    .refine((v) => v !== null, 'Informe o limite'),
  closingDay: z.coerce.number<string | number>().int().min(1).max(31),
  dueDay: z.coerce.number<string | number>().int().min(1).max(31),
  paymentAccountId: z.string(),
  holder: z.string(),
})
type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

function defaults(card: CardDto | undefined, usedColors: readonly PaletteKey[]): FormValues {
  if (card) {
    return {
      name: card.name,
      brand: card.brand,
      color: card.color,
      lastFour: card.lastFour ?? '',
      limitCents: card.limitCents,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      paymentAccountId: card.paymentAccountId ?? NONE,
      holder: card.holderId ?? SHARED,
    }
  }
  return {
    name: '',
    brand: 'MASTERCARD',
    color:
      PALETTE_KEYS.find((key) => key !== NEUTRAL_PALETTE_KEY && !usedColors.includes(key)) ?? '500',
    lastFour: '',
    limitCents: null,
    closingDay: 25,
    dueDay: 5,
    paymentAccountId: NONE,
    holder: SHARED,
  }
}

/** "Compras até 24/10 entram na fatura de novembro (vence 05/11)." */
function CyclePreview({ closingDay, dueDay }: { closingDay: number; dueDay: number }) {
  if (!closingDay || !dueDay) return null
  const cycle = resolveInvoiceCycle({ closingDay, dueDay }, todayIso())
  const best = Math.min(closingDay, 31)
  return (
    <p className="border-l-2 border-steel bg-steel-100 px-3 py-2 text-[13px] text-steel-800">
      Compras até{' '}
      <strong className="font-medium">{dayMonth(addDays(cycle.closingDate, -1))}</strong> entram na
      fatura de {monthTitle(cycle.referenceMonth.slice(0, 7)).toLowerCase()} (vence{' '}
      {dayMonth(cycle.dueDate)}). Melhor dia de compra: dia {best} — o que você comprar nele só
      vence no mês seguinte.
    </p>
  )
}

interface CardFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing this card; create mode when undefined. */
  card?: CardDto | undefined
  usedColors: readonly PaletteKey[]
}

export function CardFormSheet({ open, onOpenChange, card, usedColors }: CardFormSheetProps) {
  const isDesktop = useIsDesktop()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        title={card ? 'Editar cartão' : 'Novo cartão'}
        description="Limite, fechamento e vencimento: o resto a Casa calcula."
      >
        <CardForm card={card} usedColors={usedColors} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function CardForm({
  card,
  usedColors,
  onDone,
}: {
  card: CardDto | undefined
  usedColors: readonly PaletteKey[]
  onDone: () => void
}) {
  const { members } = useHouseholdContext()
  const accounts = (useAccounts().data ?? []).filter((a) => !a.archivedAt)
  const create = useCreateCard()
  const update = useUpdateCard()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults(card, usedColors),
  })
  const { errors } = form.formState
  const [closingDay, dueDay] = useWatch({ control: form.control, name: ['closingDay', 'dueDay'] })

  const onSubmit = form.handleSubmit((values) => {
    const input = {
      name: values.name,
      brand: values.brand,
      color: values.color,
      lastFour: values.lastFour || null,
      limitCents: values.limitCents ?? 0,
      closingDay: values.closingDay,
      dueDay: values.dueDay,
      paymentAccountId: values.paymentAccountId || null,
      holderId: values.holder === SHARED ? null : values.holder,
    }
    const options = {
      onSuccess: () => {
        toast.success(card ? 'Cartão atualizado' : `Cartão “${values.name}” criado`)
        onDone()
      },
      onError: (error: Error) =>
        showFormError(error, form.setError, { fields: { holderId: 'holder' } }),
    }
    if (card) update.mutate({ id: card.id, ...input }, options)
    else create.mutate(input, options)
  })

  const pending = create.isPending || update.isPending

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        <Field label="Nome" htmlFor="card-name" error={errors.name?.message}>
          <Input
            id="card-name"
            placeholder="Ex.: Nubank, Itaú Click"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...form.register('name')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bandeira" htmlFor="card-brand">
            <NativeSelect id="card-brand" {...form.register('brand')}>
              {CARD_BRANDS.map((brand) => (
                <option key={brand} value={brand}>
                  {CARD_BRAND_LABELS[brand]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="4 últimos números" htmlFor="card-four" error={errors.lastFour?.message}>
            <Input
              id="card-four"
              inputMode="numeric"
              maxLength={4}
              placeholder="opcional"
              autoComplete="off"
              aria-invalid={Boolean(errors.lastFour)}
              {...form.register('lastFour')}
            />
          </Field>
        </div>

        <Field label="Limite" htmlFor="card-limit" error={errors.limitCents?.message}>
          <Controller
            control={form.control}
            name="limitCents"
            render={({ field }) => (
              <AmountInput
                id="card-limit"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.limitCents)}
              />
            )}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha no dia" htmlFor="card-closing">
            <NativeSelect id="card-closing" {...form.register('closingDay')}>
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Vence no dia" htmlFor="card-due">
            <NativeSelect id="card-due" {...form.register('dueDay')}>
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <CyclePreview closingDay={Number(closingDay)} dueDay={Number(dueDay)} />
        {card ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            Mudar os dias vale para as próximas faturas; as que já existem mantêm as datas.
          </p>
        ) : null}

        <Field
          label="Paga pela conta"
          htmlFor="card-account"
          error={errors.paymentAccountId?.message}
          hint="A conta que costuma pagar a fatura (usada nos pagamentos, Fase 4)."
        >
          <NativeSelect id="card-account" {...form.register('paymentAccountId')}>
            <option value={NONE}>Escolher depois</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <div className="flex flex-col gap-2">
          <Label>Em nome de</Label>
          <Controller
            control={form.control}
            name="holder"
            render={({ field }) => (
              <ChoiceChips
                name="Titular"
                value={field.value}
                onChange={field.onChange}
                options={[
                  ...members.map((m) => ({
                    value: m.id,
                    label: m.isMe ? `${m.displayName} (você)` : m.displayName,
                    icon: (
                      <MemberAvatar
                        name={m.displayName}
                        color={m.color}
                        size="xs"
                        className="ring-0"
                      />
                    ),
                  })),
                  { value: SHARED, label: 'Da casa', icon: <Users /> },
                ]}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            Só informação: tudo que passa no cartão é da casa.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Tom</Label>
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
          />
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-border bg-background px-5 py-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? 'Salvando…' : card ? 'Salvar alterações' : 'Criar cartão'}
        </Button>
      </div>
    </form>
  )
}
