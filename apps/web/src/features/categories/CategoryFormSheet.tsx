import { zodResolver } from '@hookform/resolvers/zod'
import {
  categoryIconKeySchema,
  categoryNameSchema,
  CATEGORY_KIND_LABELS,
  paletteKeySchema,
  type CategoryDto,
  type CategoryKind,
} from '@spendly/shared'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { CategoryBadge } from '@/components/category/CategoryBadge'
import { AmountInput } from '@/components/money/AmountInput'
import { ColorPicker } from '@/components/pickers/ColorPicker'
import { IconPicker } from '@/components/pickers/IconPicker'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect } from '@/components/ui/form'
import { Input, Label } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { showFormError } from '@/lib/form-errors'
import { useIsDesktop } from '@/lib/use-media-query'

import { useCreateCategory, useUpdateCategory } from './api'

const formSchema = z.object({
  name: categoryNameSchema,
  icon: categoryIconKeySchema,
  color: paletteKeySchema,
  parentId: z.string(),
  budgetCents: z.int().min(0).nullable(),
})
type FormValues = z.infer<typeof formSchema>

export type CategorySheetConfig =
  | { mode: 'create'; kind: CategoryKind; parent?: CategoryDto | undefined }
  | { mode: 'edit'; category: CategoryDto; parent?: CategoryDto | undefined }

interface CategoryFormSheetProps {
  open: boolean
  /** Kept after closing so the exit animation doesn't flash an empty sheet. */
  config: CategorySheetConfig
  onClose: () => void
  /** Active top-level categories (for the "inside" select). */
  parents: CategoryDto[]
}

export function CategoryFormSheet({ open, config, onClose, parents }: CategoryFormSheetProps) {
  const isDesktop = useIsDesktop()
  const title =
    config.mode === 'edit'
      ? 'Editar categoria'
      : config.parent
        ? `Nova subcategoria em ${config.parent.name}`
        : `Nova categoria de ${CATEGORY_KIND_LABELS[config.kind].toLowerCase()}`
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'} title={title}>
        <CategoryForm state={config} parents={parents} onDone={onClose} />
      </SheetContent>
    </Sheet>
  )
}

function CategoryForm({
  state,
  parents,
  onDone,
}: {
  state: CategorySheetConfig
  parents: CategoryDto[]
  onDone: () => void
}) {
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const editing = state.mode === 'edit' ? state.category : undefined
  const kind = editing?.kind ?? (state.mode === 'create' ? state.kind : 'EXPENSE')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          icon: editing.icon,
          color: editing.color,
          parentId: editing.parentId ?? '',
          budgetCents: editing.monthlyBudgetCents,
        }
      : {
          name: '',
          icon: state.parent?.icon ?? 'ellipsis',
          color: state.parent?.color ?? '700',
          parentId: state.parent?.id ?? '',
          budgetCents: null,
        },
  })
  const { errors } = form.formState
  const [name, icon, color, parentId] = useWatch({
    control: form.control,
    name: ['name', 'icon', 'color', 'parentId'],
  })
  const parentName = parents.find((p) => p.id === parentId)?.name

  const onSubmit = form.handleSubmit((values) => {
    const budget = kind === 'EXPENSE' && values.budgetCents ? values.budgetCents : null
    const options = {
      onSuccess: () => {
        toast.success(editing ? 'Categoria atualizada' : `“${values.name}” criada`)
        onDone()
      },
      onError: (error: Error) =>
        showFormError(error, form.setError, { fields: { monthlyBudgetCents: 'budgetCents' } }),
    }
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          name: values.name,
          icon: values.icon,
          color: values.color,
          monthlyBudgetCents: budget,
        },
        options,
      )
    } else {
      create.mutate(
        {
          name: values.name,
          kind,
          icon: values.icon,
          color: values.color,
          parentId: values.parentId || null,
          monthlyBudgetCents: budget,
        },
        options,
      )
    }
  })

  const pending = create.isPending || update.isPending

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        <div className="flex min-h-14 items-center justify-center border border-dashed border-border-strong px-3 py-3">
          <CategoryBadge
            name={name.trim() || 'Nome da categoria'}
            icon={icon}
            color={color}
            {...(parentName ? { parentName } : {})}
          />
        </div>

        <Field label="Nome" htmlFor="category-name" error={errors.name?.message}>
          <Input
            id="category-name"
            autoComplete="off"
            autoFocus
            placeholder={kind === 'EXPENSE' ? 'Ex.: Farmácia' : 'Ex.: 13º salário'}
            aria-invalid={Boolean(errors.name)}
            {...form.register('name')}
          />
        </Field>

        {editing ? null : (
          <Field
            label="Dentro de"
            htmlFor="category-parent"
            error={errors.parentId?.message}
            hint="Deixe vazio para criar uma categoria principal."
          >
            <NativeSelect
              id="category-parent"
              {...form.register('parentId', {
                onChange: (event: { target: { value: string } }) => {
                  const parent = parents.find((p) => p.id === event.target.value)
                  if (parent) form.setValue('color', parent.color)
                },
              })}
            >
              <option value="">Nenhuma (categoria principal)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <div className="flex flex-col gap-2">
          <Label>Tom</Label>
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Ícone</Label>
          <Controller
            control={form.control}
            name="icon"
            render={({ field }) => (
              <IconPicker value={field.value} onChange={field.onChange} color={color} />
            )}
          />
        </div>

        {kind === 'EXPENSE' ? (
          <Field
            label="Orçamento mensal"
            htmlFor="category-budget"
            error={errors.budgetCents?.message}
            hint="Opcional — deixe vazio para não ter. O painel avisa em 80% e 100%."
          >
            <Controller
              control={form.control}
              name="budgetCents"
              render={({ field }) => (
                <AmountInput
                  id="category-budget"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-border bg-background px-5 py-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar categoria'}
        </Button>
      </div>
    </form>
  )
}
