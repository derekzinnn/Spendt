import {
  capitalize,
  DEFAULT_CATEGORIES,
  formatBRL,
  formatMonthLabel,
  monthName,
  NEUTRAL_PALETTE_KEY,
  parseMonthKey,
  type CategoryIconKey,
  type PaletteKey,
} from '@spendly/shared'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type XAxisTickContentProps,
} from 'recharts'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { Ruler } from '@/components/data/Ruler'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { useCssColors } from '@/lib/use-css-colors'
import { useMediaQuery } from '@/lib/use-media-query'

import { DEMO_SPENDING, DEMO_TREND } from '../demo-data'
import { ShowcaseSection } from '../ShowcaseSection'

const MAX_SLICES = 5
const compactNumber = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

interface Slice {
  name: string
  cents: number
  budgetCents: number | undefined
  color: PaletteKey
  icon: CategoryIconKey
}

/** Top categories + "Outros" (neutral) — a donut stays readable only with few slices. */
function buildSlices(): Slice[] {
  const sorted = [...DEMO_SPENDING].sort((a, b) => b.cents - a.cents)
  const head = sorted.slice(0, MAX_SLICES).map((row): Slice => {
    const category = DEFAULT_CATEGORIES.find((c) => c.name === row.category)
    return {
      name: row.category,
      cents: row.cents,
      budgetCents: row.budgetCents,
      color: category?.color ?? NEUTRAL_PALETTE_KEY,
      icon: category?.icon ?? 'ellipsis',
    }
  })
  const rest = sorted.slice(MAX_SLICES).reduce((sum, row) => sum + row.cents, 0)
  return rest > 0
    ? [
        ...head,
        {
          name: 'Outros',
          cents: rest,
          budgetCents: undefined,
          color: NEUTRAL_PALETTE_KEY,
          icon: 'ellipsis',
        },
      ]
    : head
}

const SLICES = buildSlices()
const TOTAL = SLICES.reduce((sum, s) => sum + s.cents, 0)

// Donut geometry (the prototype's): 168px, r = 62, 16px ring, 2px gap between slices.
const SIZE = 168
const RADIUS = 62
const RING = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ARCS = (() => {
  let start = 0
  return SLICES.map((slice) => {
    const length = (CIRCUMFERENCE * slice.cents) / TOTAL
    const arc = { dash: `${Math.max(length - 2, 0.5)} ${CIRCUMFERENCE}`, offset: -start }
    start += length
    return arc
  })
})()

/** Clean y-axis ticks: multiples of R$ 5.000 up to the first one above the data. */
const TICK_STEP = 500_000
const TREND_MAX = Math.max(...DEMO_TREND.flatMap((row) => [row.income, row.expense]))
const TREND_TICKS = Array.from(
  { length: Math.ceil(TREND_MAX / TICK_STEP) + 1 },
  (_, index) => index * TICK_STEP,
)
const CURRENT = DEMO_TREND.at(-1)?.month

const COLOR_VARS = [
  '--steel',
  '--steel-700',
  '--steel-900',
  '--border',
  '--foreground',
  '--muted-foreground',
  '--accent',
] as const

function drillDown(label: string) {
  toast(`Abriria Lançamentos filtrado por “${label}”`, {
    description: 'Painel 100% clicável chega na Fase 5.',
  })
}

function TrendTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length || typeof label !== 'string') return null
  const income = Number(payload.find((p) => p.dataKey === 'income')?.value ?? 0)
  const expense = Number(payload.find((p) => p.dataKey === 'expense')?.value ?? 0)
  return (
    <div className="min-w-48 border border-border bg-background p-3 text-[13px] shadow-raised">
      <p className="mb-2 font-display text-base">{capitalize(formatMonthLabel(label))}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2.5 border border-steel" /> Receitas
          </span>
          <Money cents={income} size="sm" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2.5 bg-steel-700" /> Despesas
          </span>
          <Money cents={expense} size="sm" />
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-1.5 font-medium">
          <span>Sobrou</span>
          <Money cents={income - expense} size="sm" signed />
        </div>
      </div>
    </div>
  )
}

function CategoryDonut() {
  const [active, setActive] = useState<number | null>(null)
  const focus = active === null ? null : SLICES[active]

  return (
    <Card className="flex flex-col gap-4.5 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl">Gastos por categoria</h3>
        <span className="text-xs text-muted-foreground">clique para ver os lançamentos</span>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="relative size-42 shrink-0">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`Gastos por categoria, total ${formatBRL(TOTAL)}`}
          >
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="var(--border)"
                strokeWidth={RING}
              />
              {SLICES.map((slice, index) => (
                <circle
                  key={slice.name}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={`var(--palette-${slice.color})`}
                  strokeWidth={RING}
                  strokeDasharray={ARCS[index]?.dash}
                  strokeDashoffset={ARCS[index]?.offset}
                  opacity={active === null || active === index ? 1 : 0.35}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => drillDown(slice.name)}
                />
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <span className="text-[11px] text-muted-foreground">{focus?.name ?? 'Total'}</span>
            <Money cents={focus?.cents ?? TOTAL} size="lg" className="text-xl" />
          </div>
        </div>

        {/* Ranked rows = direct labels + legend + table view */}
        <ol
          className="flex min-w-60 flex-1 flex-col"
          aria-label="Gastos por categoria, do maior para o menor"
        >
          {SLICES.map((slice, index) => {
            const pct = slice.budgetCents ? Math.round((slice.cents / slice.budgetCents) * 100) : 0
            return (
              <li key={slice.name}>
                <button
                  type="button"
                  onClick={() => drillDown(slice.name)}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className={cn(
                    'flex w-full cursor-pointer flex-col gap-1.5 border-b border-border px-1.5 py-2.5 text-left transition-colors duration-150 hover:bg-steel/7',
                    active === index && 'bg-steel/7',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <CategoryIcon icon={slice.icon} color={slice.color} size="sm" />
                    <span className="flex-1 truncate">{slice.name}</span>
                    {pct >= 80 ? (
                      <Badge tone="primary" className="h-4.5 px-1.5 text-[10px]">
                        {pct >= 100 ? 'estourou' : `${pct}%`}
                      </Badge>
                    ) : null}
                    <Money cents={slice.cents} size="sm" />
                  </span>
                  {slice.budgetCents ? (
                    <span className="flex items-center gap-2">
                      <Ruler
                        value={slice.cents}
                        max={slice.budgetCents}
                        className="flex-1"
                        label={`${formatBRL(slice.cents)} de ${formatBRL(slice.budgetCents)}`}
                      />
                      <span className="min-w-24 text-right text-[11px] text-muted-foreground">
                        de {formatBRL(slice.budgetCents)}
                      </span>
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </Card>
  )
}

function TrendChart() {
  const colors = useCssColors(COLOR_VARS)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl">Últimos 6 meses</h3>
        <ul className="flex gap-3.5 text-xs text-muted-foreground" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 border border-steel" /> Receitas
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 bg-steel-700" /> Despesas
          </li>
        </ul>
      </div>
      <figure>
        <div className="h-56" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={DEMO_TREND}
              barGap={3}
              barCategoryGap="28%"
              margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke={colors['--border']} strokeWidth={1} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: colors['--foreground'] }}
                tick={({ x, y, payload }: XAxisTickContentProps) => {
                  const month = String(payload.value)
                  const current = month === CURRENT
                  return (
                    <text
                      x={x}
                      y={Number(y) + 14}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={current ? 600 : 400}
                      fill={current ? colors['--foreground'] : colors['--muted-foreground']}
                    >
                      {monthName(parseMonthKey(month).month, 'short')}
                    </text>
                  )
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                domain={[0, TREND_TICKS.at(-1) ?? 'auto']}
                ticks={TREND_TICKS}
                tick={{ fill: colors['--muted-foreground'], fontSize: 11 }}
                tickFormatter={(cents: number) => compactNumber.format(cents / 100)}
              />
              <Tooltip
                content={(props: TooltipContentProps) => <TrendTooltip {...props} />}
                cursor={{ fill: colors['--accent'] }}
                isAnimationActive={false}
              />
              <Bar
                dataKey="income"
                name="Receitas"
                fill="transparent"
                stroke={colors['--steel']}
                strokeWidth={1}
                maxBarSize={22}
                isAnimationActive={!reducedMotion}
              />
              <Bar
                dataKey="expense"
                name="Despesas"
                maxBarSize={22}
                isAnimationActive={!reducedMotion}
                className="cursor-pointer"
                onClick={(entry: { payload?: { month?: string } }) =>
                  drillDown(`despesas de ${formatMonthLabel(entry.payload?.month ?? '2026-10')}`)
                }
              >
                {DEMO_TREND.map((row) => (
                  <Cell
                    key={row.month}
                    fill={row.month === CURRENT ? colors['--steel-900'] : colors['--steel-700']}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="sr-only">
          Receitas e despesas por mês, de maio a outubro de 2026.
        </figcaption>
        <details className="group mt-3 text-[13px]">
          <summary className="w-fit cursor-pointer text-steel-700 hover:underline">
            Ver como tabela
          </summary>
          <table className="mt-3 w-full">
            <thead>
              <tr className="kicker border-b border-border text-left text-muted-foreground">
                <th className="py-1.5 font-normal">Mês</th>
                <th className="py-1.5 text-right font-normal">Receitas</th>
                <th className="py-1.5 text-right font-normal">Despesas</th>
                <th className="py-1.5 text-right font-normal">Sobrou</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_TREND.map((row) => (
                <tr key={row.month} className="border-b border-border last:border-0">
                  <td className="py-1.5 capitalize">{formatMonthLabel(row.month, 'short')}</td>
                  <td className="py-1.5 text-right">
                    <Money cents={row.income} size="sm" />
                  </td>
                  <td className="py-1.5 text-right">
                    <Money cents={row.expense} size="sm" />
                  </td>
                  <td className="py-1.5 text-right">
                    <Money cents={row.income - row.expense} size="sm" signed />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>
    </Card>
  )
}

export function ChartsSection() {
  return (
    <ShowcaseSection
      id="graficos"
      title="Gráficos"
      description="Desenhados como o resto: marcas retas, régua de base em tinta, grade de 1px, textos sempre na cor do texto. Tons de aço + ícone + rótulo direto; toda série tem legenda e tabela."
    >
      <div className="grid items-start gap-7 lg:grid-cols-2">
        <CategoryDonut />
        <TrendChart />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Mais de {MAX_SLICES} categorias são agrupadas em “Outros”, no grafite. A marca de 80% na
        régua é o alerta do orçamento.
      </p>
    </ShowcaseSection>
  )
}
