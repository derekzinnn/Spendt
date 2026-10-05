import type {
  CreateRecurringRuleInput,
  CreateTransactionInput,
  DeletedItemsDto,
  ListTransactionsQuery,
  PurchaseScope,
  RecurringRuleDto,
  TransactionDto,
  TransactionListDto,
  UpdateRecurringRuleInput,
  UpdateTransactionInput,
} from '@spendly/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { invalidateLedger } from '@/lib/ledger'
import { queryKeys } from '@/lib/query-keys'

function toSearch(query: ListTransactionsQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

/** The month's rows with their totals; keeps the previous month on screen while loading. */
export function useTransactions(query: ListTransactionsQuery, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: queryKeys.transactionList(query),
    queryFn: () => apiFetch<TransactionListDto>(`/transactions?${toSearch(query)}`),
    placeholderData: keepPreviousData,
  })
}

function useLedgerMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => invalidateLedger(queryClient) })
}

export const useCreateTransaction = () =>
  useLedgerMutation((input: CreateTransactionInput) =>
    apiFetch<TransactionDto>('/transactions', { method: 'POST', json: input }),
  )

export const useUpdateTransaction = () =>
  useLedgerMutation(({ id, ...input }: UpdateTransactionInput & { id: string }) =>
    apiFetch<TransactionDto>(`/transactions/${id}`, { method: 'PATCH', json: input }),
  )

export const useDeleteTransaction = () =>
  useLedgerMutation(({ id, scope = 'one' }: { id: string; scope?: PurchaseScope }) =>
    apiFetch<DeletedItemsDto>(`/transactions/${id}?scope=${scope}`, { method: 'DELETE' }),
  )

export const useRestoreTransactions = () =>
  useLedgerMutation((ids: string[]) =>
    apiFetch<{ restored: number }>('/transactions/restore', { method: 'POST', json: { ids } }),
  )

export function useRecurringRules() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: () => apiFetch<RecurringRuleDto[]>('/recurring-rules'),
  })
}

export const useCreateRecurringRule = () =>
  useLedgerMutation((input: CreateRecurringRuleInput) =>
    apiFetch<RecurringRuleDto>('/recurring-rules', { method: 'POST', json: input }),
  )

export const useUpdateRecurringRule = () =>
  useLedgerMutation(({ id, ...input }: UpdateRecurringRuleInput & { id: string }) =>
    apiFetch<RecurringRuleDto>(`/recurring-rules/${id}`, { method: 'PATCH', json: input }),
  )

export const usePauseRecurringRule = () =>
  useLedgerMutation(({ id, paused }: { id: string; paused: boolean }) =>
    apiFetch<RecurringRuleDto>(`/recurring-rules/${id}/${paused ? 'pause' : 'resume'}`, {
      method: 'POST',
    }),
  )

export const useDeleteRecurringRule = () =>
  useLedgerMutation((id: string) => apiFetch<null>(`/recurring-rules/${id}`, { method: 'DELETE' }))
