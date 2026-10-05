import { zodResolver } from '@hookform/resolvers/zod'
import {
  ACCOUNT_TYPES,
  accountNameSchema,
  accountTypeSchema,
  isoDateSchema,
  NEUTRAL_PALETTE_KEY,
  PALETTE_KEYS,
  paletteKeySchema,
  todayIso,
  type AccountDto,
  type PaletteKey,
} from '@spendly/shared'
import { Users } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { MemberAvatar } from '@/components/member/MemberAvatar'
import { AmountInput } from '@/components/money/AmountInput'
import { ColorPicker } from '@/components/pickers/ColorPicker'
import { Button } from '@/components/ui/button'
import { ChoiceChips, Field, SwitchField } from '@/components/ui/form'
import { Input, Label } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useHouseholdContext } from '@/features/auth/api'
import { showFormError } from '@/lib/form-errors'
import { useIsDesktop } from '@/lib/use-media-query'

import { ACCOUNT_TYPE_META } from './account-meta'
import { useCreateAccount, useUpdateAccount } from './api'

const JOINT = 'joint'

const formSchema = z.object({
  name: accountNameSchema,
  type: accountTypeSchema,
  color: paletteKeySchema,
  holder: z.string(),
  amountCents: z.int().min(0).nullable(),
  negative: z.boolean(),
  initialBalanceDate: isoDateSchema,
})
type FormValues = z.infer<typeof formSchema>

interface AccountFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing this account; create mode when undefined. */
  account?: AccountDto | undefined
  /** Colours already used by other accounts, to suggest a fresh one. */
  usedColors: readonly PaletteKey[]
}

function defaults(account: AccountDto | undefined, usedColors: readonly PaletteKey[]): FormValues {
  if (account) {
    return {
      name: account.name,
      type: account.type,
      color: account.color,
      holder: account.holderId ?? JOINT,
      amountCents: Math.abs(account.initialBalanceCents),
      negative: account.initialBalanceCents < 0,
      initialBalanceDate: account.initialBalanceDate,
    }
  }
  return {
    name: '',
    type: 'CHECKING',
    color:
      PALETTE_KEYS.find((key) => key !== NEUTRAL_PALETTE_KEY && !usedColors.includes(key)) ?? '500',
    holder: JOINT,
    amountCents: null,
    negative: false,
    initialBalanceDate: todayIso(),
  }
}

export function AccountFormSheet({
  open,
  onOpenChange,
  account,
  usedColors,
}: AccountFormSheetProps) {
  const isDesktop = useIsDesktop()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        title={account ? 'Editar conta' : 'Nova conta'}
        description="Contas correntes, reservas, dinheiro e vale-refeição."
      >
        {/* Sheet content unmounts when closed, so every opening starts a fresh form. */}
        <AccountForm account={account} usedColors={usedColors} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function AccountForm({
  account,
  usedColors,
  onDone,
}: {
  account: AccountDto | undefined
  usedColors: readonly PaletteKey[]
  onDone: () => void
}) {
  const { members } = useHouseholdContext()
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults(account, usedColors),
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    const input = {
      name: values.name,
      type: values.type,
      color: values.color,
      holderId: values.holder === JOINT ? null : values.holder,
      initialBalanceCents: (values.amountCents ?? 0) * (values.negative ? -1 : 1),
      initialBalanceDate: values.initialBalanceDate,
    }
    const options = {
      onSuccess: () => {
        toast.success(account ? 'Conta atualizada' : `Conta “${values.name}” criada`)
        onDone()
      },
      onError: (error: Error) =>
        showFormError(error, form.setError, {
          fields: { holderId: 'holder', initialBalanceCents: 'amountCents' },
        }),
    }
    if (account) update.mutate({ id: account.id, ...input }, options)
    else create.mutate(input, options)
  })

  const pending = create.isPending || update.isPending

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        <Field label="Nome" htmlFor="account-name" error={errors.name?.message}>
          <Input
            id="account-name"
            placeholder="Ex.: Nubank, Conta da casa"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...form.register('name')}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <Label>Tipo</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <ChoiceChips
                name="Tipo de conta"
                value={field.value}
                onChange={field.onChange}
                options={ACCOUNT_TYPES.map((type) => {
                  const Icon = ACCOUNT_TYPE_META[type].icon
                  return { value: type, label: ACCOUNT_TYPE_META[type].short, icon: <Icon /> }
                })}
              />
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>De quem é</Label>
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
                  { value: JOINT, label: 'Conjunta', icon: <Users /> },
                ]}
              />
            )}
          />
          {errors.holder ? <p className="text-xs">{errors.holder.message}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Tom</Label>
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
          />
        </div>

        <fieldset className="flex flex-col gap-3 border border-border p-4">
          <legend className="kicker px-1 text-muted-foreground">Saldo de partida</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Saldo" htmlFor="account-balance" error={errors.amountCents?.message}>
              <Controller
                control={form.control}
                name="amountCents"
                render={({ field }) => (
                  <AmountInput
                    id="account-balance"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Field>
            <Field label="Em" htmlFor="account-date" error={errors.initialBalanceDate?.message}>
              <Input id="account-date" type="date" {...form.register('initialBalanceDate')} />
            </Field>
          </div>
          <Controller
            control={form.control}
            name="negative"
            render={({ field }) => (
              <SwitchField
                checked={field.value}
                onCheckedChange={field.onChange}
                className="text-[13px]"
              >
                Saldo negativo (cheque especial)
              </SwitchField>
            )}
          />
          <p className="text-xs text-pretty text-muted-foreground">
            Daqui em diante o saldo é calculado sozinho a partir dos lançamentos pagos — você nunca
            precisa digitá-lo de novo.
          </p>
        </fieldset>
      </div>

      <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-border bg-background px-5 py-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? 'Salvando…' : account ? 'Salvar alterações' : 'Criar conta'}
        </Button>
      </div>
    </form>
  )
}
