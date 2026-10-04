import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface PageHeaderProps {
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * The line under the app header: what this screen is for, and its own actions. The page
 * title itself lives in the sticky header (it is the page's <h1>).
 */
export function PageHeader({ description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      {description ? (
        <p className="max-w-2xl text-[15px] text-pretty text-muted-foreground">{description}</p>
      ) : (
        <span />
      )}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}
