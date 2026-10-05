/**
 * Reading and writing spreadsheets, in the browser.
 *
 * The file never leaves the device on the way in: we parse it here and send plain JSON rows
 * to the API. The XLSX libraries are imported on demand, so none of this weighs on the shell.
 */

/** A sheet as a grid of text: the first row is usually the header. */
export type Grid = string[][]

/**
 * Splits CSV text, honouring quoted fields (`"Padaria, a boa"`) and doubled quotes inside
 * them. Accepts `,` or `;` as the separator — Brazilian exports use `;` because the comma is
 * the decimal mark.
 */
export function parseCsv(text: string): Grid {
  const body = text.replace(/^\uFEFF/, '')
  const separator = guessSeparator(body)
  const rows: Grid = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === separator) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && body[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((line) => line.some((cell) => cell.trim() !== ''))
}

/** Whichever of `;` and `,` appears more outside quotes wins. */
function guessSeparator(text: string): string {
  const sample = text.slice(0, 4000).replace(/"[^"]*"/g, '')
  const semicolons = (sample.match(/;/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

/** Reads a CSV or XLSX file into a grid of text (the first sheet, when there are several). */
export async function readSpreadsheet(file: File): Promise<Grid> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const read: unknown = await readXlsxFile(file)
    return firstSheet(read).map((row) => row.map((cell) => cellToText(cell)))
  }
  return parseCsv(await file.text())
}

/** The library has returned both a grid and a list of sheets over its versions — take both. */
function firstSheet(read: unknown): unknown[][] {
  if (!Array.isArray(read) || read.length === 0) return []
  const first: unknown = read[0]
  if (Array.isArray(first)) return read as unknown[][]
  const data = (first as { data?: unknown }).data
  return Array.isArray(data) ? (data as unknown[][]) : []
}

function cellToText(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) {
    // Excel dates arrive as real dates; keep the calendar day, never a timezone shift.
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${cell.getFullYear()}-${pad(cell.getMonth() + 1)}-${pad(cell.getDate())}`
  }
  if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
    return String(cell)
  }
  return ''
}

/** Quotes a value only when it needs it, and always uses `;` so Excel pt-BR opens it right. */
function csvCell(value: string | number): string {
  const text = String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header, ...rows].map((line) => line.map(csvCell).join(';'))
  // The BOM makes Excel read it as UTF-8 instead of mangling the accents.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** Hands the browser a file to save. */
export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  download(filename, new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }))
}

/** Builds the .xlsx bytes. Money stays a number, so the spreadsheet can sum the column. */
export async function toXlsxBlob(header: string[], rows: (string | number)[][]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const data = [
    header.map((value) => ({ value, fontWeight: 'bold' as const })),
    ...rows.map((row) =>
      row.map((value) =>
        typeof value === 'number'
          ? { type: Number, value, format: '#,##0.00' }
          : { type: String, value },
      ),
    ),
  ]
  return writeXlsxFile(data).toBlob()
}

export async function downloadXlsx(
  filename: string,
  header: string[],
  rows: (string | number)[][],
) {
  download(filename, await toXlsxBlob(header, rows))
}
