import { createBrowserRouter, type RouteObject } from 'react-router'

import type { RouteHandle } from '@/components/layout/AppShell'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'

import { BootScreen } from './BootScreen'
import { guestOnlyLoader, requireSessionLoader, sessionAwareLoader } from './loaders'
import { ALL_NAV_ITEMS, ROUTES } from './navigation'
import { NotFoundPage } from './NotFoundPage'
import { ProtectedLayout } from './ProtectedLayout'
import { RouteErrorPage } from './RouteErrorPage'

const title = (value: string, monthly = false) => ({ title: value, monthly }) satisfies RouteHandle

/**
 * Screens are code-split: the first paint carries the shell and the dashboard, and each
 * other screen (with its grid, charts, sheets or spreadsheet reader) arrives when it is
 * opened. React Router's `lazy` keeps the loaders and handles synchronous.
 */
const lazyRoute = (
  load: () => Promise<Record<string, React.ComponentType>>,
  name: string,
): ScreenRoute => ({
  lazy: () => load().then((module) => ({ Component: module[name]! })),
})

/** What a screen contributes to its route: the component, eagerly or on demand. */
type ScreenRoute = Pick<RouteObject, 'element' | 'lazy'>

/** Screens that are real now; the rest of the navigation still shows its roadmap phase. */
const BUILT: Record<string, ScreenRoute> = {
  [ROUTES.dashboard]: { element: <DashboardPage /> },
  [ROUTES.accounts]: lazyRoute(() => import('@/features/accounts/AccountsPage'), 'AccountsPage'),
  [ROUTES.cards]: lazyRoute(() => import('@/features/cards/CardsPage'), 'CardsPage'),
  [ROUTES.transactions]: lazyRoute(
    () => import('@/features/transactions/TransactionsPage'),
    'TransactionsPage',
  ),
  [ROUTES.bills]: lazyRoute(() => import('@/features/bills/BillsPage'), 'BillsPage'),
  [ROUTES.incomes]: lazyRoute(() => import('@/features/incomes/IncomesPage'), 'IncomesPage'),
  [ROUTES.categories]: lazyRoute(
    () => import('@/features/categories/CategoriesPage'),
    'CategoriesPage',
  ),
  [ROUTES.import]: lazyRoute(() => import('@/features/import/ImportPage'), 'ImportPage'),
  [ROUTES.settings]: lazyRoute(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
}

const appRoutes: RouteObject[] = ALL_NAV_ITEMS.filter((item) => item.to !== ROUTES.design).map(
  (item): RouteObject => {
    const route = {
      ...(BUILT[item.to] ?? { element: <PlaceholderPage item={item} /> }),
      handle: title(item.label, item.monthly),
    }
    return item.to === ROUTES.dashboard
      ? { index: true, ...route }
      : { path: item.to.slice(1), ...route }
  },
)

export const router = createBrowserRouter([
  {
    hydrateFallbackElement: <BootScreen />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: ROUTES.login, loader: guestOnlyLoader, element: <LoginPage /> },
      { path: ROUTES.register, loader: guestOnlyLoader, element: <RegisterPage /> },
      { path: ROUTES.invite, loader: sessionAwareLoader, element: <AcceptInvitePage /> },
      {
        path: '/',
        loader: requireSessionLoader,
        element: <ProtectedLayout />,
        children: [
          ...appRoutes,
          {
            path: `${ROUTES.cards.slice(1)}/:cardId`,
            ...lazyRoute(() => import('@/features/cards/CardsPage'), 'CardsPage'),
            handle: title('Cartões & Faturas', true),
          },
          {
            // The showcase pulls in Recharts, which no other screen needs.
            path: ROUTES.design.slice(1),
            ...lazyRoute(
              () => import('@/features/design-showcase/DesignShowcasePage'),
              'DesignShowcasePage',
            ),
            handle: title('Sistema de design'),
          },
          { path: '*', element: <NotFoundPage />, handle: title('Página não encontrada') },
        ],
      },
    ],
  },
])
