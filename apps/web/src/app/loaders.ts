import { redirect, type LoaderFunctionArgs } from 'react-router'

import { meQueryOptions } from '@/features/auth/api'
import { queryClient } from '@/lib/query-client'

import { ROUTES } from './navigation'

/**
 * Route guards. A loader runs before the screen renders — like a receptionist checking
 * your badge before you reach the office, instead of the office kicking you out after
 * you sat down.
 */
export async function requireSessionLoader({ request }: LoaderFunctionArgs) {
  const me = await queryClient.ensureQueryData(meQueryOptions)
  if (!me) {
    const url = new URL(request.url)
    const next = url.pathname + url.search
    return redirect(
      next === '/' ? ROUTES.login : `${ROUTES.login}?next=${encodeURIComponent(next)}`,
    )
  }
  return null
}

/** Login and sign-up make no sense with a session: go home. */
export async function guestOnlyLoader() {
  const me = await queryClient.ensureQueryData(meQueryOptions)
  if (me) return redirect(ROUTES.dashboard)
  return null
}

/** Pages that work both ways (accept invite) just need to know who is there. */
export async function sessionAwareLoader() {
  await queryClient.ensureQueryData(meQueryOptions)
  return null
}
