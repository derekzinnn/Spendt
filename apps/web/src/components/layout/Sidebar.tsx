import { Check, ChevronsUpDown, LogOut } from 'lucide-react'
import { NavLink } from 'react-router'
import { toast } from 'sonner'

import { NAV_SECTIONS, type NavItem } from '@/app/navigation'
import { MemberAvatar } from '@/components/member/MemberAvatar'
import { Money } from '@/components/money/Money'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/misc'
import { useTotalBalance } from '@/features/accounts/api'
import { useHouseholdContext, useLogout, useSwitchHousehold } from '@/features/auth/api'

import { BrandMark } from './BrandMark'
import { navLinkClass } from './nav-link-class'
import { PrivacyToggle, ThemeModeToggle } from './ShellControls'

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => navLinkClass(isActive)}
    >
      <Icon />
      <span className="flex-1 truncate">{item.label}</span>
    </NavLink>
  )
}

/** Brand + household name; with several households it becomes the switcher. */
function HouseholdHeader() {
  const { household, memberships } = useHouseholdContext()
  const switchHousehold = useSwitchHousehold()

  if (memberships.length < 2) {
    return <BrandMark subtitle={household.name} className="px-4 py-4.5" />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-4.5 text-left transition-colors hover:bg-foreground/6 aria-expanded:bg-foreground/6"
        >
          <BrandMark subtitle={household.name} className="flex-1" />
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-60">
        <DropdownMenuLabel className="kicker text-muted-foreground">
          Trocar de casa
        </DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.householdId}
            onSelect={() => {
              if (m.householdId === household.id) return
              switchHousehold.mutate(
                { householdId: m.householdId },
                { onSuccess: (me) => toast.success(`Você está em “${me.household?.name ?? ''}”`) },
              )
            }}
          >
            <span className="flex-1 truncate">{m.householdName}</span>
            {m.householdId === household.id ? <Check className="text-primary!" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Desktop sidebar (≥ 900px): brand, grouped navigation, the household's balance and people. */
export function Sidebar() {
  const { members } = useHouseholdContext()
  const logout = useLogout()
  const balance = useTotalBalance()

  return (
    <aside className="sticky top-0 hidden h-dvh w-63 shrink-0 flex-col overflow-y-auto border-r border-border desk:flex">
      <div className="border-b border-border">
        <HouseholdHeader />
      </div>

      <nav aria-label="Principal" className="flex flex-col gap-0.5 px-2.5 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <p className="kicker px-2 pt-3.5 pb-1.5 text-muted-foreground">{section.title}</p>
            {section.items.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-border p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Saldo nas contas</span>
          {balance.total === undefined ? (
            balance.loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )
          ) : (
            <Money cents={balance.total} size="lg" tone="neutral" />
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="flex -space-x-1">
            {members.map((m) => (
              <MemberAvatar key={m.id} name={m.displayName} color={m.color} size="sm" />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {members.map((m) => m.displayName).join(' & ')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            className="flex-1 justify-start"
            onClick={() => logout.mutate()}
          >
            <LogOut /> Sair
          </Button>
          <PrivacyToggle />
          <ThemeModeToggle />
        </div>
      </div>
    </aside>
  )
}
