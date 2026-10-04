import type { MeDto } from '@spendly/shared'
import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from './query-keys'

const notMe = {
  predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== queryKeys.me[0],
}

/**
 * Swap the cached session after login / sign-up / household switch / invite accept.
 * We update "me" in place (never `clear()`: that detaches screens already subscribed to it)
 * and reset everything else, so data from the previous session or household is refetched.
 */
export function replaceSession(queryClient: QueryClient, me: MeDto) {
  queryClient.setQueryData(queryKeys.me, me)
  void queryClient.resetQueries(notMe)
}

/** After logout: "me" becomes null (the guard redirects) and private data is dropped. */
export function endSessionCache(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.me, null)
  queryClient.removeQueries(notMe)
}
