import { createCategorySchema, updateCategorySchema } from '@spendly/shared'
import { Router } from 'express'

import {
  archiveCategory,
  createCategory,
  deleteCategory,
  listCategories,
  unarchiveCategory,
  updateCategory,
} from '../domain/categories/category.service'
import { flagQuery, idParam } from '../lib/params'
import { scopeOf } from '../middleware/auth'

const NOT_FOUND = 'Categoria não encontrada.'

/** Mounted behind `requireHousehold`. */
export function categoriesRouter() {
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await listCategories(scopeOf(req).householdId, flagQuery(req, 'includeArchived')))
  })

  router.post('/', async (req, res) => {
    const input = createCategorySchema.parse(req.body)
    res.status(201).json(await createCategory(scopeOf(req).householdId, input))
  })

  router.patch('/:id', async (req, res) => {
    const input = updateCategorySchema.parse(req.body)
    res.json(await updateCategory(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND), input))
  })

  router.post('/:id/archive', async (req, res) => {
    res.json(await archiveCategory(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND)))
  })

  router.post('/:id/unarchive', async (req, res) => {
    res.json(await unarchiveCategory(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND)))
  })

  router.delete('/:id', async (req, res) => {
    await deleteCategory(scopeOf(req).householdId, idParam(req, 'id', NOT_FOUND))
    res.status(204).end()
  })

  return router
}
