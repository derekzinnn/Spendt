import { formatDateBR, type CategoryDto, type ImportPreviewRowDto } from '@spendly/shared'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ROUTES } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, NativeSelect, SwitchField } from '@/components/ui/form'
import { useAccounts } from '@/features/accounts/api'
import { useCards } from '@/features/cards/api'
import { useCategories } from '@/features/categories/api'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/form-errors'
import { readSpreadsheet, type Grid } from '@/lib/spreadsheet'
import { undoToast } from '@/lib/undo-toast'

import { useCommitImport, usePreviewImport, useUndoImport } from './api'
import { FilePicker } from './FilePicker'
import { guessMapping, parseRows, type Mapping } from './parse'

/** How many parsed lines we show before the person asks the server to check the whole file. */
const SAMPLE = 6

type Step = 'file' | 'columns' | 'review'

/**
 * Bringing a bank or card statement in, in three steps that never surprise anyone: pick the
 * file, say which column is which, then review every line — with the ones already in the
 * ledger unticked — before a single row is written.
 */
export function ImportPage() {
  const navigate = useNavigate()
  const accounts = useAccounts().data ?? []
  const cards = useCards().data ?? []
  const categories = useCategories().data ?? []

  const [target, setTarget] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [grid, setGrid] = useState<Grid | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [rows, setRows] = useState<ImportPreviewRowDto[] | null>(null)
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set())
  const [chosen, setChosen] = useState<Record<number, string>>({})

  const preview = usePreviewImport()
  const commit = useCommitImport()
  const undo = useUndoImport()

  const [kind, id = ''] = target.split(':')
  const destination =
    kind === 'card' ? { accountId: null, creditCardId: id } : { accountId: id, creditCardId: null }
  const step: Step = rows ? 'review' : grid ? 'columns' : 'file'

  const parsed = useMemo(() => (grid && mapping ? parseRows(grid, mapping) : []), [grid, mapping])
  const good = parsed.flatMap((line) => (line.row ? [line.row] : []))
  const problems = parsed.filter((line) => line.problem)

  const reset = () => {
    setRows(null)
    setSkipped(new Set())
    setChosen({})
  }

  const pickFile = async (picked: File) => {
    setFile(picked)
    reset()
    try {
      const read = await readSpreadsheet(picked)
      if (read.length === 0) {
        toast.error('O arquivo está vazio.')
        return
      }
      setGrid(read)
      setMapping(guessMapping(read))
    } catch {
      setGrid(null)
      toast.error('Não consegui ler este arquivo. Exporte como CSV e tente de novo.')
    }
  }

  const check = async () => {
    if (!id) return toast.error('Escolha a conta ou o cartão do extrato.')
    try {
      const result = await preview.mutateAsync({
        ...destination,
        rows: good,
      })
      setRows(result.rows)
      // Lines that look like something already there start unticked.
      setSkipped(new Set(result.rows.filter((r) => r.duplicateOfId).map((r) => r.index)))
      setChosen(
        Object.fromEntries(
          result.rows.flatMap((r) => (r.categoryId ? [[r.index, r.categoryId]] : [])),
        ),
      )
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const keeping = (rows ?? []).filter((row) => !skipped.has(row.index))

  const save = async () => {
    try {
      const result = await commit.mutateAsync({
        ...destination,
        rows: keeping.map((row) => ({
          date: row.date,
          description: row.description,
          amountCents: row.amountCents,
          type: row.type,
          categoryId: chosen[row.index] ?? null,
        })),
      })
      undoToast(`${result.count} lançamentos importados.`, {
        description: 'Eles já estão na planilha do mês.',
        onUndo: () => void undo.mutateAsync(result.ids).catch(() => undefined),
      })
      void navigate(ROUTES.transactions)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader description="Traga o extrato do banco ou a fatura do cartão. O arquivo é lido aqui no seu aparelho — nada é gravado antes de você conferir linha por linha." />

      <Card className="flex flex-col gap-5 p-5">
        <StepHead number={1} title="De onde vem" done={Boolean(id && file)} />
        <Field label="Conta ou cartão do extrato" htmlFor="import-target">
          <NativeSelect
            id="import-target"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value)
              reset()
            }}
          >
            <option value="">Escolha…</option>
            <optgroup label="Contas">
              {accounts.map((account) => (
                <option key={account.id} value={`account:${account.id}`}>
                  {account.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cartões">
              {cards.map((card) => (
                <option key={card.id} value={`card:${card.id}`}>
                  {card.name}
                </option>
              ))}
            </optgroup>
          </NativeSelect>
        </Field>
        <FilePicker file={file} onPick={(picked) => void pickFile(picked)} />
      </Card>

      {grid && mapping ? (
        <Card className="flex flex-col gap-5 p-5">
          <StepHead number={2} title="Quais colunas" done={step === 'review'} />
          <ColumnMapping
            grid={grid}
            mapping={mapping}
            onChange={(next) => {
              setMapping(next)
              reset()
            }}
          />

          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              {good.length === 1 ? '1 linha reconhecida' : `${good.length} linhas reconhecidas`}
              {problems.length === 1
                ? ' · 1 será ignorada'
                : problems.length > 1
                  ? ` · ${problems.length} serão ignoradas`
                  : ''}
            </p>
            <ul className="divide-y divide-border border-y border-border text-sm">
              {parsed.slice(0, SAMPLE).map((line) => (
                <li key={line.line} className="flex items-center gap-3 py-2">
                  <span className="w-8 shrink-0 text-xs text-muted-foreground">{line.line}</span>
                  {line.row ? (
                    <>
                      <span className="w-20 shrink-0 tabular-nums">
                        {formatDateBR(line.row.date)}
                      </span>
                      <span className="flex-1 truncate">{line.row.description}</span>
                      <Money
                        cents={line.row.amountCents}
                        size="sm"
                        flow={line.row.type === 'INCOME' ? 'in' : 'out'}
                        signed
                      />
                    </>
                  ) : (
                    <span className="flex flex-1 items-center gap-1.5 text-muted-foreground">
                      <TriangleAlert aria-hidden className="size-3.5" />
                      {line.problem}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Button onClick={() => void check()} disabled={good.length === 0 || preview.isPending}>
              {preview.isPending ? 'Conferindo…' : 'Conferir as linhas'}
            </Button>
          </div>
        </Card>
      ) : null}

      {rows ? (
        <Card className="flex flex-col gap-5 p-5">
          <StepHead number={3} title="Confira e importe" done={false} />
          <ReviewTable
            rows={rows}
            categories={categories}
            skipped={skipped}
            chosen={chosen}
            onToggle={(index) =>
              setSkipped((current) => {
                const next = new Set(current)
                if (next.has(index)) next.delete(index)
                else next.add(index)
                return next
              })
            }
            onCategory={(index, categoryId) =>
              setChosen((current) => ({ ...current, [index]: categoryId }))
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={keeping.length === 0 || commit.isPending}>
              {commit.isPending ? 'Importando…' : `Importar ${keeping.length} lançamentos`}
            </Button>
            <Button variant="ghost" onClick={reset}>
              Voltar
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  )
}

function StepHead({ number, title, done }: { number: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'grid size-7 shrink-0 place-content-center border text-sm',
          done ? 'border-steel bg-steel-100 text-steel-800' : 'border-foreground',
        )}
      >
        {done ? <CircleCheck className="size-4" /> : number}
      </span>
      <h2 className="text-xl">
        <span className="sr-only">Passo {number}: </span>
        {title}
      </h2>
    </div>
  )
}

const ROLES = [
  { key: 'date', label: 'Data' },
  { key: 'description', label: 'Descrição' },
  { key: 'amount', label: 'Valor' },
  { key: 'credit', label: 'Entradas (se houver coluna separada)' },
] as const

function ColumnMapping({
  grid,
  mapping,
  onChange,
}: {
  grid: Grid
  mapping: Mapping
  onChange: (mapping: Mapping) => void
}) {
  const header = grid[0] ?? []
  const columns = header.map((cell, index) => ({
    index,
    label: mapping.hasHeader && cell.trim() ? cell.trim() : `Coluna ${index + 1}`,
  }))

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ROLES.map((role) => (
        <Field key={role.key} label={role.label} htmlFor={`map-${role.key}`}>
          <NativeSelect
            id={`map-${role.key}`}
            value={String(mapping[role.key])}
            onChange={(event) => onChange({ ...mapping, [role.key]: Number(event.target.value) })}
          >
            <option value="-1">— nenhuma —</option>
            {columns.map((column) => (
              <option key={column.index} value={column.index}>
                {column.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ))}
      <SwitchField
        checked={mapping.hasHeader}
        onCheckedChange={(checked) => onChange({ ...mapping, hasHeader: checked })}
      >
        A primeira linha é o cabeçalho
      </SwitchField>
      <SwitchField
        checked={mapping.invertSigns}
        onCheckedChange={(checked) => onChange({ ...mapping, invertSigns: checked })}
      >
        Valores positivos são despesas (fatura de cartão)
      </SwitchField>
    </div>
  )
}

function ReviewTable({
  rows,
  categories,
  skipped,
  chosen,
  onToggle,
  onCategory,
}: {
  rows: ImportPreviewRowDto[]
  categories: CategoryDto[]
  skipped: ReadonlySet<number>
  chosen: Record<number, string>
  onToggle: (index: number) => void
  onCategory: (index: number, categoryId: string) => void
}) {
  const duplicates = rows.filter((row) => row.duplicateOfId).length
  const options = (kind: 'EXPENSE' | 'INCOME') =>
    categories.filter((category) => category.kind === kind && !category.archivedAt)

  return (
    <div className="space-y-3">
      {duplicates > 0 ? (
        <p className="flex items-center gap-2 border border-foreground px-3 py-2 text-[13px]">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {duplicates === 1
            ? '1 linha já parece estar na planilha e vem desmarcada.'
            : `${duplicates} linhas já parecem estar na planilha e vêm desmarcadas.`}
        </p>
      ) : null}

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <caption className="sr-only">
            Linhas do extrato: marque as que quer importar e confira a categoria de cada uma.
          </caption>
          <thead>
            <tr className="kicker border-b border-border text-left text-muted-foreground">
              <th className="w-14 py-2 font-normal">
                <span className="sr-only">Importar</span>
              </th>
              <th className="py-2 font-normal">Data</th>
              <th className="py-2 font-normal">Descrição</th>
              <th className="py-2 font-normal">Categoria</th>
              <th className="py-2 text-right font-normal">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const keep = !skipped.has(row.index)
              return (
                <tr
                  key={row.index}
                  className={cn('border-b border-border last:border-0', !keep && 'opacity-55')}
                >
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      checked={keep}
                      onChange={() => onToggle(row.index)}
                      aria-label={`Importar ${row.description} de ${formatDateBR(row.date)}`}
                      className="size-4 accent-(--primary)"
                    />
                  </td>
                  <td className="py-1.5 tabular-nums">{formatDateBR(row.date)}</td>
                  <td className="max-w-70 truncate py-1.5">
                    {row.description}
                    {row.duplicateOfId ? (
                      <Badge tone="warning" className="ml-2">
                        já existe
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-1.5">
                    <NativeSelect
                      value={chosen[row.index] ?? ''}
                      aria-label={`Categoria de ${row.description}`}
                      onChange={(event) => onCategory(row.index, event.target.value)}
                      className="h-8 text-[13px]"
                    >
                      <option value="">Sem categoria</option>
                      {options(row.type).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="py-1.5 text-right">
                    <Money
                      cents={row.amountCents}
                      size="sm"
                      flow={row.type === 'INCOME' ? 'in' : 'out'}
                      signed
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
