import { payBillSchema, type ListBillsQuery } from '@spendly/shared'
import { Router } from 'express'

import { listBills, payBill } from '../domain/bills/bill.service'
import { idParam } from '../lib/params'
import { scopeOf } from '../middleware/auth'

const NOT_FOUND = 'Conta não encontrada.'

/** `/bills` — mounted behind `requireHousehold`. A projection, not a table. */
export function billsRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await listBills(scopeOf(req).householdId, req.query as unknown as ListBillsQuery))
  })

  /** Marks a pending bill as paid (the invoice equivalent is `/invoices/:id/payments`). */
  router.post('/:id/pay', async (req, res) => {
    const input = payBillSchema.parse(req.body)
    res.json(await payBill(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), input))
  })

  return router
}
