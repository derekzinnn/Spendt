import { formatBRL, type PaletteKey } from '@spendly/shared'
import { useId, useState } from 'react'

import { Money } from '@/components/money/Money'

export interface DonutSlice {
  id: string
  label: string
  cents: number
  color: PaletteKey
}

// The design's donut: 168px, r 62, 16px ring, a 2px gap between slices.
const SIZE = 168
const RADIUS = 62
const RING = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * A ring of the month's spending. The slices are drawn as dashes of one circle, so there is
 * no chart library involved — and the colours come straight from the tone variables.
 *
 * Colour alone never identifies a slice: the list beside it carries name, icon and value.
 */
export function Donut({
  slices,
  totalCents,
  centerLabel = 'Total',
  activeId,
  onActivate,
  onSelect,
}: {
  slices: DonutSlice[]
  totalCents: number
  centerLabel?: string
  /** Highlighted from outside (hovering the ranked list). */
  activeId?: string | null
  onActivate?: (id: string | null) => void
  onSelect?: (id: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const titleId = useId()
  const active = activeId ?? hovered
  const focus = slices.find((slice) => slice.id === active)

  // Each slice starts where the previous ones ended, so the offsets are a running total.
  const arcs = slices.map((slice, index) => {
    const share = (cents: number) =>
      totalCents > 0 ? (CIRCUMFERENCE * Math.max(cents, 0)) / totalCents : 0
    const length = share(slice.cents)
    const start = slices
      .slice(0, index)
      .reduce((total, previous) => total + share(previous.cents), 0)
    return { slice, dash: `${Math.max(length - 2, 0.5)} ${CIRCUMFERENCE}`, offset: -start }
  })

  const highlight = (id: string | null) => {
    setHovered(id)
    onActivate?.(id)
  }

  return (
    <div className="relative size-42 shrink-0">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{`${centerLabel}: ${formatBRL(totalCents)}`}</title>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={RING}
          />
          {arcs.map(({ slice, dash, offset: dashOffset }) => (
            <circle
              key={slice.id}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={`var(--palette-${slice.color})`}
              strokeWidth={RING}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              opacity={active === null || active === slice.id ? 1 : 0.35}
              className={onSelect ? 'cursor-pointer transition-opacity duration-150' : undefined}
              onMouseEnter={() => highlight(slice.id)}
              onMouseLeave={() => highlight(null)}
              onClick={() => onSelect?.(slice.id)}
            />
          ))}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <span className="text-[11px] text-muted-foreground">{focus?.label ?? centerLabel}</span>
        <Money cents={focus?.cents ?? totalCents} size="lg" className="text-xl" />
      </div>
    </div>
  )
}
