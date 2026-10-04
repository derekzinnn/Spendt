import type { PaletteKey } from '@spendly/shared'
import type { CSSProperties } from 'react'

/**
 * Exposes a tone key as local CSS variables, so components can use `bg-(--tint)`,
 * `text-(--tint-fg)`, `bg-(--tint-soft)`, `text-(--tint-ink)`… without dynamic class names.
 *
 * - `--tint` / `--tint-fg`: the solid tile and the ink that reads on it
 * - `--tint-soft`: a quiet wash of the tone on the ground
 * - `--tint-ink`: text-safe ink for that tone on the ground
 */
export function paletteStyle(color: PaletteKey): CSSProperties {
  return {
    '--tint': `var(--palette-${color})`,
    '--tint-fg': `var(--palette-${color}-fg)`,
    '--tint-soft': `color-mix(in oklab, var(--palette-${color}) 20%, var(--background))`,
    '--tint-ink': color === 'neutral' ? 'var(--tone-neutral-ink)' : 'var(--tone-ink)',
  } as CSSProperties
}
