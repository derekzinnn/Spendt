import { Separator as SeparatorPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

/** Placeholder while data loads. Shapes should mirror the content they stand for. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden bg-muted',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-linear-to-r after:from-transparent after:via-background/60 after:to-transparent',
        className,
      )}
      {...props}
    />
  )
}

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center border border-border px-1.5 font-sans text-[11px] leading-none text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
