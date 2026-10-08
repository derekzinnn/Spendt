import {
  type TransactionDto,
  type TransactionTotalsDto,
  type UpdateTransactionInput,
} from '@spendly/shared'
import { EllipsisVertical, Lock, Pencil, Repeat, Trash2 } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { AmountInput } from '@/components/money/AmountInput'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { inputClassName } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { shortDate } from '@/lib/dates-ui'
import { errorMessage } from '@/lib/form-errors'
import { undoToast } from '@/lib/undo-toast'

import { useDeleteTransaction, useRestoreTransactions, useUpdateTransaction } from './api'
import { CategoryOptions } from './CategoryOptions'
import type { Lookups } from './lookups'

const COLUMNS = ['date', 'description', 'category', 'source', 'paidBy', 'status', 'amount'] as const
type Column = (typeof COLUMNS)[number]

const HEADERS: Record<Column, string> = {
  date: 'Data',
  description: 'Descrição',
  category: 'Categoria',
  source: 'Conta / cartão',
  paidBy: 'Pago por',
  status: 'Status',
  amount: 'Valor',
}

/** Which cells of a row can be edited in place. Card rows keep value, date and source. */
function editable(row: TransactionDto, column: Column): boolean {
  const card = row.creditCardId !== null
  switch (column) {
    case 'description':
    case 'paidBy':
      return true
    case 'category':
      return row.type !== 'TRANSFER'
    case 'date':
    case 'amount':
    case 'source':
      return !card
    case 'status':
      return false // toggled with a click, not an editor
  }
}

const isIncome = (t: TransactionDto) => t.type === 'INCOME' && !t.creditCardId

function amountFlow(t: TransactionDto): 'in' | 'out' | undefined {
  if (t.type === 'TRANSFER') return undefined
  return t.type === 'INCOME' ? 'in' : 'out'
}

interface Editing {
  rowId: string
  column: Column
}

export function TransactionGrid({
  items,
  totals,
  lookups,
  onEdit,
}: {
  items: TransactionDto[]
  totals: TransactionTotalsDto
  lookups: Lookups
  onEdit: (row: TransactionDto) => void
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const update = useUpdateTransaction()

  const focusCell = (row: number, col: number) => {
    const target = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`)
    target?.focus()
  }

  function commit(row: TransactionDto, patch: UpdateTransactionInput) {
    setEditing(null)
    update.mutate(
      { id: row.id, ...patch },
      { onError: (error) => toast.error(errorMessage(error)) },
    )
  }

  /** Arrow keys move between cells; Enter (or F2) edits; the grid behaves like a sheet. */
  function onKeyDown(event: KeyboardEvent<HTMLTableSectionElement>) {
    const cell = (event.target as HTMLElement).dataset.cell
    if (!cell || editing) return
    const [r, c] = cell.split(':').map(Number) as [number, number]
    const moves: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      const [nr, nc] = move
      if (nr >= 0 && nr < items.length && nc >= 0 && nc < COLUMNS.length) focusCell(nr, nc)
      return
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      const row = items[r]
      const column = COLUMNS[c]
      if (row && column && editable(row, column)) {
        event.preventDefault()
        setEditing({ rowId: row.id, column })
      }
    }
  }

  return (
    <div className="blueprint border border-border">
      {/* relative: keeps absolutely positioned sr-only text inside the scroll box */}
      <div className="relative overflow-x-auto">
        <table ref={tableRef} className="w-full min-w-230 border-collapse text-sm" role="grid">
          <thead>
            <tr className="text-left">
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className={cn(
                    'kicker border-b border-border px-2 py-2 font-normal text-muted-foreground',
                    column === 'amount' && 'text-right',
                  )}
                >
                  {HEADERS[column]}
                </th>
              ))}
              <th className="w-10 border-b border-border">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          {/* One handler for the whole grid: the focusable cells inside are the controls,
              and the keys that move between them are the same for every row. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <tbody onKeyDown={onKeyDown}>
            {items.map((row, r) => (
              <tr key={row.id} className="border-b border-foreground/8 hover:bg-foreground/4">
                {COLUMNS.map((column, c) => {
                  const isEditing = editing?.rowId === row.id && editing.column === column
                  return (
                    <td
                      key={column}
                      className={cn('h-10 px-1 py-0', column === 'amount' && 'text-right')}
                    >
                      {isEditing ? (
                        <CellEditor
                          row={row}
                          column={column}
                          lookups={lookups}
                          onCommit={(patch) => {
                            commit(row, patch)
                            focusCell(r, c)
                          }}
                          onCancel={() => {
                            setEditing(null)
                            focusCell(r, c)
                          }}
                        />
                      ) : (
                        <CellView
                          row={row}
                          column={column}
                          lookups={lookups}
                          cellId={`${r}:${c}`}
                          onActivate={() =>
                            editable(row, column) && setEditing({ rowId: row.id, column })
                          }
                          onToggleStatus={() =>
                            commit(row, { status: row.status === 'PAID' ? 'PENDING' : 'PAID' })
                          }
                        />
                      )}
                    </td>
                  )
                })}
                <td className="px-1">
                  <RowActions row={row} onEdit={() => onEdit(row)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td
                colSpan={5}
                className="sticky bottom-0 border-t border-foreground bg-background px-2 py-2.5"
              >
                Total · {totals.count} {totals.count === 1 ? 'lançamento' : 'lançamentos'}
              </td>
              <td
                colSpan={2}
                className="sticky bottom-0 border-t border-foreground bg-background px-2 py-2.5 text-right"
              >
                <span className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1">
                  <span className="text-xs font-normal text-muted-foreground">
                    receitas <Money cents={totals.incomeCents} size="sm" flow="in" />
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    despesas <Money cents={totals.expenseCents} size="sm" flow="out" signed />
                  </span>
                  <Money cents={totals.netCents} signed />
                </span>
              </td>
              <td className="sticky bottom-0 border-t border-foreground bg-background" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

const cellButton =
  'flex h-9 w-full cursor-default items-center gap-1.5 px-1 text-left outline-offset-[-2px] focus-visible:outline-2'

function CellView({
  row,
  column,
  lookups,
  cellId,
  onActivate,
  onToggleStatus,
}: {
  row: TransactionDto
  column: Column
  lookups: Lookups
  cellId: string
  onActivate: () => void
  onToggleStatus: () => void
}) {
  const canEdit = editable(row, column)
  let content: ReactNode
  switch (column) {
    case 'date':
      content = <span className="whitespace-nowrap">{shortDate(row.date)}</span>
      break
    case 'description':
      content = (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{row.description}</span>
          {row.installmentNumber ? (
            <Badge tone="neutral">
              {row.installmentNumber}/{row.installmentCount}
            </Badge>
          ) : null}
          {row.recurringRuleId ? (
            <Repeat aria-label="Recorrente" className="size-3.5 shrink-0 text-muted-foreground" />
          ) : null}
        </span>
      )
      break
    case 'category': {
      const category = lookups.category(row.categoryId)
      const parent = lookups.parentOf(category)
      content =
        row.type === 'TRANSFER' ? (
          <span className="text-muted-foreground">Transferência</span>
        ) : category ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <CategoryIcon icon={category.icon} color={category.color} size="xs" />
            <span className="truncate">
              {parent ? <span className="text-muted-foreground">{parent.name} › </span> : null}
              {category.name}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      break
    }
    case 'source':
      content = (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{lookups.sourceLabel(row)}</span>
          {row.creditCardId ? (
            <Lock aria-label="Na fatura" className="size-3 shrink-0 text-muted-foreground" />
          ) : null}
        </span>
      )
      break
    case 'paidBy':
      content = <span className="truncate">{lookups.member(row.paidById)?.displayName ?? '—'}</span>
      break
    case 'status':
      if (row.creditCardId) {
        return (
          <span data-cell={cellId} tabIndex={-1} className={cellButton}>
            <Badge tone="outline">Na fatura</Badge>
          </span>
        )
      }
      return (
        <button
          type="button"
          data-cell={cellId}
          onClick={onToggleStatus}
          className={cn(cellButton, 'cursor-pointer')}
          aria-label={`${row.status === 'PAID' ? 'Pago' : 'Pendente'} — clique para alternar`}
        >
          <Badge tone={row.status === 'PAID' ? 'neutral' : 'outline'}>
            {row.status === 'PAID'
              ? isIncome(row)
                ? 'Recebido'
                : 'Pago'
              : row.dueDate
                ? `Vence ${shortDate(row.dueDate)}`
                : 'Pendente'}
          </Badge>
        </button>
      )
    case 'amount':
      content = (
        <span className="ml-auto">
          <Money
            cents={row.amountCents}
            {...(amountFlow(row) ? { flow: amountFlow(row) } : {})}
            signed={row.type !== 'TRANSFER'}
          />
        </span>
      )
      break
  }
  return (
    <button
      type="button"
      data-cell={cellId}
      onDoubleClick={onActivate}
      onClick={(event) => {
        // A single click selects; a second click on the focused cell edits (like a sheet).
        if (document.activeElement === event.currentTarget && canEdit) onActivate()
      }}
      title={canEdit ? 'Enter ou duplo clique para editar' : undefined}
      className={cn(cellButton, canEdit && 'hover:bg-foreground/4')}
    >
      {content}
    </button>
  )
}

function CellEditor({
  row,
  column,
  lookups,
  onCommit,
  onCancel,
}: {
  row: TransactionDto
  column: Column
  lookups: Lookups
  onCommit: (patch: UpdateTransactionInput) => void
  onCancel: () => void
}) {
  const [cents, setCents] = useState<number | null>(row.amountCents)
  const keys = (commit: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }
  const compact = cn(inputClassName, 'h-8')
  /** Text-like editors: Enter or leaving the cell saves (when changed), Esc cancels. */
  const textCommit = (field: 'description' | 'date', original: string) => (value: string) => {
    const next = value.trim()
    if (next && next !== original) onCommit({ [field]: next })
    else onCancel()
  }

  switch (column) {
    case 'description': {
      const save = textCommit('description', row.description)
      return (
        <input
          autoFocus
          defaultValue={row.description}
          aria-label="Descrição"
          className={compact}
          onKeyDown={(event) => keys(() => save(event.currentTarget.value))(event)}
          onBlur={(event) => save(event.currentTarget.value)}
        />
      )
    }
    case 'date': {
      const save = textCommit('date', row.date)
      return (
        <input
          autoFocus
          type="date"
          defaultValue={row.date}
          aria-label="Data"
          className={compact}
          onKeyDown={(event) => keys(() => save(event.currentTarget.value))(event)}
          onBlur={(event) => save(event.currentTarget.value)}
        />
      )
    }
    case 'amount':
      return (
        <AmountInput
          autoFocus
          aria-label="Valor"
          value={cents}
          onChange={setCents}
          className="h-8"
          onKeyDown={keys(() =>
            cents && cents !== row.amountCents ? onCommit({ amountCents: cents }) : onCancel(),
          )}
          onBlur={() =>
            cents && cents !== row.amountCents ? onCommit({ amountCents: cents }) : onCancel()
          }
        />
      )
    case 'category':
      return (
        <select
          autoFocus
          aria-label="Categoria"
          className={compact}
          defaultValue={row.categoryId ?? ''}
          onKeyDown={keys(() => undefined)}
          onBlur={onCancel}
          onChange={(event) => onCommit({ categoryId: event.target.value || null })}
        >
          <option value="">Sem categoria</option>
          <CategoryOptions
            categories={lookups.categories}
            kind={row.type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
            keepId={row.categoryId}
          />
        </select>
      )
    case 'source':
      return (
        <select
          autoFocus
          aria-label="Conta"
          className={compact}
          defaultValue={row.accountId ?? ''}
          onKeyDown={keys(() => undefined)}
          onBlur={onCancel}
          onChange={(event) => onCommit({ accountId: event.target.value || null })}
        >
          {row.status === 'PENDING' ? <option value="">Sem conta</option> : null}
          {lookups.accounts
            .filter((a) => !a.archivedAt || a.id === row.accountId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      )
    case 'paidBy':
      return (
        <select
          autoFocus
          aria-label="Pago por"
          className={compact}
          defaultValue={row.paidById ?? ''}
          onKeyDown={keys(() => undefined)}
          onBlur={onCancel}
          onChange={(event) => onCommit({ paidById: event.target.value || null })}
        >
          <option value="">—</option>
          {lookups.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      )
    case 'status':
      return null
  }
}

export function RowActions({ row, onEdit }: { row: TransactionDto; onEdit: () => void }) {
  const remove = useDeleteTransaction()
  const restore = useRestoreTransactions()
  const run = (scope: 'one' | 'following' | 'all') =>
    remove.mutate(
      { id: row.id, scope },
      {
        onSuccess: ({ ids }) =>
          undoToast(
            ids.length > 1
              ? `${ids.length} parcelas de “${row.description}” excluídas`
              : `“${row.description}” excluído`,
            { onUndo: () => restore.mutate(ids) },
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon-sm" aria-label={`Ações de ${row.description}`}>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.installmentPlanId ? (
          <>
            <DropdownMenuLabel className="kicker text-muted-foreground">Excluir</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => run('one')}>
              <Trash2 /> Só esta parcela
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run('following')}>
              <Trash2 /> Esta e as próximas
            </DropdownMenuItem>
            <DropdownMenuItem tone="danger" onSelect={() => run('all')}>
              <Trash2 /> Todas as parcelas
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => run('one')}>
            <Trash2 /> Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
