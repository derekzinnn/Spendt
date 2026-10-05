import { zodResolver } from '@hookform/resolvers/zod'
import { isoDateSchema, todayIso, type TransactionDto } from '@spendly/shared'
import { CreditCard } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { AmountInput } from '@/components/money/AmountInput'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect, Switch } from '@/components/ui/form'
import { Input, Label } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useHouseholdContext } from '@/features/auth/api'
import { showFormError } from '@/lib/form-errors'
import { undoToast } from '@/lib/undo-toast'
import { useIsDesktop } from '@/lib/use-media-query'

import {
  useCreateTransaction,
  useDeleteTransaction,
  useRestoreTransactions,
  useUpdateTransaction,
} from './api'
import { CategoryOptions } from './CategoryOptions'
import { useLookups } from './lookups'

const formSchema = z.object({
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  pending: z.boolean(),
  amountCents: z
    .int()
    .nullable()
    .refine((v) => v !== null && v > 0, 'Informe o valor'),
  date: isoDateSchema,
  dueDate: z.string(),
  description: z.string().trim().min(1, 'Descreva o lançamento').max(120),
  categoryId: z.string(),
  accountId: z.string(),
  toAccountId: z.string(),
  paidById: z.string(),
  notes: z.string().max(500),
})
type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface TransactionSheetState {
  open: boolean
  /** Editing this row; create mode when undefined. */
  transaction?: TransactionDto | undefined
  /** Create mode: start as this type. */
  type?: 'EXPENSE' | 'INCOME' | 'TRANSFER'
}

export function TransactionSheet({
  state,
  onOpenChange,
}: {
  state: TransactionSheetState
  onOpenChange: (open: boolean) => void
}) {
  const isDesktop = useIsDesktop()
  const editing = state.transaction
  return (
    <Sheet open={state.open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        title={editing ? 'Editar lançamento' : 'Novo lançamento'}
        description={
          editing ? undefined : 'Despesa, receita, transferência ou uma conta para pagar depois.'
        }
      >
        <TransactionForm
          transaction={editing}
          initialType={state.type ?? 'EXPENSE'}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

function TransactionForm({
  transaction,
  initialType,
  onDone,
}: {
  transaction: TransactionDto | undefined
  initialType: 'EXPENSE' | 'INCOME' | 'TRANSFER'
  onDone: () => void
}) {
  const { member, members } = useHouseholdContext()
  const lookups = useLookups()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()
  const restore = useRestoreTransactions()
  const cardRow = Boolean(transaction?.creditCardId)
  const accounts = lookups.accounts.filter(
    (a) => !a.archivedAt || a.id === transaction?.accountId || a.id === transaction?.toAccountId,
  )

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: transaction
      ? {
          type: transaction.type,
          pending: transaction.status === 'PENDING',
          amountCents: transaction.amountCents,
          date: transaction.date,
          dueDate: transaction.dueDate ?? '',
          description: transaction.description,
          categoryId: transaction.categoryId ?? '',
          accountId: transaction.accountId ?? '',
          toAccountId: transaction.toAccountId ?? '',
          paidById: transaction.paidById ?? '',
          notes: transaction.notes ?? '',
        }
      : {
          type: initialType,
          pending: false,
          amountCents: null,
          date: todayIso(),
          dueDate: '',
          description: '',
          categoryId: '',
          accountId: accounts[0]?.id ?? '',
          toAccountId: '',
          paidById: member.id,
          notes: '',
        },
  })
  const { errors } = form.formState
  const [type, pending] = useWatch({ control: form.control, name: ['type', 'pending'] })
  const pending_ = Boolean(pending)

  const onSubmit = form.handleSubmit((values) => {
    const common = {
      description: values.description,
      notes: values.notes || null,
      paidById: values.paidById || null,
    }
    const handlers = {
      onSuccess: () => {
        toast.success(transaction ? 'Lançamento atualizado' : 'Lançamento salvo')
        onDone()
      },
      onError: (error: Error) => showFormError(error, form.setError),
    }
    if (transaction && cardRow) {
      update.mutate(
        { id: transaction.id, ...common, categoryId: values.categoryId || null },
        handlers,
      )
      return
    }
    const money = {
      ...common,
      amountCents: values.amountCents ?? 0,
      date: values.date,
      dueDate: values.pending ? values.dueDate || values.date : values.dueDate || null,
      status: values.pending ? ('PENDING' as const) : ('PAID' as const),
      categoryId: values.type === 'TRANSFER' ? null : values.categoryId || null,
      accountId: values.accountId || null,
      toAccountId: values.type === 'TRANSFER' ? values.toAccountId || null : null,
    }
    if (transaction) update.mutate({ id: transaction.id, ...money }, handlers)
    else create.mutate({ type: values.type, ...money }, handlers)
  })

  const pendingMutation = create.isPending || update.isPending
  const card = lookups.card(transaction?.creditCardId ?? null)

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        {cardRow ? (
          <p className="flex items-start gap-2 border-l-2 border-steel bg-steel-100 px-3 py-2 text-[13px] text-steel-800">
            <CreditCard className="mt-0.5 size-4 shrink-0" />
            Compra no {card?.name ?? 'cartão'}: valor e data ficam na fatura. Para mudar, exclua e
            lance de novo.
          </p>
        ) : null}

        {!transaction ? (
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
                }}
                options={[
                  { value: 'EXPENSE', label: 'Despesa' },
                  { value: 'INCOME', label: 'Receita' },
                  { value: 'TRANSFER', label: 'Transferência' },
                ]}
              />
            )}
          />
        ) : null}

        {!cardRow ? (
          <>
            <Controller
              control={form.control}
              name="amountCents"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="tx-amount">Valor</Label>
                  <AmountInput
                    id="tx-amount"
                    size="hero"
                    flow={type === 'INCOME' ? 'in' : 'out'}
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

            {type !== 'TRANSFER' ? (
              <Controller
                control={form.control}
                name="pending"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    {type === 'INCOME' ? 'Ainda vou receber' : 'Ainda vou pagar (conta a pagar)'}
                  </label>
                )}
              />
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" htmlFor="tx-date" error={errors.date?.message}>
                <Input id="tx-date" type="date" {...form.register('date')} />
              </Field>
              {pending_ ? (
                <Field label="Vencimento" htmlFor="tx-due" error={errors.dueDate?.message}>
                  <Input id="tx-due" type="date" {...form.register('dueDate')} />
                </Field>
              ) : null}
            </div>
          </>
        ) : null}

        <Field label="Descrição" htmlFor="tx-description" error={errors.description?.message}>
          <Input
            id="tx-description"
            autoComplete="off"
            placeholder="Ex.: Feira, Salário, Guardar na reserva"
            aria-invalid={Boolean(errors.description)}
            {...form.register('description')}
          />
        </Field>

        {type !== 'TRANSFER' ? (
          <Field label="Categoria" htmlFor="tx-category" error={errors.categoryId?.message}>
            <NativeSelect id="tx-category" {...form.register('categoryId')}>
              <option value="">Sem categoria</option>
              <CategoryOptions
                categories={lookups.categories}
                kind={type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
              />
            </NativeSelect>
          </Field>
        ) : null}

        {!cardRow ? (
          <div className={type === 'TRANSFER' ? 'grid grid-cols-2 gap-3' : ''}>
            <Field
              label={type === 'TRANSFER' ? 'De' : type === 'INCOME' ? 'Entrou em' : 'Saiu de'}
              htmlFor="tx-account"
              error={errors.accountId?.message}
              {...(pending_ ? { hint: 'Pode escolher na hora de pagar.' } : {})}
            >
              <NativeSelect id="tx-account" {...form.register('accountId')}>
                {pending_ ? <option value="">Escolher depois</option> : null}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {type === 'TRANSFER' ? (
              <Field label="Para" htmlFor="tx-to" error={errors.toAccountId?.message}>
                <NativeSelect id="tx-to" {...form.register('toAccountId')}>
                  <option value="">Escolha</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
          </div>
        ) : null}

        {members.length > 1 && type !== 'TRANSFER' ? (
          <Controller
            control={form.control}
            name="paidById"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <Label>{type === 'INCOME' ? 'Recebido por' : 'Pago por'}</Label>
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

        <Field label="Observação" htmlFor="tx-notes">
          <Input
            id="tx-notes"
            autoComplete="off"
            placeholder="opcional"
            {...form.register('notes')}
          />
        </Field>
      </div>

      <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-border bg-background px-5 py-3">
        {transaction ? (
          <Button
            type="button"
            variant="quiet"
            onClick={() =>
              remove.mutate(
                { id: transaction.id, scope: 'one' },
                {
                  onSuccess: ({ ids }) => {
                    undoToast(`“${transaction.description}” excluído`, {
                      onUndo: () => restore.mutate(ids),
                    })
                    onDone()
                  },
                },
              )
            }
          >
            Excluir
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={pendingMutation}>
          {pendingMutation ? 'Salvando…' : transaction ? 'Salvar alterações' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
