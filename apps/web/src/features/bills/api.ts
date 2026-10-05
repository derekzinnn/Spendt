import type {
  BillsDto,
  InvoiceSummaryDto,
  ListBillsQuery,
  PayBillInput,
  PayInvoiceInput,
  TransactionDto,
} from '@spendly/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { invalidateLedger } from '@/lib/ledger'
import { queryKeys } from '@/lib/query-keys'

export interface InvoicePaymentResult {
  transactionId: string
  invoice: InvoiceSummaryDto
  settled: boolean
}

/** Everything still owed up to the end of the month, overdue from before included. */
export function useBills(query: ListBillsQuery) {
  return useQuery({
    queryKey: queryKeys.billList(query),
    queryFn: () => apiFetch<BillsDto>(`/bills?month=${query.month}`),
    placeholderData: keepPreviousData,
  })
}

function useLedgerMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => invalidateLedger(queryClient) })
}

export const usePayBill = () =>
  useLedgerMutation(({ id, ...input }: PayBillInput & { id: string }) =>
    apiFetch<TransactionDto>(`/bills/${id}/pay`, { method: 'POST', json: input }),
  )

export const usePayInvoice = () =>
  useLedgerMutation(({ id, ...input }: PayInvoiceInput & { id: string }) =>
    apiFetch<InvoicePaymentResult>(`/invoices/${id}/payments`, { method: 'POST', json: input }),
  )
