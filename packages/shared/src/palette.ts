/**
 * Tones a category, account, card or member can take.
 *
 * Casa's "Planta" design has a single steel accent: identity comes from a step of its
 * ramp (300 · 500 · 700 · 900) together with an icon and a name — never from free hues.
 * `neutral` is the graphite reserved for "Outros".
 *
 * The database stores the *key* ("700"), never a hex value. Each theme maps keys to CSS
 * variables (`--palette-700`, `--palette-700-fg`…), so the same category reads correctly in
 * light ("Planta") and dark ("Aço noturno") mode.
 *
 * ORDER MATTERS for auto-assignment: consecutive keys alternate dark/light steps, so two
 * neighbours in a list or chart are never the same tone.
 */
export const PALETTE_KEYS = ['700', '300', '900', '500', 'neutral'] as const

export type PaletteKey = (typeof PALETTE_KEYS)[number]

/** The neutral key used for "Outros" buckets in charts. */
export const NEUTRAL_PALETTE_KEY: PaletteKey = 'neutral'

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  '300': 'Névoa',
  '500': 'Aço',
  '700': 'Aço escuro',
  '900': 'Noite',
  neutral: 'Grafite',
}

export function isPaletteKey(value: string): value is PaletteKey {
  return (PALETTE_KEYS as readonly string[]).includes(value)
}
