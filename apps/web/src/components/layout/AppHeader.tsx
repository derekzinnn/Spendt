import { Menu, Plus, Search } from 'lucide-react'

import { MonthPicker } from '@/components/month-picker/MonthPicker'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { useQuickAdd } from '@/features/quick-add/QuickAddProvider'
import { useMonth } from '@/lib/month'

import { PrivacyToggle } from './ShellControls'

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.userAgent)

/**
 * The sticky bar on top of every screen: the page title (the page's <h1>), the shared month
 * when the screen is monthly, and the ways in to quick add. Below 900px the month drops to
 * its own row and "Mais" opens the sections that don't fit the bottom bar.
 */
export function AppHeader({
  title,
  monthly,
  onOpenMore,
}: {
  title: string
  monthly: boolean
  onOpenMore: () => void
}) {
  const { setOpen, setPaletteOpen } = useQuickAdd()
  const { month, setMonth } = useMonth()

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border bg-background px-4 py-2.5 desk:px-6 desk:py-3.5">
      <h1 className="mr-auto min-w-0 truncate text-[22px] leading-tight desk:text-[25px]">
        {title}
      </h1>

      {monthly ? (
        <MonthPicker
          value={month}
          onChange={setMonth}
          className="order-last w-full sm:order-none sm:w-auto"
        />
      ) : null}

      <div className="hidden items-center gap-3 desk:flex">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-(--control-h) min-w-52 cursor-pointer items-center gap-2 border border-border px-2.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:border-steel"
        >
          <Search className="size-3.5" />
          Lançar ou buscar
          <span className="ml-auto flex gap-0.5">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <Button onClick={() => setOpen(true)}>
          <Plus /> Lançamento
        </Button>
      </div>

      <div className="flex items-center gap-1 desk:hidden">
        <Button
          variant="quiet"
          size="icon"
          aria-label="Lançar ou buscar"
          onClick={() => setPaletteOpen(true)}
        >
          <Search />
        </Button>
        <PrivacyToggle />
        <Button variant="secondary" size="icon" aria-label="Mais seções" onClick={onOpenMore}>
          <Menu />
        </Button>
      </div>
    </header>
  )
}
