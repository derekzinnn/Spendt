import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from './query-keys'

/**
 * Anything that writes to the ledger can move balances, invoices, limits, the month's
 * totals and recurring occurrences — refresh all of them (they're derived, never stored).
 */
export function invalidateLedger(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cards }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
  ])
}
