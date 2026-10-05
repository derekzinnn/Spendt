import {
  firstDayOfMonth,
  formatMonthLabel,
  lastDayOfMonth,
  parseMonthKey,
  toMonthKey,
  type ExportRowDto,
  type IsoDate,
  type MonthKey,
} from '@spendly/shared'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { errorMessage } from '@/lib/form-errors'
import { downloadCsv, downloadXlsx } from '@/lib/spreadsheet'

import { fetchExport } from './api'

const HEADER = [
  'Data',
  'Vencimento',
  'Pagamento',
  'Tipo',
  'Situação',
  'Descrição',
  'Categoria',
  'Conta / Cartão',
  'Pago por',
  'Parcela',
  'Observações',
  'Valor',
]

/** Cents become reais in the file: a spreadsheet should sum a column of money, not of cents. */
const toLine = (row: ExportRowDto) => [
  row.date,
  row.dueDate ?? '',
  row.paidDate ?? '',
  row.type,
  row.status,
  row.description,
  row.category,
  row.source,
  row.paidBy,
  row.installment,
  row.notes,
  row.amountCents / 100,
]

/**
 * Takes the ledger out as a file. The month on screen or the whole year, CSV (opens
 * anywhere) or XLSX (keeps the money as numbers).
 */
export function ExportMenu({ month }: { month: MonthKey }) {
  const [busy, setBusy] = useState(false)

  const run = async (label: string, from: IsoDate, to: IsoDate, format: 'csv' | 'xlsx') => {
    setBusy(true)
    try {
      const { rows } = await fetchExport(from, to)
      if (rows.length === 0) {
        toast('Nada para exportar neste período.')
        return
      }
      const lines = rows.map(toLine)
      const filename = `casa-${label}.${format}`
      if (format === 'csv') downloadCsv(filename, HEADER, lines)
      else await downloadXlsx(filename, HEADER, lines)
      toast.success(`${rows.length} lançamentos exportados.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const { year } = parseMonthKey(month)
  const yearFrom = firstDayOfMonth(toMonthKey(year, 1))
  const yearTo = lastDayOfMonth(toMonthKey(year, 12))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" disabled={busy}>
          <Download aria-hidden className="size-4" />
          {busy ? 'Exportando…' : 'Exportar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{formatMonthLabel(month)}</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => void run(month, firstDayOfMonth(month), lastDayOfMonth(month), 'csv')}
        >
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void run(month, firstDayOfMonth(month), lastDayOfMonth(month), 'xlsx')}
        >
          XLSX
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Ano de {year}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void run(String(year), yearFrom, yearTo, 'csv')}>
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run(String(year), yearFrom, yearTo, 'xlsx')}>
          XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
