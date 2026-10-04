import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

import { isProduction } from '../config/env'
import { Prisma } from '../generated/prisma/client'
import { HttpError, type ErrorBody } from '../lib/http-error'

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Rota não encontrada: ${req.method} ${req.path}`))
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error

  if (error instanceof ZodError) {
    return HttpError.badRequest(
      'Alguns campos estão inválidos.',
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return HttpError.conflict()
      case 'P2025':
        return HttpError.notFound()
      default:
        break
    }
  }

  // body-parser errors (malformed JSON, payload too large) carry a status
  if (typeof error === 'object' && error !== null && 'status' in error && 'type' in error) {
    const status = Number((error as { status: unknown }).status)
    if (status >= 400 && status < 500)
      return new HttpError(status, 'BAD_REQUEST', 'Requisição inválida.')
  }

  return new HttpError(
    500,
    'INTERNAL',
    'Algo deu errado do nosso lado. Tente de novo em instantes.',
  )
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const httpError = toHttpError(error)

  if (httpError.status >= 500) {
    req.log.error({ err: error }, 'Unhandled error')
  } else {
    req.log.warn({ code: httpError.code, status: httpError.status }, httpError.message)
  }

  const body: ErrorBody = {
    error: {
      code: httpError.code,
      message: httpError.message,
      ...(httpError.details !== undefined ? { details: httpError.details } : {}),
    },
  }
  if (!isProduction && httpError.status >= 500 && error instanceof Error) {
    body.error.details = { name: error.name, message: error.message }
  }

  res.status(httpError.status).json(body)
}
