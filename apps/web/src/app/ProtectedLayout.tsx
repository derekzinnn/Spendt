import { useQuery } from '@tanstack/react-query'
import { HousePlus } from 'lucide-react'
import { Navigate, useLocation } from 'react-router'

import { EmptyState } from '@/components/empty-state/EmptyState'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { meQueryOptions, useLogout } from '@/features/auth/api'
import { QuickAddProvider } from '@/features/quick-add/QuickAddProvider'
import { MonthProvider } from '@/lib/month'

import { BootScreen } from './BootScreen'
import { ROUTES } from './navigation'

function NoHousehold() {
  const logout = useLogout()
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        icon={HousePlus}
        title="Você não está em nenhuma casa"
        description="Peça um novo convite para quem administra a casa de vocês."
        action={
          <Button variant="secondary" onClick={() => logout.mutate()}>
            Sair
          </Button>
        }
      />
    </div>
  )
}

/** Everything behind login. Reacts if the session ends while the app is open. */
export function ProtectedLayout() {
  const { data: me } = useQuery(meQueryOptions)
  const location = useLocation()

  if (me === null) {
    const next = location.pathname + location.search
    return <Navigate to={`${ROUTES.login}?next=${encodeURIComponent(next)}`} replace />
  }
  if (!me) return <BootScreen />
  if (!me.household) return <NoHousehold />

  return (
    <MonthProvider>
      <QuickAddProvider>
        <AppShell />
      </QuickAddProvider>
    </MonthProvider>
  )
}
