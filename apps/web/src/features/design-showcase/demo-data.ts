/**
 * Static sample data for the design showcase only (charts and pattern previews).
 * Real screens read the API — never import this from feature screens.
 */
import type { PaletteKey } from '@spendly/shared'

export interface DemoMember {
  id: string
  name: string
  color: PaletteKey
}

export const DEMO_MEMBERS: DemoMember[] = [
  { id: 'me', name: 'Derek', color: '700' },
  { id: 'her', name: 'Parceira', color: '300' },
]

/** Spending by category for the sample charts (cents), with monthly budgets. */
export const DEMO_SPENDING: { category: string; cents: number; budgetCents?: number }[] = [
  { category: 'Moradia', cents: 318_990, budgetCents: 388_000 },
  { category: 'Mercado', cents: 172_310, budgetCents: 200_000 },
  { category: 'Restaurantes', cents: 21_450, budgetCents: 20_000 },
  { category: 'Transporte', cents: 41_280, budgetCents: 60_000 },
  { category: 'Lazer', cents: 29_900, budgetCents: 50_000 },
  { category: 'Assinaturas', cents: 12_470 },
  { category: 'Saúde', cents: 9_850 },
  { category: 'Pets', cents: 7_420 },
]

/** Last six months, income vs expense (cents). */
export const DEMO_TREND = [
  { month: '2026-05', income: 1_570_000, expense: 1_212_340 },
  { month: '2026-06', income: 1_570_000, expense: 1_398_120 },
  { month: '2026-07', income: 1_694_500, expense: 1_455_780 },
  { month: '2026-08', income: 1_570_000, expense: 1_187_640 },
  { month: '2026-09', income: 1_612_300, expense: 1_302_950 },
  { month: '2026-10', income: 1_570_000, expense: 630_670 },
]
