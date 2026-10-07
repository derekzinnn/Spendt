import { useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router'

import { APP_NAME } from '@/lib/brand'

import { AppHeader } from './AppHeader'
import { BottomNav, MoreSheet } from './BottomNav'
import { Sidebar } from './Sidebar'

export interface RouteHandle {
  title: string
  /** The screen reads the shared month: the header shows the month picker. */
  monthly?: boolean
}

function useRouteHandle(): RouteHandle {
  const matches = useMatches()
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const handle = matches[index]?.handle as RouteHandle | undefined
    if (handle?.title) return handle
  }
  return { title: APP_NAME }
}

/**
 * The frame around every screen:
 *  • ≥ 900px — 252px sidebar + sticky header with month, search and "Lançamento"
 *  • < 900px — sticky header + bottom bar with the square quick-add button
 */
export function AppShell() {
  const { title, monthly = false } = useRouteHandle()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`
  }, [title])

  return (
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="fixed top-2 left-2 z-50 -translate-y-20 bg-primary px-3 py-2 text-sm text-primary-foreground focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={title} monthly={monthly} onOpenMore={() => setMoreOpen(true)} />

        <main
          key={pathname}
          id="conteudo"
          className="flex w-full animate-page-in flex-col gap-7 px-4 pt-5 pb-28 desk:px-6 desk:pt-6 desk:pb-14"
        >
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <ScrollRestoration />
    </div>
  )
}
