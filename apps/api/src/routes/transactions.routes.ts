import {
  createTransactionSchema,
  purchaseScopeSchema,
  restoreTransactionsSchema,
  updateTransactionSchema,
  type ListTransactionsQuery,
} from '@spendly/shared'
import { Router } from 'express'

import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  restoreTransactions,
  updateTransaction,
} from '../domain/transactions/transaction.service'
import { idParam } from '../lib/params'
import { scopeOf } from '../middleware/auth'

const NOT_FOUND = 'Lançamento não encontrado.'

/** `/transactions` — mounted behind `requireHousehold`. */
export function transactionsRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(
      await listTransactions(
        scopeOf(req).householdId,
        req.query as unknown as ListTransactionsQuery,
      ),
    )
  })

  router.post('/', async (req, res) => {
    const input = createTransactionSchema.parse(req.body)
    const { householdId, member } = scopeOf(req)
    res.status(201).json(await createTransaction(householdId, member.id, input))
  })

  router.post('/restore', async (req, res) => {
    const { ids } = restoreTransactionsSchema.parse(req.body)
    res.json(await restoreTransactions(scopeOf(req).householdId, ids))
  })

  router.patch('/:id', async (req, res) => {
    const input = updateTransactionSchema.parse(req.body)
    res.json(
      await updateTransaction(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), input),
    )
  })

  router.delete('/:id', async (req, res) => {
    const scope = purchaseScopeSchema.parse(req.query.scope)
    res.json(
      await deleteTransaction(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), scope),
    )
  })

  return router
}
