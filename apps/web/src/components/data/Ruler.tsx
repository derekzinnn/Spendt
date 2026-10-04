import { BUDGET_ALERT_THRESHOLDS_BPS } from '@spendly/shared'

import { cn } from '@/lib/cn'

const ALERT_PCT = BUDGET_ALERT_THRESHOLDS_BPS[0] / 100

/**
 * A measuring bar drawn like a ruler: hairline box, steel fill, an ink tick at the 80% alert
 * line. Past 100% the fill turns the deepest steel — the label beside it says "estourou".
 */
export function Ruler({
  value,
  max,
  tick = true,
  className,
  label,
}: {
  value: number
  max: number
  /** Show the alert tick (budgets); off for plain usage bars (card limit). */
  tick?: boolean
  className?: string
  /** Accessible description, e.g. "R$ 120,00 de R$ 200,00". */
  label: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('relative h-1.5 border border-border', className)}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-0 origin-left animate-grow-x',
          pct > 100 || (tick && pct >= 100) ? 'bg-steel-900' : 'bg-steel',
        )}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      {tick ? (
        <div
          aria-hidden
          className="absolute -top-[3px] -bottom-[3px] w-px bg-foreground"
          style={{ left: `${ALERT_PCT}%` }}
        />
      ) : null}
    </div>
  )
}
