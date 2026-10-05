import { FileSpreadsheet, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

/**
 * Drop a statement here, or click to choose one. It is a real `<input type="file">` under a
 * label, so the keyboard and screen readers get the normal control and everyone else gets
 * the big target.
 */
export function FilePicker({
  file,
  onPick,
  disabled,
}: {
  file: File | null
  onPick: (file: File) => void
  disabled?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (list: FileList | null) => {
    const picked = list?.[0]
    if (picked) onPick(picked)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        if (!disabled) take(event.dataTransfer.files)
      }}
      className={cn(
        'blueprint flex flex-col items-center gap-3 border border-dashed px-6 py-10 text-center transition-colors',
        over ? 'border-steel bg-steel-100' : 'border-border',
        disabled && 'opacity-60',
      )}
    >
      {file ? (
        <FileSpreadsheet aria-hidden className="size-7 text-steel-700" />
      ) : (
        <Upload aria-hidden className="size-7 text-steel-700" />
      )}
      <div className="space-y-1">
        <p className="text-[15px]">
          {file ? file.name : 'Arraste o extrato aqui ou escolha o arquivo'}
        </p>
        <p className="text-[13px] text-muted-foreground">
          CSV ou XLSX, do jeito que o banco exporta. O arquivo é lido no seu aparelho.
        </p>
      </div>
      <label
        htmlFor={inputId}
        className="cursor-pointer border border-foreground px-3 py-1.5 text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:bg-foreground/7"
      >
        {file ? 'Escolher outro' : 'Escolher arquivo'}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,text/csv"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files)
            // Let the same file be picked again after a mistake.
            event.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
