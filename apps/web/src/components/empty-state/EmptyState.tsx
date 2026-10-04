import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: ReactNode
  /** Primary next step. An empty state should always say what to do next. */
  action?: ReactNode
  secondaryAction?: ReactNode
  size?: 'md' | 'sm'
  className?: string
}

/**
 * What a screen shows when there is nothing yet: a thin steel line icon, a condensed title,
 * one sentence, and always the next useful action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className,
}: EmptyStateProps) {
  const small = size === 'sm'
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        small ? 'gap-2.5 px-4 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <Icon aria-hidden className={cn('text-steel', small ? 'size-7' : 'size-9')} />

      <div className={cn('flex max-w-sm flex-col', small ? 'gap-1' : 'gap-1.5')}>
        <h3 className={cn('text-balance', small ? 'text-lg' : 'text-xl')}>{title}</h3>
        {description ? (
          <p className={cn('text-pretty text-muted-foreground', small ? 'text-[13px]' : 'text-sm')}>
            {description}
          </p>
        ) : null}
      </div>

      {action || secondaryAction ? (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}
