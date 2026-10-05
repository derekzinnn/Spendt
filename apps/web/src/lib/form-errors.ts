import type { FieldIssue } from '@spendly/shared'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'

import { ApiError } from './api'

function isFieldIssues(value: unknown): value is FieldIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === 'object' && item !== null && 'path' in item && 'message' in item,
    )
  )
}

/**
 * Shows an API error where it belongs: field problems next to their inputs (the API sends
 * `details: [{ path, message }]`); anything else in the form's alert box (`root: true`)
 * or as a toast.
 */
export function showFormError<T extends FieldValues>(
  error: unknown,
  setError?: UseFormSetError<T>,
  {
    root = false,
    fields = {},
  }: {
    root?: boolean
    /** API field name → form field name, when the form models a field differently. */
    fields?: Record<string, string>
  } = {},
) {
  if (
    error instanceof ApiError &&
    setError &&
    isFieldIssues(error.details) &&
    error.details.length > 0
  ) {
    error.details.forEach((issue, index) => {
      const path = (fields[issue.path] ?? issue.path) as Path<T>
      setError(path, { type: 'server', message: issue.message }, { shouldFocus: index === 0 })
    })
    return
  }
  const message = error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.'
  if (root && setError) {
    setError('root.server', { type: 'server', message })
    return
  }
  toast.error(message)
}

/**
 * A toast-friendly message for an API error outside a form: the first field problem when
 * there is one ("Escolha a conta"), otherwise the error's own message.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && isFieldIssues(error.details) && error.details[0]) {
    return error.details[0].message
  }
  return error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.'
}

/** Only same-site relative paths, so `?next=` can't send people to another website. */
export function safeNextPath(next: string | null, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback
  return next
}
