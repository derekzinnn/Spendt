import { PALETTE_KEYS, PALETTE_LABELS, type PaletteKey } from '@spendly/shared'
import { Check } from 'lucide-react'

import { paletteStyle } from '@/components/category/palette-style'
import { cn } from '@/lib/cn'

interface ColorPickerProps {
  value: PaletteKey
  onChange: (value: PaletteKey) => void
  /** Keys that can't be picked (e.g. a colour another member already uses). */
  disabledKeys?: readonly PaletteKey[]
  label?: string
}

/** Tone swatches (square) as a radio group. Names come along for screen readers and tooltips. */
export function ColorPicker({
  value,
  onChange,
  disabledKeys = [],
  label = 'Tom',
}: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {PALETTE_KEYS.map((key) => {
        const selected = key === value
        const disabled = disabledKeys.includes(key) && !selected
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={PALETTE_LABELS[key]}
            title={PALETTE_LABELS[key]}
            disabled={disabled}
            onClick={() => onChange(key)}
            style={paletteStyle(key)}
            className={cn(
              'grid size-9 cursor-pointer place-items-center bg-(--tint) text-(--tint-fg) transition-[outline-color] duration-150',
              'outline-2 outline-offset-2',
              selected ? 'outline-foreground' : 'outline-transparent hover:outline-border-strong',
              'focus-visible:outline-ring',
              disabled && 'cursor-not-allowed opacity-25',
            )}
          >
            {selected ? <Check className="size-4" /> : null}
          </button>
        )
      })}
    </div>
  )
}
