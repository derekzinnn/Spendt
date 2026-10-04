import { HouseGlyph } from '@/components/layout/BrandMark'
import { APP_NAME } from '@/lib/brand'

/** Shown while the session or a lazy route loads on first visit. */
export function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <span className="flex animate-pulse flex-col items-center gap-2">
        <HouseGlyph className="size-10 text-steel" />
        <span className="font-display text-xl">{APP_NAME}</span>
      </span>
    </div>
  )
}
