import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

/**
 * Small square tag. Meaning is never carried by color alone (there is only steel and ink):
 * pass an icon and/or a word ("Vencida", "Paga") along with the tone.
 */
export const badgeVariants = cva(
  'inline-flex h-5.5 items-center gap-1 px-2 text-[11px] leading-none tracking-[0.02em] whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-graphite-100 text-graphite-900 dark:bg-graphite-200',
        primary: 'bg-steel-100 text-steel-800',
        positive: 'bg-steel-100 text-steel-800',
        /** Problems: an ink outline + icon/word (no red in this system). */
        negative: 'border border-foreground text-foreground',
        /** Needs attention soon: the strongest steel fill. */
        warning: 'bg-emphasis text-emphasis-foreground',
        info: 'bg-steel-100 text-steel-800',
        outline: 'border border-steel text-steel-700',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
