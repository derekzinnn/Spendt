import { createAccountSchema, updateAccountSchema } from '@spendly/shared'
import { Router } from 'express'

import {
  createAccount,
  deleteAccount,
  listAccounts,
  setAccountArchived,
  updateAccount,
} from '../domain/accounts/account.service'
import { flagQuery, idParam } from '../lib/params'
import { scopeOf } from '../middleware/auth'

const NOT_FOUND = 'Conta não encontrada.'

/** Mounted behind `requireHousehold`. */
export function accountsRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await listAccounts(scopeOf(req).householdId, flagQuery(req, 'includeArchived')))
  })

  router.post('/', async (req, res) => {
    const input = createAccountSchema.parse(req.body)
    res.status(201).json(await createAccount(scopeOf(req).householdId, input))
  })

  router.patch('/:id', async (req, res) => {
    const input = updateAccountSchema.parse(req.body)
    res.json(await updateAccount(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), input))
  })

  router.post('/:id/archive', async (req, res) => {
    res.json(
      await setAccountArchived(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), true),
    )
  })

  router.post('/:id/unarchive', async (req, res) => {
    res.json(
      await setAccountArchived(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), false),
    )
  })

  router.delete('/:id', async (req, res) => {
    await deleteAccount(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND))
    res.status(204).end()
  })

  return router
}
