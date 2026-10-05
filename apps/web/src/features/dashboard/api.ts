import type { DashboardSummaryDto, MonthKey } from '@spendly/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

/** Everything the dashboard charts need (category spending, 6-month trend, alerts). */
export function useSummary(month: MonthKey) {
  return useQuery({
    queryKey: queryKeys.summary(month),
    queryFn: () => apiFetch<DashboardSummaryDto>(`/summary?month=${month}`),
    placeholderData: keepPreviousData,
  })
}
