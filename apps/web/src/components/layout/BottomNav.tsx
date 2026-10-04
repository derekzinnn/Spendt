import { LogOut, Plus } from 'lucide-react'
import { NavLink } from 'react-router'

import { ALL_NAV_ITEMS, BOTTOM_NAV_LEFT, BOTTOM_NAV_RIGHT, type NavItem } from '@/app/navigation'
import { MemberAvatar } from '@/components/member/MemberAvatar'
import { Money } from '@/components/money/Money'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useTotalBalance } from '@/features/accounts/api'
import { useHouseholdContext, useLogout } from '@/features/auth/api'
import { useQuickAdd } from '@/features/quick-add/QuickAddProvider'
import { cn } from '@/lib/cn'

import { PrivacyToggle, ThemeModeToggle } from './ShellControls'
import { navLinkClass } from './nav-link-class'

function Tab({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors focus-visible:outline-offset-[-2px]',
          isActive ? 'text-steel-700' : 'text-foreground',
        )
      }
    >
      <Icon className="size-5" />
      {item.shortLabel ?? item.label}
    </NavLink>
  )
}

/** Mobile bottom bar (< 900px): four destinations around the square quick-add button. */
export function BottomNav() {
  const { setOpen } = useQuickAdd()

  return (
    <nav
      aria-label="Principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background desk:hidden"
    >
      <div className="mx-auto grid h-16.5 max-w-lg grid-cols-5 items-center">
        {BOTTOM_NAV_LEFT.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
        <div className="grid place-items-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Lançamento rápido"
            className="-mt-5.5 grid size-14 cursor-pointer place-items-center bg-primary text-primary-foreground shadow-raised transition-colors duration-150 hover:bg-primary-hover active:bg-primary-pressed"
          >
            <Plus className="size-6" />
          </button>
        </div>
        {BOTTOM_NAV_RIGHT.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
      </div>
    </nav>
  )
}

/** Mobile "Mais": every section that isn't on the bottom bar, plus preferences and Sair. */
export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { household, members } = useHouseholdContext()
  const logout = useLogout()
  const balance = useTotalBalance()
  const onBar = [...BOTTOM_NAV_LEFT, ...BOTTOM_NAV_RIGHT]
  const items = ALL_NAV_ITEMS.filter((item) => !onBar.includes(item))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={household.name}
        description={members.map((m) => m.displayName).join(' & ')}
      >
        <nav aria-label="Mais seções" className="flex flex-col gap-0.5 px-3 py-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onOpenChange(false)}
                className={({ isActive }) => cn(navLinkClass(isActive), 'min-h-11')}
              >
                <Icon />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Saldo nas contas</span>
            {balance.total === undefined ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              <Money cents={balance.total} size="lg" tone="neutral" />
            )}
          </div>
          <span className="flex -space-x-1">
            {members.map((m) => (
              <MemberAvatar key={m.id} name={m.displayName} color={m.color} size="sm" />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-1 border-t border-border px-5 py-3">
          <Button
            variant="secondary"
            className="flex-1 justify-start"
            onClick={() => logout.mutate()}
          >
            <LogOut /> Sair da conta
          </Button>
          <PrivacyToggle />
          <ThemeModeToggle />
        </div>
      </SheetContent>
    </Sheet>
  )
}
