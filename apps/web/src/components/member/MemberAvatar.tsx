import type { PaletteKey } from '@spendly/shared'

import { paletteStyle } from '@/components/category/palette-style'
import { cn } from '@/lib/cn'

export interface MemberAvatarProps {
  name: string
  color: PaletteKey
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

/** A household member: initial on their tone, square. Name is always available as a tooltip/label. */
export function MemberAvatar({ name, color, size = 'sm', className }: MemberAvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      style={paletteStyle(color)}
      className={cn(
        'inline-grid shrink-0 place-items-center bg-(--tint) font-medium text-(--tint-fg) ring-2 ring-background',
        size === 'xs' && 'size-5 text-[10px]',
        size === 'sm' && 'size-7 text-xs',
        size === 'md' && 'size-9 text-sm',
        className,
      )}
    >
      {name.trim().charAt(0).toLocaleUpperCase('pt-BR')}
    </span>
  )
}
