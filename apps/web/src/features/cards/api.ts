import type {
  CardDto,
  CardItemDto,
  CardPurchaseResultDto,
  CreateCardInput,
  CreateCardPurchaseInput,
  DeletedItemsDto,
  InvoiceDetailDto,
  InvoiceSummaryDto,
  PurchaseScope,
  UpdateCardInput,
  UpdateCardPurchaseInput,
} from '@spendly/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { invalidateLedger } from '@/lib/ledger'
import { queryKeys } from '@/lib/query-keys'

/** All cards with derived usage and the current invoice, archived included. */
export function useCards() {
  return useQuery({
    queryKey: queryKeys.cards,
    queryFn: () => apiFetch<CardDto[]>('/cards?includeArchived=true'),
  })
}

/** Every invoice of a card, newest due month first (future installments included). */
export function useCardInvoices(cardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cardInvoices(cardId ?? ''),
    queryFn: () => apiFetch<InvoiceSummaryDto[]>(`/cards/${cardId}/invoices`),
    enabled: Boolean(cardId),
  })
}

export function useInvoice(invoiceId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.invoice(invoiceId ?? ''),
    queryFn: () => apiFetch<InvoiceDetailDto>(`/invoices/${invoiceId}`),
    enabled: Boolean(invoiceId),
  })
}

/** Every card mutation touches the ledger: cards, invoices, transactions, balances. */
function useCardMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => invalidateLedger(queryClient),
  })
}

export const useCreateCard = () =>
  useCardMutation((input: CreateCardInput) =>
    apiFetch<CardDto>('/cards', { method: 'POST', json: input }),
  )

export const useUpdateCard = () =>
  useCardMutation(({ id, ...input }: UpdateCardInput & { id: string }) =>
    apiFetch<CardDto>(`/cards/${id}`, { method: 'PATCH', json: input }),
  )

export const useArchiveCard = () =>
  useCardMutation(({ id, archived }: { id: string; archived: boolean }) =>
    apiFetch<CardDto>(`/cards/${id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' }),
  )

export const useDeleteCard = () =>
  useCardMutation((id: string) => apiFetch<null>(`/cards/${id}`, { method: 'DELETE' }))

export const useCreatePurchase = () =>
  useCardMutation((input: CreateCardPurchaseInput) =>
    apiFetch<CardPurchaseResultDto>('/card-purchases', { method: 'POST', json: input }),
  )

export const useUpdatePurchase = () =>
  useCardMutation(
    ({ id, scope, ...input }: UpdateCardPurchaseInput & { id: string; scope: PurchaseScope }) =>
      apiFetch<CardItemDto[]>(`/card-purchases/${id}?scope=${scope}`, {
        method: 'PATCH',
        json: input,
      }),
  )

export const useDeletePurchase = () =>
  useCardMutation(({ id, scope }: { id: string; scope: PurchaseScope }) =>
    apiFetch<DeletedItemsDto>(`/card-purchases/${id}?scope=${scope}`, { method: 'DELETE' }),
  )

export const useRestorePurchases = () =>
  useCardMutation((ids: string[]) =>
    apiFetch<{ restored: number }>('/card-purchases/restore', { method: 'POST', json: { ids } }),
  )
