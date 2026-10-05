import {
  addMonths,
  capitalize,
  currentMonthKey,
  formatMonthLabel,
  monthName,
  parseMonthKey,
  toMonthKey,
  type MonthKey,
} from '@spendly/shared'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/cn'

export interface MonthPickerProps {
  value: MonthKey
  onChange: (value: MonthKey) => void
  min?: MonthKey
  max?: MonthKey
  className?: string
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

/**
 * The month selector every screen shares: a hairline box with arrows to step and the month
 * in the middle, which opens a grid to jump. Value is a calendar month ("2026-10"), never a
 * Date.
 */
export function MonthPicker({ value, onChange, min, max, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => parseMonthKey(value).year)
  const gridRef = useRef<HTMLDivElement>(null)

  const today = currentMonthKey()
  const { year, month } = parseMonthKey(value)
  const outOfRange = (key: MonthKey) =>
    (min !== undefined && key < min) || (max !== undefined && key > max)

  const previous = addMonths(value, -1)
  const next = addMonths(value, 1)

  function select(key: MonthKey) {
    if (outOfRange(key)) return
    onChange(key)
    setOpen(false)
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
    }
    const delta = moves[event.key]
    if (delta === undefined) return
    event.preventDefault()
    const buttons = Array.from(gridRef.current?.querySelectorAll('button') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const target = buttons[Math.min(11, Math.max(0, (index === -1 ? month - 1 : index) + delta))]
    target?.focus()
  }

  return (
    <div className={cn('inline-flex items-stretch border border-border', className)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Mês anterior: ${formatMonthLabel(previous)}`}
        disabled={outOfRange(previous)}
        onClick={() => onChange(previous)}
      >
        <ChevronLeft />
      </Button>

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) setViewYear(year)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex min-w-30 flex-1 cursor-pointer items-center justify-center px-2 font-display text-base whitespace-nowrap transition-colors hover:bg-foreground/7 data-[state=open]:bg-foreground/7"
            aria-label={`Mês selecionado: ${formatMonthLabel(value)}. Escolher outro mês`}
          >
            {capitalize(monthName(month, 'short'))} {year}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="center">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Ano anterior"
              onClick={() => setViewYear((y) => y - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="font-display text-lg tabular-nums">{viewYear}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Próximo ano"
              onClick={() => setViewYear((y) => y + 1)}
            >
              <ChevronRight />
            </Button>
          </div>

          {/* Arrow keys are handled for the group: the twelve buttons inside are the
              controls, and one handler moves focus between them (roving focus). */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            ref={gridRef}
            role="group"
            aria-label={`Meses de ${viewYear}`}
            className="grid grid-cols-3 gap-px border border-border bg-border"
            onKeyDown={handleGridKeyDown}
          >
            {MONTHS.map((m) => {
              const key = toMonthKey(viewYear, m)
              const selected = key === value
              const isCurrent = key === today
              return (
                <button
                  key={key}
                  type="button"
                  disabled={outOfRange(key)}
                  aria-pressed={selected}
                  aria-label={formatMonthLabel(key)}
                  autoFocus={selected}
                  onClick={() => select(key)}
                  className={cn(
                    'relative h-10 cursor-pointer text-sm capitalize transition-colors focus-visible:outline-offset-[-2px] disabled:opacity-35',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-steel-100 hover:text-steel-800',
                  )}
                >
                  {monthName(m, 'short')}
                  {isCurrent && !selected ? (
                    <span
                      aria-hidden
                      className="absolute bottom-1.5 left-1/2 h-px w-3 -translate-x-1/2 bg-steel"
                    />
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              <span aria-hidden className="mr-1.5 inline-block h-px w-3 bg-steel align-middle" />
              Mês atual
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => select(today)}
              disabled={value === today}
            >
              Ir para hoje
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        aria-label={`Próximo mês: ${formatMonthLabel(next)}`}
        disabled={outOfRange(next)}
        onClick={() => onChange(next)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
