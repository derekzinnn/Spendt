import {
  createCardPurchaseSchema,
  createCardSchema,
  purchaseScopeSchema,
  restoreTransactionsSchema,
  updateCardPurchaseSchema,
  updateCardSchema,
} from '@spendly/shared'
import { Router } from 'express'

import {
  createCard,
  deleteCard,
  getCard,
  listCards,
  setCardArchived,
  updateCard,
} from '../domain/cards/card.service'
import { getInvoiceDetail, listCardInvoices } from '../domain/cards/invoice.service'
import {
  createCardPurchase,
  deleteCardPurchase,
  restoreCardPurchases,
  updateCardPurchase,
} from '../domain/cards/purchase.service'
import { flagQuery, idParam } from '../lib/params'
import { scopeOf } from '../middleware/auth'

const CARD_NOT_FOUND = 'Cartão não encontrado.'

/** `/cards` — mounted behind `requireHousehold`. */
export function cardsRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await listCards(scopeOf(req).householdId, flagQuery(req, 'includeArchived')))
  })

  router.post('/', async (req, res) => {
    const input = createCardSchema.parse(req.body)
    res.status(201).json(await createCard(scopeOf(req).householdId, input))
  })

  router.get('/:id', async (req, res) => {
    res.json(await getCard(scopeOf(req).householdId, idParam(req, 'id', CARD_NOT_FOUND)))
  })

  router.patch('/:id', async (req, res) => {
    const input = updateCardSchema.parse(req.body)
    res.json(await updateCard(scopeOf(req).householdId, idParam(req, 'id', CARD_NOT_FOUND), input))
  })

  router.post('/:id/archive', async (req, res) => {
    res.json(
      await setCardArchived(scopeOf(req).householdId, idParam(req, 'id', CARD_NOT_FOUND), true),
    )
  })

  router.post('/:id/unarchive', async (req, res) => {
    res.json(
      await setCardArchived(scopeOf(req).householdId, idParam(req, 'id', CARD_NOT_FOUND), false),
    )
  })

  router.delete('/:id', async (req, res) => {
    await deleteCard(scopeOf(req).householdId, idParam(req, 'id', CARD_NOT_FOUND))
    res.status(204).end()
  })

  router.get('/:id/invoices', async (req, res) => {
    res.json(await listCardInvoices(scopeOf(req).householdId, idParam(req, 'id', CARD_NOT_FOUND)))
  })

  return router
}

/** `/invoices` — mounted behind `requireHousehold`. */
export function invoicesRouter() {
  const router = Router()
  router.get('/:id', async (req, res) => {
    res.json(
      await getInvoiceDetail(
        scopeOf(req).householdId,
        idParam(req, 'id', 'Fatura não encontrada.'),
      ),
    )
  })
  return router
}

/** `/card-purchases` — mounted behind `requireHousehold`. */
export function cardPurchasesRouter() {
  const router = Router()
  const NOT_FOUND = 'Compra não encontrada.'

  router.post('/', async (req, res) => {
    const input = createCardPurchaseSchema.parse(req.body)
    const { householdId, member } = scopeOf(req)
    res.status(201).json(await createCardPurchase(householdId, member.id, input))
  })

  router.post('/restore', async (req, res) => {
    const { ids } = restoreTransactionsSchema.parse(req.body)
    res.json(await restoreCardPurchases(scopeOf(req).householdId, ids))
  })

  router.patch('/:id', async (req, res) => {
    const scope = purchaseScopeSchema.parse(req.query.scope)
    const input = updateCardPurchaseSchema.parse(req.body)
    res.json(
      await updateCardPurchase(
        scopeOf(req).householdId,
        idParam(req, 'id', NOT_FOUND),
        scope,
        input,
      ),
    )
  })

  router.delete('/:id', async (req, res) => {
    const scope = purchaseScopeSchema.parse(req.query.scope)
    res.json(
      await deleteCardPurchase(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), scope),
    )
  })

  return router
}
