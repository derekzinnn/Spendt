import { toast } from 'sonner'

/**
 * The "Desfazer" pattern for destructive actions: do it right away, then give people a
 * generous window to take it back (instead of asking "tem certeza?" first).
 */
export function undoToast(
  message: string,
  { description, onUndo }: { description?: string; onUndo: () => void },
) {
  toast(message, {
    ...(description ? { description } : {}),
    duration: 6_000,
    action: { label: 'Desfazer', onClick: onUndo },
  })
}
