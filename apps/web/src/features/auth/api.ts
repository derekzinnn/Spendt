import type { ChangePasswordInput, LoginInput, MeDto, RegisterInput } from '@spendly/shared'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import { apiFetch, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { endSessionCache, replaceSession } from '@/lib/session-cache'

/** `null` means "not logged in" — a normal state, not an error. */
export const meQueryOptions = queryOptions({
  queryKey: queryKeys.me,
  queryFn: async (): Promise<MeDto | null> => {
    try {
      return await apiFetch<MeDto>('/auth/me')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  staleTime: 5 * 60_000,
})

/**
 * The logged-in user and household. Only for screens inside the protected layout, where
 * the router loader has already guaranteed a session.
 */
export function useMe(): MeDto {
  const { data } = useSuspenseQuery(meQueryOptions)
  if (!data) throw new Error('useMe() used outside the authenticated area')
  return data
}

/** Same as useMe, plus the active household and member (always present in the shell). */
export function useHouseholdContext() {
  const me = useMe()
  if (!me.household || !me.member) throw new Error('No active household')
  return { ...me, household: me.household, member: me.member }
}

function useSessionMutation<TInput>(path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TInput) => apiFetch<MeDto>(path, { method: 'POST', json: input }),
    // A new session (or household) means new data: refetch everything else.
    onSuccess: (me) => replaceSession(queryClient, me),
  })
}

export const useLogin = () => useSessionMutation<LoginInput>('/auth/login')
export const useRegister = () => useSessionMutation<RegisterInput>('/auth/register')
export const useSwitchHousehold = () =>
  useSessionMutation<{ householdId: string }>('/auth/switch-household')

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<null>('/auth/logout', { method: 'POST' }),
    onSettled: () => endSessionCache(queryClient),
  })
}

/**
 * Changing the password keeps this session and drops the others — the person stays logged
 * in here, and anywhere else has to sign in again with the new one.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiFetch<null>('/auth/change-password', { method: 'POST', json: input }),
  })
}
