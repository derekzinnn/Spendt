import {
  isCategoryIconKey,
  isPaletteKey,
  type CategoryDto,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@spendly/shared'

import type { Category, CategoryKind } from '../../generated/prisma/client'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'

export function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    kind: category.kind,
    icon: isCategoryIconKey(category.icon) ? category.icon : 'ellipsis',
    color: isPaletteKey(category.color) ? category.color : 'neutral',
    monthlyBudgetCents: category.monthlyBudgetCents,
    sortOrder: category.sortOrder,
    archivedAt: category.archivedAt?.toISOString() ?? null,
  }
}

/** Every query below is scoped by householdId — an id from another household is a 404. */
async function findCategory(householdId: string, id: string): Promise<Category> {
  const category = await prisma.category.findFirst({ where: { id, householdId } })
  if (!category) throw HttpError.notFound('Categoria não encontrada.')
  return category
}

/** Sibling names are unique (case-insensitive) among active categories. */
async function assertNameAvailable(
  householdId: string,
  kind: CategoryKind,
  parentId: string | null,
  name: string,
  exceptId?: string,
) {
  const clash = await prisma.category.findFirst({
    where: {
      householdId,
      kind,
      parentId,
      archivedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  })
  if (clash) {
    const where = parentId ? 'nesta categoria' : 'entre as categorias principais'
    throw HttpError.field('name', `Já existe “${name}” ${where}.`, 409, 'NAME_TAKEN')
  }
}

function assertBudgetAllowed(kind: CategoryKind, budget: number | null | undefined) {
  if (kind === 'INCOME' && budget != null) {
    throw HttpError.field('monthlyBudgetCents', 'Orçamento só vale para categorias de despesa.')
  }
}

export async function listCategories(
  householdId: string,
  includeArchived: boolean,
): Promise<CategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: { householdId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })
  return categories.map(toCategoryDto)
}

export async function createCategory(
  householdId: string,
  input: CreateCategoryInput,
): Promise<CategoryDto> {
  const parentId = input.parentId ?? null
  if (parentId) {
    const parent = await findCategory(householdId, parentId)
    if (parent.parentId) {
      throw HttpError.field('parentId', 'Subcategorias não podem ter subcategorias.')
    }
    if (parent.kind !== input.kind) {
      throw HttpError.field('parentId', 'A categoria principal precisa ser do mesmo tipo.')
    }
    if (parent.archivedAt) {
      throw HttpError.field('parentId', 'A categoria principal está arquivada.')
    }
  }
  assertBudgetAllowed(input.kind, input.monthlyBudgetCents)
  await assertNameAvailable(householdId, input.kind, parentId, input.name)

  const last = await prisma.category.aggregate({
    where: { householdId, kind: input.kind, parentId },
    _max: { sortOrder: true },
  })

  const category = await prisma.category.create({
    data: {
      householdId,
      parentId,
      name: input.name,
      kind: input.kind,
      icon: input.icon,
      color: input.color,
      monthlyBudgetCents: input.monthlyBudgetCents ?? null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  })
  return toCategoryDto(category)
}

export async function updateCategory(
  householdId: string,
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDto> {
  const category = await findCategory(householdId, id)
  assertBudgetAllowed(category.kind, input.monthlyBudgetCents)
  if (input.name !== undefined && input.name !== category.name) {
    await assertNameAvailable(householdId, category.kind, category.parentId, input.name, id)
  }
  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.monthlyBudgetCents !== undefined
        ? { monthlyBudgetCents: input.monthlyBudgetCents }
        : {}),
    },
  })
  return toCategoryDto(updated)
}

/** Archiving a parent archives its subcategories too. Returns every archived category. */
export async function archiveCategory(householdId: string, id: string): Promise<CategoryDto[]> {
  const category = await findCategory(householdId, id)
  const now = new Date()
  await prisma.category.updateMany({
    where: { householdId, OR: [{ id }, { parentId: category.id }], archivedAt: null },
    data: { archivedAt: now },
  })
  const affected = await prisma.category.findMany({
    where: { householdId, OR: [{ id }, { parentId: category.id }] },
  })
  return affected.map(toCategoryDto)
}

/**
 * Restores a category. A parent comes back with its subcategories; a subcategory can only
 * come back while its parent is active. Restoring fails if an active sibling took the name.
 */
export async function unarchiveCategory(householdId: string, id: string): Promise<CategoryDto[]> {
  const category = await findCategory(householdId, id)
  if (category.parentId) {
    const parent = await findCategory(householdId, category.parentId)
    if (parent.archivedAt) {
      throw HttpError.conflict(`Restaure “${parent.name}” primeiro.`)
    }
  }
  await assertNameAvailable(householdId, category.kind, category.parentId, category.name, id)

  await prisma.category.updateMany({
    where: { householdId, OR: [{ id }, { parentId: category.id }] },
    data: { archivedAt: null },
  })
  const affected = await prisma.category.findMany({
    where: { householdId, OR: [{ id }, { parentId: category.id }] },
  })
  return affected.map(toCategoryDto)
}

/** Hard delete — only for categories nothing points at. Otherwise, archive. */
export async function deleteCategory(householdId: string, id: string) {
  const category = await findCategory(householdId, id)
  const [children, transactions, rules] = await Promise.all([
    prisma.category.count({ where: { parentId: category.id } }),
    prisma.transaction.count({ where: { categoryId: category.id } }),
    prisma.recurringRule.count({ where: { categoryId: category.id } }),
  ])
  if (children > 0) {
    throw HttpError.conflict('Exclua ou mova as subcategorias primeiro — ou arquive a categoria.')
  }
  if (transactions > 0 || rules > 0) {
    throw HttpError.conflict(
      'Esta categoria já foi usada em lançamentos. Arquive em vez de excluir.',
    )
  }
  await prisma.category.delete({ where: { id: category.id } })
}
