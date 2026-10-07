import { zodResolver } from '@hookform/resolvers/zod'
import type { CardItemDto } from '@spendly/shared'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Field, NativeSelect } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useHouseholdContext } from '@/features/auth/api'
import { useCategories } from '@/features/categories/api'
import { showFormError } from '@/lib/form-errors'
import { useIsDesktop } from '@/lib/use-media-query'

import { useUpdatePurchase } from './api'

/**
 * Fixing what was typed: description, category, who used the card and notes.
 *
 * Value and date are NOT here on purpose — changing them would move the row to another
 * invoice (and, in a plan, shift every installment), which should be a deliberate
 * "delete and launch again", never a side effect of correcting a typo.
 */
const formSchema = z.object({
  description: z.string().trim().min(1, 'Descreva a compra').max(120),
  categoryId: z.string(),
  paidById: z.string(),
  notes: z.string().trim().max(500),
  scope: z.enum(['one', 'following', 'all']),
})
type FormValues = z.infer<typeof formSchema>

export interface EditPurchaseState {
  open: boolean
  item?: CardItemDto
}

export function EditPurchaseSheet({
  state,
  onOpenChange,
}: {
  state: EditPurchaseState
  onOpenChange: (open: boolean) => void
}) {
  const isDesktop = useIsDesktop()
  return (
    <Sheet open={state.open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        title="Editar compra"
        description="Valor e data não mudam aqui — para isso, exclua e lance de novo."
      >
        {state.open && state.item ? (
          <EditForm item={state.item} onDone={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function EditForm({ item, onDone }: { item: CardItemDto; onDone: () => void }) {
  const { members } = useHouseholdContext()
  const categories = useCategories().data ?? []
  const update = useUpdatePurchase()

  const inPlan = item.installmentPlanId !== null
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: item.description,
      categoryId: item.categoryId ?? '',
      paidById: item.paidById ?? '',
      notes: item.notes ?? '',
      scope: inPlan ? 'all' : 'one',
    },
  })
  const { errors } = form.formState

  // A card purchase is an expense; a refund credits the same categories back.
  const parents = categories.filter((c) => c.kind === 'EXPENSE' && !c.parentId && !c.archivedAt)

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(
      {
        id: item.id,
        scope: inPlan ? values.scope : 'one',
        description: values.description,
        categoryId: values.categoryId || null,
        paidById: values.paidById || null,
        notes: values.notes || null,
      },
      {
        onSuccess: (rows) => {
          toast.success(
            rows.length > 1 ? `${rows.length} parcelas atualizadas` : 'Compra atualizada',
          )
          onDone()
        },
        onError: (error) => showFormError(error, form.setError),
      },
    ),
  )

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        <Field label="Descrição" htmlFor="edit-description" error={errors.description?.message}>
          <Input id="edit-description" {...form.register('description')} />
        </Field>

        <Field label="Categoria" htmlFor="edit-category" error={errors.categoryId?.message}>
          <NativeSelect id="edit-category" {...form.register('categoryId')}>
            <option value="">Sem categoria</option>
            {parents.map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                <option value={parent.id}>{parent.name}</option>
                {categories
                  .filter((child) => child.parentId === parent.id && !child.archivedAt)
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
                <span className="text-xs text-muted-foreground">Quem usou o cartão</span>
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

        <Field label="Observações" htmlFor="edit-notes" error={errors.notes?.message}>
          <Input id="edit-notes" placeholder="Opcional" {...form.register('notes')} />
        </Field>

        {inPlan ? (
          <Controller
            control={form.control}
            name="scope"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Esta compra é parcelada ({item.installmentNumber}/{item.installmentCount}).
                  Aplicar em:
                </span>
                <Segmented
                  fill
                  aria-label="Aplicar em"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={[
                    { value: 'one', label: 'Só esta' },
                    { value: 'following', label: 'Esta e as próximas' },
                    { value: 'all', label: 'Todas' },
                  ]}
                />
              </div>
            )}
          />
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-end gap-3 border-t border-border px-5 py-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
