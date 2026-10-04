import { DEFAULT_CATEGORIES } from '@spendly/shared'

import type { Prisma } from '../../generated/prisma/client'

/**
 * Creates the default pt-BR category tree for a household.
 * Used by the seed script and (Phase 1) when a household is created.
 *
 * @returns a map from category name to id (parents and children).
 */
export async function createDefaultCategories(
  tx: Prisma.TransactionClient,
  householdId: string,
): Promise<Map<string, string>> {
  const parents = await tx.category.createManyAndReturn({
    data: DEFAULT_CATEGORIES.map((category, index) => ({
      householdId,
      name: category.name,
      kind: category.kind,
      icon: category.icon,
      color: category.color,
      sortOrder: index,
    })),
    select: { id: true, name: true },
  })

  const ids = new Map(parents.map((parent) => [parent.name, parent.id]))

  const children = DEFAULT_CATEGORIES.flatMap((category) =>
    (category.children ?? []).map((child, index) => ({
      householdId,
      parentId: ids.get(category.name),
      name: child.name,
      kind: category.kind,
      icon: child.icon,
      color: category.color,
      sortOrder: index,
    })),
  )

  const createdChildren = await tx.category.createManyAndReturn({
    data: children,
    select: { id: true, name: true, parentId: true },
  })
  for (const child of createdChildren) {
    // Children may share names across parents ("Restaurante" vs "Restaurantes"), so the
    // parent-qualified key is the unambiguous one.
    const parentName = parents.find((p) => p.id === child.parentId)?.name
    ids.set(`${parentName} › ${child.name}`, child.id)
  }

  return ids
}
