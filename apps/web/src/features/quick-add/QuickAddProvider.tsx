import { Dialog } from 'radix-ui'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'

import { overlayClassName } from '@/components/ui/sheet'
import { CommandPalette } from '@/features/command-palette/CommandPalette'

import { QuickAddForm } from './QuickAddForm'

interface QuickAddContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  /** The Ctrl/⌘+K palette: launch, jump, search. */
  setPaletteOpen: (open: boolean) => void
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null)

/**
 * Quick add is reachable from anywhere: the mobile square button, "+ Lançamento" and the
 * Ctrl/⌘+K palette (which also jumps to screens and searches transactions).
 *
 * A blueprint dialog: docked to the bottom on phones (one-thumb reach), centred on desktop.
 */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(false)
        setPaletteOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen, setPaletteOpen }), [open])

  return (
    <QuickAddContext value={value}>
      {children}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onQuickAdd={() => setOpen(true)}
      />
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={overlayClassName} />
          <Dialog.Content
            aria-describedby={undefined}
            className="blueprint fixed inset-x-3 bottom-3 z-50 border border-border bg-background shadow-overlay outline-none data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:duration-220 data-[state=open]:ease-out-soft data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 desk:inset-x-auto desk:top-1/2 desk:bottom-auto desk:left-1/2 desk:w-120 desk:-translate-x-1/2 desk:-translate-y-1/2"
          >
            <Dialog.Title className="sr-only">Novo lançamento</Dialog.Title>
            {/* The scroll lives inside, so the frame's corner marks are never clipped. */}
            <div className="relative max-h-[calc(100dvh-1.5rem-2px)] overflow-y-auto p-4">
              <QuickAddForm onDone={() => setOpen(false)} onClose={() => setOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </QuickAddContext>
  )
}

export function useQuickAdd() {
  const context = use(QuickAddContext)
  if (!context) throw new Error('useQuickAdd must be used inside <QuickAddProvider>')
  return context
}
