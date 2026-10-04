import {
  CATEGORY_ICON_KEYS,
  CATEGORY_ICON_LABELS,
  type CategoryIconKey,
  type PaletteKey,
} from '@spendly/shared'

import { CATEGORY_ICONS } from '@/components/category/category-icons'
import { paletteStyle } from '@/components/category/palette-style'
import { cn } from '@/lib/cn'

interface IconPickerProps {
  value: CategoryIconKey
  onChange: (value: CategoryIconKey) => void
  color: PaletteKey
}

/** Grid of category icons, tinted with the category's colour. */
export function IconPicker({ value, onChange, color }: IconPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Ícone"
      style={paletteStyle(color)}
      className="grid max-h-52 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1 overflow-y-auto border border-border p-1.5"
    >
      {CATEGORY_ICON_KEYS.map((key) => {
        const Icon = CATEGORY_ICONS[key]
        const selected = key === value
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={CATEGORY_ICON_LABELS[key]}
            title={CATEGORY_ICON_LABELS[key]}
            onClick={() => onChange(key)}
            className={cn(
              'grid aspect-square cursor-pointer place-items-center transition-colors duration-150 focus-visible:outline-offset-[-2px]',
              selected
                ? 'bg-(--tint) text-(--tint-fg)'
                : 'text-muted-foreground hover:bg-(--tint-soft) hover:text-(--tint-ink)',
            )}
          >
            <Icon className="size-[18px]" />
          </button>
        )
      })}
    </div>
  )
}
