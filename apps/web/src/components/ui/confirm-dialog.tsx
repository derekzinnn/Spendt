import { AlertDialog } from 'radix-ui'
import type { ReactNode } from 'react'

import { Button } from './button'
import { overlayClassName } from './sheet'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  pending?: boolean
  tone?: 'danger' | 'default'
}

/**
 * For the rare actions that can't be undone. Everything else uses a "Desfazer" toast
 * instead of asking first.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  tone = 'danger',
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClassName} />
        <AlertDialog.Content className="blueprint fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-border bg-background p-6 shadow-overlay data-[state=open]:animate-in data-[state=open]:duration-220 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-3">
          <AlertDialog.Title className="font-display text-xl">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-pretty text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancelar</Button>
            </AlertDialog.Cancel>
            <Button
              variant={tone === 'danger' ? 'destructive' : 'primary'}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
