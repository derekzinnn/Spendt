import { idSchema } from '@spendly/shared'
import type { Request } from 'express'

import { HttpError } from './http-error'

/** Reads a uuid route param; anything that isn't a uuid simply doesn't exist (404). */
export function idParam(req: Request, name = 'id', notFound = 'Não encontrado.'): string {
  const parsed = idSchema.safeParse(req.params[name])
  if (!parsed.success) throw HttpError.notFound(notFound)
  return parsed.data
}

/** `?includeArchived=true` style boolean query flags. */
export function flagQuery(req: Request, name: string): boolean {
  return req.query[name] === 'true' || req.query[name] === '1'
}
