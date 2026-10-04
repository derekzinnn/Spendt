import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { ApiError } from './api'
import { queryKeys } from './query-keys'

/**
 * A 401 anywhere means the session ended (expired, logged out elsewhere). Marking "me" as
 * null makes the protected layout redirect to the login page.
 */
function handleUnauthorized(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(queryKeys.me, null)
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 4xx never helps; network blips and 5xx get one more try.
      retry: (failureCount, error) =>
        failureCount < 1 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: true,
    },
  },
})
