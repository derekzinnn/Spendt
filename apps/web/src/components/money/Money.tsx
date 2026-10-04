import { formatBRL, formatMoneyParts, type Cents } from '@spendly/shared'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'
import { usePrivacy } from '@/lib/privacy'

type MoneySize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

export interface MoneyProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** Integer cents. May be negative for balances. */
  cents: Cents
  size?: MoneySize
  /**
   * Direction of the money, for amounts stored as positive numbers:
   * `in` renders "+R$" in the positive tone, `out` renders the plain amount (or "-R$"
   * with `signed`). Omit for balances, where the sign of `cents` decides.
   */
  flow?: 'in' | 'out'
  /** Show an explicit sign for positive values / outflows. */
  signed?: boolean
  /**
   * Colour by meaning. `auto`: income in deep steel with "+", everything else ink (a negative
   * balance carries "−" — never red; this system has no red/green).
   */
  tone?: 'auto' | 'neutral' | 'muted'
  /** "R$ 1,2 mil" — for chart labels and tight spaces. */
  compact?: boolean
  /** Ignore "Ocultar valores" (e.g. inside an input preview). */
  alwaysVisible?: boolean
}

const sizeClasses: Record<MoneySize, string> = {
  sm: 'text-[13px] font-money',
  md: 'text-[15px] font-money',
  lg: 'font-display text-2xl leading-tight tabular-nums lining-nums',
  xl: 'font-display text-[1.875rem] leading-[1.1] tabular-nums lining-nums',
  hero: 'font-display text-[2.75rem] leading-none tabular-nums lining-nums sm:text-5xl',
}

/** Condensed display sizes get a quieter currency symbol, like a printed spec sheet. */
const isDisplay = (size: MoneySize) => size === 'lg' || size === 'xl' || size === 'hero'

const MINUS = '\u2212'

/**
 * The only way amounts are rendered in Spendly: BRL, tabular figures, accessible, and
 * aware of "Ocultar valores". Never colour-only — inflows carry a "+" sign.
 */
export function Money({
  cents,
  size = 'md',
  flow,
  signed = false,
  tone = 'auto',
  compact = false,
  alwaysVisible = false,
  className,
  ...props
}: MoneyProps) {
  const { hidden } = usePrivacy()

  const value = flow === 'out' ? -Math.abs(cents) : flow === 'in' ? Math.abs(cents) : cents
  const showPlus = flow === 'in' || (signed && value > 0)
  const showMinus = value < 0 && (flow !== 'out' || signed)
  const sign = showMinus ? MINUS : showPlus ? '+' : ''

  const toneClass =
    tone === 'muted'
      ? 'text-muted-foreground'
      : tone === 'neutral'
        ? 'text-foreground'
        : value > 0 && flow === 'in'
          ? 'text-positive font-medium'
          : 'text-foreground'

  const spoken = formatBRL(Math.abs(value), { compact })
  const spokenSign = showMinus ? 'menos ' : showPlus ? 'mais ' : ''

  if (hidden && !alwaysVisible) {
    return (
      <span
        className={cn(
          'inline-flex items-baseline whitespace-nowrap',
          sizeClasses[size],
          'text-muted-foreground',
          className,
        )}
        {...props}
      >
        <span className="sr-only">Valor oculto</span>
        <span aria-hidden className="tracking-[0.15em] select-none">
          R$ ••••
        </span>
      </span>
    )
  }

  if (compact || !isDisplay(size)) {
    const text = formatBRL(Math.abs(value), { compact }).replace(/^R\$\s?/, 'R$\u00A0')
    return (
      <span className={cn('whitespace-nowrap', sizeClasses[size], toneClass, className)} {...props}>
        <span className="sr-only">{spokenSign + spoken}</span>
        <span aria-hidden>
          {sign}
          {text}
        </span>
      </span>
    )
  }

  const parts = formatMoneyParts(Math.abs(value))
  return (
    <span
      className={cn(
        'inline-flex items-baseline whitespace-nowrap',
        sizeClasses[size],
        toneClass,
        className,
      )}
      {...props}
    >
      <span className="sr-only">{spokenSign + spoken}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {sign ? <span className="mr-0.5">{sign}</span> : null}
        <span className="mr-[0.22em] text-[0.62em] opacity-60">{parts.symbol}</span>
        <span>{parts.integer}</span>
        <span>
          {parts.decimal}
          {parts.fraction}
        </span>
      </span>
    </span>
  )
}
