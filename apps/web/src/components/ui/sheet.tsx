import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

/** Graphite at 50% — the only thing that dims the board. */
export const overlayClassName = cn(
  'fixed inset-0 z-50 bg-graphite-900/50 dark:bg-black/60',
  'data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:fade-in-0',
  'data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:fade-out-0',
)

const sheetVariants = cva(
  [
    'fixed z-50 flex flex-col bg-background text-foreground shadow-overlay outline-none',
    'data-[state=open]:animate-in data-[state=open]:duration-220 data-[state=open]:ease-out-soft',
    'data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:ease-in-soft',
  ],
  {
    variants: {
      side: {
        bottom:
          'pb-safe inset-x-0 bottom-0 max-h-[92dvh] border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        right:
          'inset-y-0 right-0 h-full w-full max-w-md border-l border-border data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-4 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-4',
        center:
          'blueprint top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 border border-border data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-3',
      },
    },
    defaultVariants: { side: 'bottom' },
  },
)

interface SheetContentProps
  extends ComponentProps<typeof DialogPrimitive.Content>, VariantProps<typeof sheetVariants> {
  title: string
  description?: string
  /** Visually hide the header (it stays available to screen readers). */
  hideHeader?: boolean
}

export function SheetContent({
  side,
  title,
  description,
  hideHeader = false,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClassName} />
      <DialogPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        <div
          className={cn(
            'flex items-start gap-3 border-b border-border px-5 pt-4 pb-3',
            hideHeader && 'sr-only',
          )}
        >
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="font-display text-xl leading-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="-mr-2 grid size-9 shrink-0 cursor-pointer place-items-center text-primary transition-colors hover:bg-primary/10"
            aria-label="Fechar"
          >
            <X className="size-4.5" />
          </DialogPrimitive.Close>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
