import { Label as LabelPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export const inputClassName = cn(
  'h-(--control-h) w-full min-w-0 border border-input bg-surface-sunken px-2.5 text-sm text-foreground caret-steel',
  'placeholder:text-subtle-foreground',
  'transition-[border-color] duration-150',
  'hover:border-border-strong focus-visible:border-steel focus-visible:outline-offset-0',
  'aria-invalid:border-dashed aria-invalid:border-foreground',
  'disabled:cursor-not-allowed disabled:opacity-45',
)

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(inputClassName, className)} {...props} />
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-xs text-foreground/70 select-none', className)}
      {...props}
    />
  )
}

export function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />
}
