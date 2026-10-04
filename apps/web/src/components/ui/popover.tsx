import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

/** Floating panels share one motion: a short fade with a 4px rise from the trigger side. */
export const floatingMotion = cn(
  'data-[state=open]:animate-in data-[state=open]:duration-150 data-[state=open]:fade-in-0',
  'data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:fade-out-0',
  'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
  'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
)

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 border border-border bg-background p-3 text-foreground shadow-raised outline-none',
          floatingMotion,
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
