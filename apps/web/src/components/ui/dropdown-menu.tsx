import { DropdownMenu as DropdownPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

import { floatingMotion } from './popover'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger
export const DropdownMenuGroup = DropdownPrimitive.Group

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-48 border border-border bg-background py-1 text-foreground shadow-raised outline-none',
          floatingMotion,
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  tone = 'default',
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item> & { tone?: 'default' | 'danger' }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex min-h-9 cursor-pointer items-center gap-2.5 px-3 text-sm outline-none select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        'data-[highlighted]:bg-primary/10 data-[highlighted]:text-steel-800',
        '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[highlighted]:[&_svg]:text-current',
        tone === 'danger' && 'font-medium',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn('px-3 py-2', className)} {...props} />
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn('my-1 h-px bg-border', className)} {...props} />
}
