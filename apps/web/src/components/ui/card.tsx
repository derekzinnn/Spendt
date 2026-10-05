import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

/** A line drawing on the ground: transparent, hairline frame, "+" marks on the corners. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('blueprint border border-border text-foreground', className)} {...props} />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  // The content comes from whoever uses it; the rule can't see that far.
  // eslint-disable-next-line jsx-a11y/heading-has-content
  return <h3 className={cn('text-xl leading-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-border px-5 py-3', className)}
      {...props}
    />
  )
}

/** Small uppercase label above a title or a number. */
export function Kicker({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('kicker text-muted-foreground', className)} {...props} />
}
