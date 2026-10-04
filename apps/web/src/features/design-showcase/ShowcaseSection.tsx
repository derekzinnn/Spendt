import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface ShowcaseSectionProps {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function ShowcaseSection({
  id,
  title,
  description,
  children,
  className,
}: ShowcaseSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-32 border-t border-border pt-7', className)}
    >
      <div className="mb-6 flex flex-col gap-1.5">
        <h2 id={`${id}-title`} className="text-[2rem]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-[15px] text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function Specimen({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="kicker text-steel-700">{label}</p>
      {children}
    </div>
  )
}
