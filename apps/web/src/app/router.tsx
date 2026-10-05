import { createBrowserRouter, type RouteObject } from 'react-router'

import type { RouteHandle } from '@/components/layout/AppShell'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { BillsPage } from '@/features/bills/BillsPage'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { CardsPage } from '@/features/cards/CardsPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { IncomesPage } from '@/features/incomes/IncomesPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TransactionsPage } from '@/features/transactions/TransactionsPage'

import { BootScreen } from './BootScreen'
import { guestOnlyLoader, requireSessionLoader, sessionAwareLoader } from './loaders'
import { ALL_NAV_ITEMS, ROUTES } from './navigation'
import { NotFoundPage } from './NotFoundPage'
import { ProtectedLayout } from './ProtectedLayout'
import { RouteErrorPage } from './RouteErrorPage'

const title = (value: string, monthly = false) => ({ title: value, monthly }) satisfies RouteHandle

/** Screens that are real now; the rest of the navigation still shows its roadmap phase. */
const BUILT: Record<string, RouteObject['element']> = {
  [ROUTES.dashboard]: <DashboardPage />,
  [ROUTES.accounts]: <AccountsPage />,
  [ROUTES.cards]: <CardsPage />,
  [ROUTES.transactions]: <TransactionsPage />,
  [ROUTES.bills]: <BillsPage />,
  [ROUTES.incomes]: <IncomesPage />,
  [ROUTES.categories]: <CategoriesPage />,
  [ROUTES.settings]: <SettingsPage />,
}

const appRoutes: RouteObject[] = ALL_NAV_ITEMS.filter((item) => item.to !== ROUTES.design).map(
  (item) => ({
    ...(item.to === ROUTES.dashboard ? { index: true } : { path: item.to.slice(1) }),
    element: BUILT[item.to] ?? <PlaceholderPage item={item} />,
    handle: title(item.label, item.monthly),
  }),
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
            element: <CardsPage />,
            handle: title('Cartões & Faturas', true),
          },
          {
            path: ROUTES.design.slice(1),
            // Code-split: the showcase pulls in Recharts, which the shell doesn't need.
            lazy: () =>
              import('@/features/design-showcase/DesignShowcasePage').then((module) => ({
                Component: module.DesignShowcasePage,
              })),
            handle: title('Sistema de design'),
          },
          { path: '*', element: <NotFoundPage />, handle: title('Página não encontrada') },
        ],
      },
    ],
  },
])
