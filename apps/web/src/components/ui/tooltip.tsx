import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

export const TooltipProvider = TooltipPrimitive.Provider

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 bg-emphasis px-2 py-1 text-xs text-emphasis-foreground shadow-raised',
          'animate-in duration-150 fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

/** Shorthand for the common "icon button with a label" case. */
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactNode
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipPrimitive.Root>
  )
}
