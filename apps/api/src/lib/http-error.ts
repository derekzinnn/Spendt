import type { FieldIssue } from '@spendly/shared'

/**
 * An error that maps to an HTTP response.
 *
 * `code` is a stable English identifier for clients and logs; `message` is pt-BR and
 * safe to show to the user as-is. Field problems go in `details` as `FieldIssue[]`, the
 * same shape validation errors use, so the web app can attach them to form fields.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }

  static badRequest(message = 'Requisição inválida.', details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details)
  }

  static unauthorized(message = 'Faça login para continuar.') {
    return new HttpError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'Você não tem acesso a este recurso.', code = 'FORBIDDEN') {
    return new HttpError(403, code, message)
  }

  static notFound(message = 'Não encontrado.') {
    return new HttpError(404, 'NOT_FOUND', message)
  }

  static conflict(message = 'Este registro já existe.', details?: unknown) {
    return new HttpError(409, 'CONFLICT', message, details)
  }

  static gone(message: string, code = 'GONE') {
    return new HttpError(410, code, message)
  }

  static tooManyRequests(message = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.') {
    return new HttpError(429, 'RATE_LIMITED', message)
  }

  /** A problem tied to one form field (status 400 by default, 409 for duplicates). */
  static field(path: string, message: string, status = 400, code = 'INVALID_FIELD') {
    const details: FieldIssue[] = [{ path, message }]
    return new HttpError(status, code, message, details)
  }
}

export interface ErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
