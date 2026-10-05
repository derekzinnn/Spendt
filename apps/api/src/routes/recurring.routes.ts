import { createRecurringRuleSchema, updateRecurringRuleSchema } from '@spendly/shared'
import { Router } from 'express'

import {
  createRecurringRule,
  deleteRecurringRule,
  listRecurringRules,
  setRecurringRulePaused,
  updateRecurringRule,
} from '../domain/recurring/recurring.service'
import { idParam } from '../lib/params'
import { scopeOf } from '../middleware/auth'

const NOT_FOUND = 'Recorrência não encontrada.'

/** `/recurring-rules` — mounted behind `requireHousehold`. */
export function recurringRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await listRecurringRules(scopeOf(req).householdId))
  })

  router.post('/', async (req, res) => {
    const input = createRecurringRuleSchema.parse(req.body)
    const { householdId, member } = scopeOf(req)
    res.status(201).json(await createRecurringRule(householdId, member.id, input))
  })

  router.patch('/:id', async (req, res) => {
    const input = updateRecurringRuleSchema.parse(req.body)
    res.json(
      await updateRecurringRule(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), input),
    )
  })

  router.post('/:id/pause', async (req, res) => {
    res.json(
      await setRecurringRulePaused(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), true),
    )
  })

  router.post('/:id/resume', async (req, res) => {
    res.json(
      await setRecurringRulePaused(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), false),
    )
  })

  router.delete('/:id', async (req, res) => {
    await deleteRecurringRule(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND))
    res.status(204).end()
  })

  return router
}
