import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The headline numbers: equal cells separated by 1px rules (the grid is visible structure),
 * framed with registration marks. 1 → 2 → 4 columns as space allows.
 */
export function KpiGrid({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'blueprint grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
      {...props}
    />
  )
}

interface KpiCellProps {
  label: ReactNode
  icon?: ReactNode
  value: ReactNode
  sub?: ReactNode
  /** The forecast cell sits on the steel wash. */
  emphasis?: boolean
  /** Makes the whole cell a drill-down button. */
  onClick?: () => void
}

export function KpiCell({ label, icon, value, sub, emphasis = false, onClick }: KpiCellProps) {
  const className = cn(
    'flex flex-col gap-0.5 px-5 py-4.5 text-left',
    emphasis ? 'bg-steel-100 text-steel-800' : 'bg-background',
    onClick &&
      'cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--steel)_7%,var(--background))]',
  )
  const content = (
    <>
      <span
        className={cn(
          'flex items-center gap-1.5 text-xs [&_svg]:size-3.5',
          !emphasis && 'text-muted-foreground',
        )}
      >
        {icon}
        {label}
      </span>
      <span className="truncate">{value}</span>
      {sub ? (
        <span className={cn('text-xs', !emphasis && 'text-muted-foreground')}>{sub}</span>
      ) : null}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
