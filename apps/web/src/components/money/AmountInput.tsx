import { formatCentsPlain, MAX_CENTS, parseBRL, type Cents } from '@spendly/shared'
import { useId, useLayoutEffect, useRef, type ClipboardEvent, type ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export interface AmountInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'type'
> {
  /** Integer cents, or null when empty. */
  value: Cents | null
  onChange: (cents: Cents | null) => void
  /** `hero` is the big amount-first field of quick add. */
  size?: 'md' | 'hero'
  /** Tints the field: `in` for income. */
  flow?: 'in' | 'out'
  maxCents?: Cents
  invalid?: boolean
}

/**
 * Money input that fills from the right, like a card machine: typing 1 → 2 → 3 → 4 gives
 * R$ 12,34. Works with the numeric keypad on phones (no comma hunting), and pasting
 * "R$ 1.234,56" or "1234.56" just works.
 *
 * The value is always integer cents — the input never holds a float.
 */
export function AmountInput({
  value,
  onChange,
  size = 'md',
  flow = 'out',
  maxCents = MAX_CENTS,
  invalid = false,
  className,
  id,
  placeholder = '0,00',
  onFocus,
  ...props
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const display = value === null ? '' : formatCentsPlain(value)

  // Keep the caret at the end: digits always enter from the right.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (input && document.activeElement === input) {
      input.setSelectionRange(display.length, display.length)
    }
  }, [display])

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
    if (digits === '') {
      // "0,00" and an empty field are the same thing: nothing typed yet.
      onChange(null)
      return
    }
    const cents = Number(digits)
    if (Number.isSafeInteger(cents) && cents <= maxCents) onChange(cents)
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const cents = parseBRL(event.clipboardData.getData('text'))
    if (cents !== null && cents >= 0 && cents <= maxCents) {
      event.preventDefault()
      onChange(cents)
    }
  }

  const hero = size === 'hero'

  return (
    <div
      className={cn(
        'group/amount flex items-baseline',
        hero
          ? cn(
              'cursor-text gap-1.5 border-b pb-1.5 font-display transition-[border-color] duration-150',
              invalid
                ? 'border-dashed border-foreground'
                : 'border-foreground focus-within:border-steel',
            )
          : cn(
              'h-(--control-h) cursor-text gap-1.5 border border-input bg-surface-sunken px-2.5 transition-[border-color] duration-150',
              'focus-within:border-steel hover:border-border-strong',
              invalid && 'border-dashed border-foreground',
            ),
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <span
        aria-hidden
        className={cn(
          'text-muted-foreground select-none',
          hero ? 'text-xl' : 'self-center text-sm',
        )}
      >
        R$
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="next"
        spellCheck={false}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        value={display}
        onChange={(event) => handleChange(event.target.value)}
        onPaste={handlePaste}
        onFocus={(event) => {
          const end = event.currentTarget.value.length
          event.currentTarget.setSelectionRange(end, end)
          onFocus?.(event)
        }}
        className={cn(
          'min-w-0 bg-transparent tabular-nums caret-steel outline-none placeholder:text-subtle-foreground',
          hero
            ? cn(
                'w-full flex-1 text-5xl leading-none',
                flow === 'in' ? 'text-positive' : 'text-foreground',
              )
            : 'font-money h-full w-full text-[15px]',
        )}
        {...props}
      />
      <span id={hintId} className="sr-only">
        Digite só os números; os dois últimos são os centavos.
      </span>
    </div>
  )
}
