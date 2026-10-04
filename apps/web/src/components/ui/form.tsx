import { ChevronDown, CircleAlert } from 'lucide-react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { inputClassName, Label } from './input'

interface FieldProps {
  label: ReactNode
  htmlFor?: string
  error?: string | undefined
  hint?: ReactNode
  /** Right side of the label row (e.g. "Esqueci a senha"). */
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Label + control + hint/error, with the error announced to screen readers. */
export function Field({ label, htmlFor, error, hint, aside, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-1 text-xs font-medium text-foreground">
          <CircleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/** Styled native <select>: accessible and uses the phone's own picker. */
export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(inputClassName, 'cursor-pointer appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-primary" />
    </div>
  )
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center border border-border-strong p-0.75 transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 bg-foreground/70 transition-[translate,background-color] duration-150 ease-out-soft data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  )
}

/** Big tappable radio chips — thumb-friendly alternative to a select for few options. */
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: ReactNode; icon?: ReactNode }[]
  name: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-(--control-h) cursor-pointer items-center gap-1.5 border px-2.5 text-[13px] transition-colors duration-150 [&_svg]:size-3.5',
              selected
                ? 'border-steel bg-steel-100 text-steel-800'
                : 'border-border text-foreground hover:bg-foreground/7',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
