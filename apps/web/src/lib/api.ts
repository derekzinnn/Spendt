/**
 * Minimal fetch wrapper for the Spendly API.
 *
 * The API lives on the same origin under /api (Vite proxy in dev, Caddy in prod), so the
 * session cookie travels automatically and no CORS is involved.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet.')
  }

  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    const error = (body as ErrorBody | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Algo deu errado. Tente de novo.',
      error?.details,
    )
  }
  return body as T
}
