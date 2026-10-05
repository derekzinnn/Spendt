import type {
  CommitImportInput,
  ExportDto,
  ImportPreviewDto,
  IsoDate,
  PreviewImportInput,
} from '@spendly/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { invalidateLedger } from '@/lib/ledger'

/** Reads the statement on the server (guesses + duplicates) without writing anything. */
export function usePreviewImport() {
  return useMutation({
    mutationFn: (input: PreviewImportInput) =>
      apiFetch<ImportPreviewDto>('/import/preview', { method: 'POST', json: input }),
  })
}

export interface CommitImportResult {
  ids: string[]
  count: number
}

export function useCommitImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CommitImportInput) =>
      apiFetch<CommitImportResult>('/import/commit', { method: 'POST', json: input }),
    onSuccess: () => invalidateLedger(queryClient),
  })
}

/** "Desfazer" after an import: soft-deletes everything it created. */
export function useUndoImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ count: number }>('/import/undo', { method: 'POST', json: { ids } }),
    onSuccess: () => invalidateLedger(queryClient),
  })
}

/** The ledger over a window, ready to become a file. Fetched on demand, never cached. */
export function fetchExport(from: IsoDate, to: IsoDate) {
  return apiFetch<ExportDto>(`/export?from=${from}&to=${to}`)
}
