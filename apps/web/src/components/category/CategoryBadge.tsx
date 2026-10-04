import type { CategoryIconKey, PaletteKey } from '@spendly/shared'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

import { CATEGORY_ICONS } from './category-icons'
import { paletteStyle } from './palette-style'

const tileVariants = cva('inline-grid shrink-0 place-items-center', {
  variants: {
    size: {
      xs: 'size-5 [&_svg]:size-3',
      sm: 'size-5.5 [&_svg]:size-3.5',
      md: 'size-9 [&_svg]:size-[18px]',
      lg: 'size-11 [&_svg]:size-5',
    },
    variant: {
      solid: 'bg-(--tint) text-(--tint-fg)',
      soft: 'bg-(--tint-soft) text-(--tint-ink)',
    },
  },
  defaultVariants: { size: 'md', variant: 'solid' },
})

export interface CategoryIconProps
  extends Omit<ComponentProps<'span'>, 'color'>, VariantProps<typeof tileVariants> {
  icon: CategoryIconKey
  color: PaletteKey
}

/** The category's icon on a square tone tile — the leading visual in lists and grids. */
export function CategoryIcon({
  icon,
  color,
  size,
  variant,
  className,
  style,
  ...props
}: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[icon]
  return (
    <span
      aria-hidden
      className={cn(tileVariants({ size, variant }), className)}
      style={{ ...paletteStyle(color), ...style }}
      {...props}
    >
      <Icon />
    </span>
  )
}

const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap transition-colors',
  {
    variants: {
      size: {
        sm: 'h-6 pr-2 pl-0.5 text-xs',
        md: 'h-8 pr-2.5 pl-1 text-[13px]',
      },
      variant: {
        soft: 'bg-(--tint-soft) text-foreground',
        outline: 'border border-border text-foreground',
        plain: 'pl-0 text-foreground',
      },
    },
    defaultVariants: { size: 'md', variant: 'soft' },
  },
)

export interface CategoryBadgeProps
  extends Omit<ComponentProps<'span'>, 'color'>, VariantProps<typeof badgeVariants> {
  name: string
  icon: CategoryIconKey
  color: PaletteKey
  /** Parent category name, shown as a quiet prefix ("Moradia › Aluguel"). */
  parentName?: string
}

/**
 * A category as a chip. Identity is name + icon + colour together, so it never relies
 * on colour alone.
 */
export function CategoryBadge({
  name,
  icon,
  color,
  parentName,
  size = 'md',
  variant,
  className,
  style,
  ...props
}: CategoryBadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ size, variant }), className)}
      style={{ ...paletteStyle(color), ...style }}
      {...props}
    >
      <CategoryIcon icon={icon} color={color} variant="solid" size={size === 'sm' ? 'xs' : 'sm'} />
      <span className="truncate">
        {parentName ? <span className="text-muted-foreground">{parentName} › </span> : null}
        {name}
      </span>
    </span>
  )
}
