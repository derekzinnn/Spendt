import { type CategoryDto, type CategoryKind } from '@spendly/shared'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Pencil,
  Plus,
  Shapes,
  Target,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Money } from '@/components/money/Money'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/cn'
import { undoToast } from '@/lib/undo-toast'

import { useArchiveCategory, useCategories, useDeleteCategory, useUnarchiveCategory } from './api'
import { CategoryFormSheet, type CategorySheetConfig } from './CategoryFormSheet'

interface TreeNode {
  category: CategoryDto
  children: CategoryDto[]
}

function useArchiveWithUndo() {
  const archive = useArchiveCategory()
  const unarchive = useUnarchiveCategory()
  return (category: CategoryDto) =>
    archive.mutate(category.id, {
      onSuccess: (affected) =>
        undoToast(`“${category.name}” arquivada`, {
          description:
            affected.length > 1
              ? `Junto com ${affected.length - 1} subcategoria(s). O histórico fica guardado.`
              : 'Ela some das listas, mas o histórico fica guardado.',
          onUndo: () => unarchive.mutate(category.id),
        }),
      onError: (error) => toast.error(error.message),
    })
}

function RowActions({
  category,
  onEdit,
  onAddChild,
  onArchive,
}: {
  category: CategoryDto
  onEdit: () => void
  onAddChild?: (() => void) | undefined
  onArchive: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon-sm" aria-label={`Ações de ${category.name}`}>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Editar
        </DropdownMenuItem>
        {onAddChild ? (
          <DropdownMenuItem onSelect={onAddChild}>
            <Plus /> Nova subcategoria
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onArchive}>
          <Archive /> Arquivar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Budget({ cents }: { cents: number | null }) {
  if (cents === null) return <span className="text-xs text-subtle-foreground">Sem orçamento</span>
  return (
    <span className="flex items-center gap-1.5">
      <Target className="size-3.5 text-muted-foreground" aria-hidden />
      <Money cents={cents} size="sm" />
      <span className="text-xs text-muted-foreground">/mês</span>
    </span>
  )
}

function CategoryTree({
  nodes,
  onEdit,
  onAddChild,
  onArchive,
}: {
  nodes: TreeNode[]
  onEdit: (category: CategoryDto, parent?: CategoryDto) => void
  onAddChild: (parent: CategoryDto) => void
  onArchive: (category: CategoryDto) => void
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Card className="divide-y divide-border">
      {nodes.map(({ category, children }) => {
        const open = expanded.has(category.id)
        return (
          <div key={category.id}>
            <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <button
                type="button"
                onClick={() => toggle(category.id)}
                aria-expanded={open}
                aria-label={`${open ? 'Recolher' : 'Ver'} subcategorias de ${category.name}`}
                disabled={children.length === 0}
                className="grid size-7 shrink-0 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-foreground/7 disabled:invisible"
              >
                <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
              </button>
              <CategoryIcon icon={category.icon} color={category.color} />
              <button
                type="button"
                onClick={() => onEdit(category)}
                className="min-w-0 flex-1 cursor-pointer text-left"
              >
                <span className="block truncate font-display text-lg leading-tight">
                  {category.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {children.length === 0
                    ? 'Sem subcategorias'
                    : children.map((c) => c.name).join(' · ')}
                </span>
              </button>
              {category.kind === 'EXPENSE' ? (
                <span className="hidden sm:block">
                  <Budget cents={category.monthlyBudgetCents} />
                </span>
              ) : null}
              <RowActions
                category={category}
                onEdit={() => onEdit(category)}
                onAddChild={() => onAddChild(category)}
                onArchive={() => onArchive(category)}
              />
            </div>

            {open ? (
              <ul className="border-t border-border bg-foreground/[0.025] py-1">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className="flex items-center gap-3 py-2 pr-3 pl-12 sm:pr-4 sm:pl-14"
                  >
                    <CategoryIcon icon={child.icon} color={child.color} size="sm" />
                    <button
                      type="button"
                      onClick={() => onEdit(child, category)}
                      className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm"
                    >
                      {child.name}
                    </button>
                    {child.kind === 'EXPENSE' && child.monthlyBudgetCents !== null ? (
                      <Budget cents={child.monthlyBudgetCents} />
                    ) : null}
                    <RowActions
                      category={child}
                      onEdit={() => onEdit(child, category)}
                      onArchive={() => onArchive(child)}
                    />
                  </li>
                ))}
                <li className="py-1 pr-3 pl-12 sm:pl-14">
                  <Button variant="ghost" size="sm" onClick={() => onAddChild(category)}>
                    <Plus /> Subcategoria
                  </Button>
                </li>
              </ul>
            ) : null}
          </div>
        )
      })}
    </Card>
  )
}

function ArchivedCategories({ categories }: { categories: CategoryDto[] }) {
  const unarchive = useUnarchiveCategory()
  const remove = useDeleteCategory()
  const [toDelete, setToDelete] = useState<CategoryDto | null>(null)

  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        Arquivadas ({categories.length})
      </summary>
      <Card className="mt-3 divide-y divide-border">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center gap-3 px-4 py-2.5">
            <CategoryIcon
              icon={category.icon}
              color={category.color}
              size="sm"
              className="opacity-60"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {category.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                unarchive.mutate(category.id, {
                  onSuccess: () => toast.success(`“${category.name}” restaurada`),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <ArchiveRestore /> Restaurar
            </Button>
            <Button
              variant="quiet"
              size="icon-sm"
              aria-label={`Excluir ${category.name}`}
              onClick={() => setToDelete(category)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </Card>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Excluir “${toDelete?.name ?? ''}”?`}
        description="Só dá para excluir categorias nunca usadas e sem subcategorias. Isso não pode ser desfeito."
        confirmLabel="Excluir de vez"
        pending={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success('Categoria excluída'),
            onError: (e) => toast.error(e.message),
            onSettled: () => setToDelete(null),
          })
        }
      />
    </details>
  )
}

export function CategoriesPage() {
  const { data, isPending, isError, error, refetch } = useCategories()
  const [kind, setKind] = useState<CategoryKind>('EXPENSE')
  const [sheet, setSheet] = useState<{ open: boolean; config: CategorySheetConfig }>({
    open: false,
    config: { mode: 'create', kind: 'EXPENSE' },
  })
  const openSheet = (config: CategorySheetConfig) => setSheet({ open: true, config })
  const archiveWithUndo = useArchiveWithUndo()

  const { tree, parents, archived, counts, budget } = useMemo(() => {
    const all = data ?? []
    const active = all.filter((c) => !c.archivedAt)
    const topLevel = active.filter((c) => !c.parentId && c.kind === kind)
    const nodes: TreeNode[] = topLevel.map((category) => ({
      category,
      children: active.filter((c) => c.parentId === category.id),
    }))
    const budgeted = active.filter(
      (c) => !c.parentId && c.kind === 'EXPENSE' && c.monthlyBudgetCents,
    )
    return {
      tree: nodes,
      parents: topLevel,
      archived: all.filter((c) => c.archivedAt && c.kind === kind),
      counts: {
        EXPENSE: active.filter((c) => !c.parentId && c.kind === 'EXPENSE').length,
        INCOME: active.filter((c) => !c.parentId && c.kind === 'INCOME').length,
      },
      budget: {
        total: budgeted.reduce((sum, c) => sum + (c.monthlyBudgetCents ?? 0), 0),
        count: budgeted.length,
      },
    }
  }, [data, kind])

  const create = (parent?: CategoryDto) => openSheet({ mode: 'create', kind, parent })

  return (
    <>
      <PageHeader
        description="Como vocês organizam o dinheiro — com orçamento mensal onde fizer sentido."
        actions={
          <Button onClick={() => create()}>
            <Plus /> Nova categoria
          </Button>
        }
      />

      <div className="-mb-2 flex flex-wrap items-center justify-between gap-3">
        <Segmented<CategoryKind>
          aria-label="Tipo de categoria"
          value={kind}
          onValueChange={setKind}
          options={[
            { value: 'EXPENSE', label: `Despesas · ${counts.EXPENSE}` },
            { value: 'INCOME', label: `Receitas · ${counts.INCOME}` },
          ]}
        />
        {kind === 'EXPENSE' && budget.count > 0 ? (
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Target className="size-4" aria-hidden />
            Orçamento mensal: <Money
              cents={budget.total}
              size="sm"
              className="text-foreground"
            />{' '}
            em {budget.count} {budget.count === 1 ? 'categoria' : 'categorias'}
          </p>
        ) : null}
      </div>

      {isPending ? (
        <Card
          className="flex flex-col gap-4 p-4"
          aria-busy="true"
          aria-label="Carregando categorias"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </Card>
      ) : isError ? (
        <Card>
          <EmptyState
            size="sm"
            icon={Shapes}
            title="Não deu para carregar as categorias"
            description={error.message}
            action={<Button onClick={() => void refetch()}>Tentar de novo</Button>}
          />
        </Card>
      ) : tree.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Shapes}
            title={
              kind === 'EXPENSE' ? 'Nenhuma categoria de despesa' : 'Nenhuma categoria de receita'
            }
            description="Crie a primeira — ou restaure uma arquivada logo abaixo."
            action={
              <Button onClick={() => create()}>
                <Plus /> Nova categoria
              </Button>
            }
          />
        </Card>
      ) : (
        <CategoryTree
          nodes={tree}
          onEdit={(category, parent) => openSheet({ mode: 'edit', category, parent })}
          onAddChild={(parent) => create(parent)}
          onArchive={archiveWithUndo}
        />
      )}

      {archived.length > 0 ? <ArchivedCategories categories={archived} /> : null}

      <CategoryFormSheet
        open={sheet.open}
        config={sheet.config}
        onClose={() => setSheet((current) => ({ ...current, open: false }))}
        parents={parents}
      />
    </>
  )
}
