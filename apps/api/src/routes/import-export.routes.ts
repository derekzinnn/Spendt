import {
  commitImportSchema,
  exportQuerySchema,
  previewImportSchema,
  restoreTransactionsSchema,
} from '@spendly/shared'
import { Router } from 'express'

import { exportTransactions } from '../domain/import/export.service'
import { commitImport, previewImport, undoImport } from '../domain/import/import.service'
import { scopeOf } from '../middleware/auth'

/**
 * `/import` and `/export` — mounted behind `requireHousehold`.
 *
 * The browser does the file reading; these endpoints only see JSON rows. Preview writes
 * nothing, commit writes everything in one database transaction and returns the ids so the
 * screen can offer "Desfazer" (via POST /transactions/restore).
 */
export function importRouter() {
  const router = Router()

  router.post('/preview', async (req, res) => {
    const input = previewImportSchema.parse(req.body)
    res.json(await previewImport(scopeOf(req).householdId, input))
  })

  router.post('/commit', async (req, res) => {
    const input = commitImportSchema.parse(req.body)
    const { householdId, member } = scopeOf(req)
    res.status(201).json(await commitImport(householdId, member.id, input))
  })

  router.post('/undo', async (req, res) => {
    const { ids } = restoreTransactionsSchema.parse(req.body)
    res.json(await undoImport(scopeOf(req).householdId, ids))
  })

  return router
}

export function exportRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    const query = exportQuerySchema.parse(req.query)
    res.json(await exportTransactions(scopeOf(req).householdId, query))
  })

  return router
}
