import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Toaster as Sonner } from 'sonner'

import { useTheme } from '@/lib/theme'

/**
 * App-wide toasts: the deep steel field, paper type, one outlined action. Destructive actions
 * use `undoToast()` — the "Desfazer" pattern every delete in the app follows.
 */
export function Toaster() {
  const { resolvedMode } = useTheme()
  return (
    <Sonner
      theme={resolvedMode}
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: 84 }}
      gap={8}
      duration={6000}
      icons={{
        success: <CircleCheck className="size-4" />,
        error: <CircleAlert className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        info: <Info className="size-4" />,
      }}
      style={
        {
          '--normal-bg': 'var(--emphasis)',
          '--normal-text': 'var(--emphasis-foreground)',
          '--normal-border': 'var(--emphasis)',
          '--success-bg': 'var(--emphasis)',
          '--success-text': 'var(--emphasis-foreground)',
          '--success-border': 'var(--emphasis)',
          '--error-bg': 'var(--emphasis)',
          '--error-text': 'var(--emphasis-foreground)',
          '--error-border': 'var(--emphasis)',
          '--border-radius': '0px',
          '--width': '380px',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            '!font-sans !shadow-overlay !gap-3 !py-2.5 !pr-3 !pl-4 !min-h-12 data-[type=error]:!outline data-[type=error]:!outline-1 data-[type=error]:!outline-emphasis-muted',
          title: '!font-normal !text-sm',
          description: '!text-emphasis-muted !text-[13px]',
          actionButton:
            '!bg-transparent !text-emphasis-foreground !border !border-emphasis-foreground/40 !rounded-none !h-8 !px-3 !font-display !text-sm hover:!bg-emphasis-foreground/10',
          cancelButton: '!bg-transparent !text-emphasis-muted !rounded-none',
        },
      }}
    />
  )
}
