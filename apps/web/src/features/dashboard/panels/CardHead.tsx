import type { ReactNode } from 'react'

/** Card heading row: condensed title on the left, a quiet note or link on the right. */
export function CardHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xl">{title}</h2>
      {aside}
    </div>
  )
}
