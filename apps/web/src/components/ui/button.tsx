import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

/**
 * Buttons are drawn objects: square, hairline, condensed type. The primary is the one solid
 * thing on the board — a steel fill that keeps the "+" registration marks.
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border font-display leading-tight whitespace-nowrap select-none',
    'transition-[background-color,border-color,color] duration-150 ease-out-soft',
    'disabled:cursor-not-allowed disabled:opacity-45',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  ],
  {
    variants: {
      variant: {
        primary:
          'blueprint border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover active:border-primary-pressed active:bg-primary-pressed',
        secondary:
          'border-border text-foreground hover:bg-foreground/7 active:bg-foreground/14 aria-expanded:bg-foreground/7',
        soft: 'border-transparent bg-primary-soft text-primary-soft-foreground hover:bg-steel-200 active:bg-steel-300',
        ghost:
          'border-transparent text-primary hover:bg-primary/10 active:bg-primary/18 aria-expanded:bg-primary/10',
        /** Neutral icon actions in rows and toolbars. */
        quiet:
          'border-transparent text-muted-foreground hover:bg-foreground/7 hover:text-foreground active:bg-foreground/14 aria-expanded:bg-foreground/7 aria-expanded:text-foreground',
        outline: 'border-border-strong text-foreground hover:bg-foreground/7',
        /** Irreversible actions stay ink — the icon and the word carry the warning, not red. */
        destructive:
          'border-foreground bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/75',
        link: 'h-auto border-transparent px-0 font-sans text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-2.5 text-[13px]',
        md: 'h-(--control-h) px-3.5 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'size-(--control-h)',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router <Link>) with button styles. */
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button'
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...(!asChild ? { type: type ?? 'button' } : {})}
      {...props}
    />
  )
}
