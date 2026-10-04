import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/cn'

/** The house drawn in one thin steel line. */
export function HouseGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
      className={cn('size-6 shrink-0', className)}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  )
}

/** "Casa" with the house glyph. `subtitle` sits under the name (e.g. the household). */
export function BrandMark({
  className,
  subtitle,
  inverted = false,
}: {
  className?: string
  subtitle?: string
  /** For the deep steel field (login panel): the glyph takes the paper colour. */
  inverted?: boolean
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <HouseGlyph className={inverted ? 'text-current' : 'text-steel'} />
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-xl leading-none">{APP_NAME}</span>
        {subtitle ? (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </span>
  )
}
