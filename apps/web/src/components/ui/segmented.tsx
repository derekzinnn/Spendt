import { ToggleGroup } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when `label` is only an icon. */
  ariaLabel?: string
}

interface SegmentedProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  size?: 'sm' | 'md'
  /** Stretch the options to equal widths filling the container. */
  fill?: boolean
  className?: string
  'aria-label': string
}

/**
 * A single-choice segmented control (radio-like), keyboard navigable with arrows.
 * Hairline box split by rules; the chosen option is the solid steel cell.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
  fill = false,
  className,
  ...props
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T)
      }}
      className={cn(
        'border border-border',
        fill ? 'grid auto-cols-fr grid-flow-col' : 'inline-flex items-stretch',
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          className={cn(
            'inline-flex cursor-pointer items-center justify-center gap-1.5 text-foreground transition-colors duration-150 not-first:border-l not-first:border-border',
            'not-data-[state=on]:hover:bg-foreground/7 focus-visible:outline-offset-[-2px]',
            'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
            '[&_svg]:size-4',
            size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-(--control-h) px-3 text-[13px]',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
