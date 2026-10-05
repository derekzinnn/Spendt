import { zodResolver } from '@hookform/resolvers/zod'
import {
  firstDayOfMonth,
  currentMonthKey,
  isoDateSchema,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_FREQUENCIES,
  type RecurringRuleDto,
} from '@spendly/shared'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { AmountInput } from '@/components/money/AmountInput'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect, SwitchField } from '@/components/ui/form'
import { Input, Label } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useHouseholdContext } from '@/features/auth/api'
import { showFormError } from '@/lib/form-errors'
import { useIsDesktop } from '@/lib/use-media-query'

import { useCreateRecurringRule, useUpdateRecurringRule } from './api'
import { CategoryOptions } from './CategoryOptions'
import { useLookups } from './lookups'

const CARD = 'card:'

const formSchema = z.object({
  type: z.enum(['EXPENSE', 'INCOME']),
  description: z.string().trim().min(1, 'Descreva a recorrência').max(120),
  amountCents: z
    .int()
    .nullable()
    .refine((v) => v !== null && v > 0, 'Informe o valor'),
  categoryId: z.string(),
  source: z.string(),
  paidById: z.string(),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.coerce.number<string | number>().int().min(1).max(12),
  startDate: isoDateSchema,
  endDate: z.string(),
  autoConfirm: z.boolean(),
})
type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export function RecurringSheet({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: RecurringRuleDto | undefined
}) {
  const isDesktop = useIsDesktop()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        title={rule ? 'Editar recorrência' : 'Nova recorrência'}
        description="Aluguel, assinaturas, salário: lançados sozinhos todo mês."
      >
        <RecurringForm rule={rule} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function RecurringForm({
  rule,
  onDone,
}: {
  rule: RecurringRuleDto | undefined
  onDone: () => void
}) {
  const { member, members } = useHouseholdContext()
  const lookups = useLookups()
  const create = useCreateRecurringRule()
  const update = useUpdateRecurringRule()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: rule
      ? {
          type: rule.type,
          description: rule.description,
          amountCents: rule.amountCents,
          categoryId: rule.categoryId ?? '',
          source: rule.creditCardId ? CARD + rule.creditCardId : (rule.accountId ?? ''),
          paidById: rule.paidById ?? '',
          frequency: rule.frequency,
          interval: rule.interval,
          startDate: rule.startDate,
          endDate: rule.endDate ?? '',
          autoConfirm: rule.autoConfirm,
        }
      : {
          type: 'EXPENSE',
          description: '',
          amountCents: null,
          categoryId: '',
          source: '',
          paidById: member.id,
          frequency: 'MONTHLY',
          interval: 1,
          startDate: firstDayOfMonth(currentMonthKey()),
          endDate: '',
          autoConfirm: false,
        },
  })
  const { errors } = form.formState
  const [type, source] = useWatch({ control: form.control, name: ['type', 'source'] })
  const onCard = source.startsWith(CARD)

  const onSubmit = form.handleSubmit((values) => {
    const handlers = {
      onSuccess: () => {
        toast.success(rule ? 'Recorrência atualizada' : `“${values.description}” vai se repetir`)
        onDone()
      },
      onError: (error: Error) =>
        showFormError(error, form.setError, {
          fields: { accountId: 'source', creditCardId: 'source' },
        }),
    }
    const card = values.source.startsWith(CARD) ? values.source.slice(CARD.length) : null
    if (rule) {
      update.mutate(
        {
          id: rule.id,
          description: values.description,
          amountCents: values.amountCents ?? 0,
          categoryId: values.categoryId || null,
          ...(rule.creditCardId ? {} : { accountId: values.source || null }),
          paidById: values.paidById || null,
          endDate: values.endDate || null,
          autoConfirm: values.autoConfirm,
        },
        handlers,
      )
      return
    }
    create.mutate(
      {
        type: values.type,
        description: values.description,
        amountCents: values.amountCents ?? 0,
        categoryId: values.categoryId || null,
        accountId: card ? null : values.source || null,
        creditCardId: card,
        paidById: values.paidById || null,
        frequency: values.frequency,
        interval: values.interval,
        startDate: values.startDate,
        endDate: values.endDate || null,
        autoConfirm: values.autoConfirm,
      },
      handlers,
    )
  })

  const pending = create.isPending || update.isPending

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        {!rule ? (
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Segmented
                aria-label="Tipo"
                className="self-start"
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  form.setValue('categoryId', '')
                  if (value === 'INCOME' && form.getValues('source').startsWith(CARD))
                    form.setValue('source', '')
                }}
                options={[
                  { value: 'EXPENSE', label: 'Despesa' },
                  { value: 'INCOME', label: 'Receita' },
                ]}
              />
            )}
          />
        ) : null}

        <Field label="Descrição" htmlFor="rr-description" error={errors.description?.message}>
          <Input
            id="rr-description"
            autoComplete="off"
            placeholder="Ex.: Aluguel, Netflix, Salário"
            {...form.register('description')}
          />
        </Field>

        <Field label="Valor" htmlFor="rr-amount" error={errors.amountCents?.message}>
          <Controller
            control={form.control}
            name="amountCents"
            render={({ field }) => (
              <AmountInput
                id="rr-amount"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>

        <Field label="Categoria" htmlFor="rr-category" error={errors.categoryId?.message}>
          <NativeSelect id="rr-category" {...form.register('categoryId')}>
            <option value="">Sem categoria</option>
            <CategoryOptions categories={lookups.categories} kind={type} />
          </NativeSelect>
        </Field>

        <Field
          label={type === 'INCOME' ? 'Entra em' : 'Paga com'}
          htmlFor="rr-source"
          error={errors.source?.message}
          hint={
            onCard
              ? 'No cartão: a compra entra na fatura quando o dia chegar.'
              : 'Na conta: aparece em "Contas a pagar" até ser confirmada.'
          }
        >
          <NativeSelect
            id="rr-source"
            disabled={Boolean(rule?.creditCardId)}
            {...form.register('source')}
          >
            <option value="">Escolher na hora de pagar</option>
            {lookups.accounts
              .filter((a) => !a.archivedAt)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            {type === 'EXPENSE' && lookups.cards.some((c) => !c.archivedAt) ? (
              <optgroup label="Cartões">
                {lookups.cards
                  .filter((c) => !c.archivedAt)
                  .map((c) => (
                    <option key={c.id} value={CARD + c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
          </NativeSelect>
        </Field>

        {!rule ? (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Repete" htmlFor="rr-frequency">
              <NativeSelect id="rr-frequency" {...form.register('frequency')}>
                {RECURRENCE_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {RECURRENCE_FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="A cada" htmlFor="rr-interval">
              <NativeSelect id="rr-interval" className="w-24" {...form.register('interval')}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Primeira vez"
            htmlFor="rr-start"
            error={errors.startDate?.message}
            hint="O dia dela é o dia de todo mês."
          >
            <Input
              id="rr-start"
              type="date"
              disabled={Boolean(rule)}
              {...form.register('startDate')}
            />
          </Field>
          <Field
            label="Termina em"
            htmlFor="rr-end"
            error={errors.endDate?.message}
            hint="Opcional."
          >
            <Input id="rr-end" type="date" {...form.register('endDate')} />
          </Field>
        </div>

        {!onCard ? (
          <Controller
            control={form.control}
            name="autoConfirm"
            render={({ field }) => (
              <SwitchField
                checked={field.value}
                onCheckedChange={field.onChange}
                description={
                  'Para débito automático e salário: vira "pago" sem você precisar marcar.'
                }
              >
                Confirmar sozinho no dia
              </SwitchField>
            )}
          />
        ) : null}

        {members.length > 1 ? (
          <Controller
            control={form.control}
            name="paidById"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <Label>{type === 'INCOME' ? 'Recebido por' : 'Pago por'}</Label>
                <Segmented
                  fill
                  aria-label="Pago por"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={members.map((m) => ({ value: m.id, label: m.displayName }))}
                />
              </div>
            )}
          />
        ) : null}

        {rule ? (
          <p className="text-xs text-muted-foreground">
            Mudanças valem para as próximas ocorrências ainda não pagas; o que já foi pago fica como
            está.
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-border bg-background px-5 py-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? 'Salvando…' : rule ? 'Salvar alterações' : 'Criar recorrência'}
        </Button>
      </div>
    </form>
  )
}
