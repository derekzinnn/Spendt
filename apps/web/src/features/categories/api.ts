import type { CategoryDto, CreateCategoryInput, UpdateCategoryInput } from '@spendly/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

/** All categories, archived included — screens split them client-side. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoryDto[]>('/categories?includeArchived=true'),
  })
}

function useCategoryMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  })
}

export const useCreateCategory = () =>
  useCategoryMutation((input: CreateCategoryInput) =>
    apiFetch<CategoryDto>('/categories', { method: 'POST', json: input }),
  )

export const useUpdateCategory = () =>
  useCategoryMutation(({ id, ...input }: UpdateCategoryInput & { id: string }) =>
    apiFetch<CategoryDto>(`/categories/${id}`, { method: 'PATCH', json: input }),
  )

export const useArchiveCategory = () =>
  useCategoryMutation((id: string) =>
    apiFetch<CategoryDto[]>(`/categories/${id}/archive`, { method: 'POST' }),
  )

export const useUnarchiveCategory = () =>
  useCategoryMutation((id: string) =>
    apiFetch<CategoryDto[]>(`/categories/${id}/unarchive`, { method: 'POST' }),
  )

export const useDeleteCategory = () =>
  useCategoryMutation((id: string) => apiFetch<null>(`/categories/${id}`, { method: 'DELETE' }))
