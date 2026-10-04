import type { AccountDto, CreateAccountInput, UpdateAccountInput } from '@spendly/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

/** All accounts with their derived balances, archived included. */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => apiFetch<AccountDto[]>('/accounts?includeArchived=true'),
  })
}

/** Σ balances of the active accounts — the household's money right now. */
export function useTotalBalance() {
  const accounts = useAccounts()
  const total = accounts.data
    ?.filter((account) => account.archivedAt === null)
    .reduce((sum, account) => sum + account.balanceCents, 0)
  return { total, loading: accounts.isPending }
}

function useAccountMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
  })
}

export const useCreateAccount = () =>
  useAccountMutation((input: CreateAccountInput) =>
    apiFetch<AccountDto>('/accounts', { method: 'POST', json: input }),
  )

export const useUpdateAccount = () =>
  useAccountMutation(({ id, ...input }: UpdateAccountInput & { id: string }) =>
    apiFetch<AccountDto>(`/accounts/${id}`, { method: 'PATCH', json: input }),
  )

export const useArchiveAccount = () =>
  useAccountMutation(({ id, archived }: { id: string; archived: boolean }) =>
    apiFetch<AccountDto>(`/accounts/${id}/${archived ? 'archive' : 'unarchive'}`, {
      method: 'POST',
    }),
  )

export const useDeleteAccount = () =>
  useAccountMutation((id: string) => apiFetch<null>(`/accounts/${id}`, { method: 'DELETE' }))
